// Full end-to-end playback test against the built app (dist/) in real Chromium.
// Boots the SPA, opens a title, lands on the player and proves the CDN stream
// decodes. The document is served from an https://localhost origin with the
// app's no-referrer meta and the app User-Agent, exactly like the Android
// WebView, so a passing run means the device path works.
import { chromium } from 'playwright';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'dist';
const appUa = JSON.parse(readFileSync('capacitor.config.json', 'utf8')).android.overrideUserAgent;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/e2e-key.pem -out /tmp/e2e-cert.pem -days 1 -subj "/CN=localhost" 2>/dev/null');
const server = https.createServer(
  { key: readFileSync('/tmp/e2e-key.pem'), cert: readFileSync('/tmp/e2e-cert.pem') },
  (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = join(ROOT, p);
    if (!existsSync(f) || statSync(f).isDirectory()) f = join(ROOT, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  },
);
await new Promise((r) => server.listen(8443, r));

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--ignore-certificate-errors', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ userAgent: appUa, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const mediaRefs = [];
page.on('request', (r) => { if (/hakunaymatata\.com/.test(r.url())) mediaRefs.push(r.headers()['referer'] ?? null); });

await page.goto('https://localhost:8443/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.poster-card', { timeout: 90000 });
console.log('home rendered');

// Open the first title card.
await page.click('.poster-card');
await page.waitForURL(/\/detail\//, { timeout: 60000 });
console.log('detail:', new URL(page.url()).pathname);

// Press play on the detail screen. Playback now starts inline on the detail
// page (YouTube-style) instead of jumping to a full-screen route.
await page.click('.detail-actions .btn-primary');
await page.waitForSelector('.vp-inline video', { timeout: 60000 });
console.log('inline player on:', new URL(page.url()).pathname);

// Wait for the <video> to receive data.
const res = await page.evaluate(async () => {
  const v = document.querySelector('video');
  if (!v) return { missing: true };
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (v.readyState >= 2 && v.duration > 0) break;
    if (v.error) return { error: v.error.code, readyState: v.readyState };
    await new Promise((r) => setTimeout(r, 500));
  }
  let played = false;
  try { await v.play(); played = true; } catch {}
  await new Promise((r) => setTimeout(r, 4000));
  return { readyState: v.readyState, error: v.error ? v.error.code : null, duration: v.duration, currentTime: v.currentTime, played };
});
console.log('video =', JSON.stringify(res));
console.log('CDN referers =', JSON.stringify(mediaRefs.slice(-5)));

const pass = res && !res.missing && res.error === null && res.duration > 60 && res.played && mediaRefs.length > 0 && mediaRefs.every((r) => !r);
console.log(pass ? '\nPASS: stream plays end-to-end with no Referer' : '\nFAIL');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
