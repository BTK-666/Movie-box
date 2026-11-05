// End-to-end media test in real Chromium — the same engine the Android WebView
// uses. It reproduces the exact failure the device hit:
//
//   * the document is served over https://localhost (a Capacitor WebView origin),
//   * the WebView User-Agent is the app UA from capacitor.config.json,
//   * a <video> element loads a real signed CDN stream.
//
// With the document-wide `no-referrer` meta the CDN request carries no Referer
// and the stream decodes and plays. Without it Chromium sends
// `Referer: https://localhost/`, the CDN answers 429, and the player shows
// "This source failed to load — try another quality".
//
// Run with: npm run test:media   (needs network access + a system Chromium)

import { chromium } from 'playwright';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const appUa = JSON.parse(readFileSync('capacitor.config.json', 'utf8')).android.overrideUserAgent;
const indexHtml = readFileSync('index.html', 'utf8');
const htmlNoMeta = indexHtml.replace(/<meta name="referrer"[^>]*>\s*/i, '');

const CHROME = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
};

// The CDN stream must be fresh; signed links expire. Reuse one if the caller
// supplied it, otherwise resolve a current H.264 URL through the live API.
async function streamUrl() {
  const cached = '/tmp/streamurl.txt';
  if (existsSync(cached)) {
    const u = readFileSync(cached, 'utf8').trim();
    if (/^https?:\/\//.test(u)) return u;
  }
  // Node cannot import the TypeScript API module directly, so bundle a tiny
  // resolver with esbuild first.
  const probe = '/tmp/mb-streamurl-probe.mjs';
  writeFileSync(
    probe,
    `import { searchTitles, fetchStreams } from ${JSON.stringify(new URL('../src/data/api.ts', import.meta.url).pathname)};
const title = (await searchTitles('Dune'))[0];
const s = (await fetchStreams(title.id, 0, 0)).find((x) => /h264|avc/i.test(x.codec));
process.stdout.write(s?.url ?? '');`,
  );
  const bundled = '/tmp/mb-streamurl-probe.bundle.mjs';
  execSync(`npx esbuild ${probe} --bundle --platform=node --format=esm --target=node20 --outfile=${bundled} --log-level=error`);
  return execSync(`node ${bundled}`, { encoding: 'utf8' }).trim();
}

async function play(html, stream, port) {
  const server = https.createServer(
    { key: readFileSync('/tmp/mb-key.pem'), cert: readFileSync('/tmp/mb-cert.pem') },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
    },
  );
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ userAgent: appUa, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const referers = [];
  page.on('request', (r) => {
    if (/hakunaymatata|aoneroom/.test(r.url())) referers.push(r.headers()['referer'] ?? null);
  });

  await page.goto(`https://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async (u) => {
    const v = document.createElement('video');
    v.src = u;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    document.body.appendChild(v);
    await new Promise((r) => {
      v.onloadedmetadata = r;
      v.onerror = r;
      setTimeout(r, 30000);
    });
    let played = false;
    try {
      await v.play();
      played = true;
    } catch {}
    await new Promise((r) => setTimeout(r, 4000));
    return { readyState: v.readyState, error: v.error ? v.error.code : null, duration: v.duration, played };
  }, stream);

  await browser.close();
  server.close();
  return { result, referers };
}

if (!CHROME) {
  console.log('SKIP: no system Chromium found');
  process.exit(0);
}

execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/mb-key.pem -out /tmp/mb-cert.pem -days 1 -subj "/CN=localhost" 2>/dev/null');

const stream = await streamUrl();
if (!stream) {
  console.log('SKIP: no H.264 stream available to probe');
  process.exit(0);
}
console.log(`# WebView media path (UA=${appUa.slice(0, 40)}…)\n`);

const fixed = await play(indexHtml, stream, 8443);
ok(fixed.referers.every((r) => !r), 'no-referrer meta sends no Referer to the CDN', `referers=${JSON.stringify(fixed.referers)}`);
ok(fixed.result.readyState >= 3, 'stream loads (readyState >= HAVE_FUTURE_DATA)', `readyState=${fixed.result.readyState}`);
ok(fixed.result.error === null, 'stream has no media error');
ok(fixed.result.duration > 60, 'stream reports a real duration', `duration=${fixed.result.duration}`);
ok(fixed.result.played, 'stream plays');

const broken = await play(htmlNoMeta, stream, 8444);
ok(broken.referers.some((r) => !!r), 'without the meta Chromium leaks Referer: https://localhost/', `referers=${JSON.stringify(broken.referers)}`);
ok(broken.result.error === 4, 'without the meta the CDN blocks the stream (MEDIA_ELEMENT_ERROR code 4)', `error=${broken.result.error}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
