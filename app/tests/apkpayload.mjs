import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
// Smoke-check the payload that ships inside the APK. `npx cap sync android`
// copies `dist/` into `android/app/src/main/assets/public`, so serving `dist/`
// exercises the exact same bytes the WebView loads. Unlike tests/ui.spec.mjs,
// this stays shallow on purpose: it only proves the bundled payload boots and
// never points the player at the promo clip.
const chrome = process.env.CHROME_PATH ?? ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const adRequests = [];
await pg.route('**/macdn.aoneroom.com/other/**', r => { adRequests.push(r.request().url()); r.abort(); });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

await pg.goto('http://localhost:4173/#/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);
ok((await pg.locator('.poster-art').count()) > 0, 'Home renders posters');
const withArt = await pg.$$eval('.poster-art', els => els.filter(e => {
  const s = e.getAttribute('style') || '';
  return s.includes('data:image') || /url\("?https?:/.test(s);
}).length);
ok(withArt > 0, 'Posters carry artwork (' + withArt + ')');
ok((await pg.locator('.bottom-nav').count()) > 0, 'Bottom nav present');

for (const [name, route, sel] of [
  ['Search', '/#/search', '.search-bar'],
  ['Downloads', '/#/downloads', '.segmented'],
  ['Me', '/#/me', '.me-avatar'],
  ['NovelHub', '/#/novels', '.novel-card'],
  ['FightZone', '/#/fight', '.live-tag'],
  ['Shorts', '/#/shorts', '.short-side'],
  ['LiveTV', '/#/live', '.channel-card'],
  ['Settings', '/#/settings', '.set-group'],
  ['Browse', '/#/browse/movie', '.browse-grid'],
  ['Addons', '/#/addons', '.addon-card'],
  ['History', '/#/history', '.scroll'],
  ['Favorites', '/#/favorites', '.scroll'],
]) {
  await pg.goto('http://localhost:4173' + route, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(900);
  ok((await pg.locator(sel).count()) > 0, name + ' renders (' + sel + ')');
}

// Open a real feed title and confirm the bundled payload never selects the ad.
await pg.goto('http://localhost:4173/#/', { waitUntil: 'networkidle' });
await pg.waitForSelector('.rail-scroll .poster-card', { timeout: 15000 });
await pg.locator('.rail-scroll .poster-card').first().click();
await pg.waitForSelector('.detail-title', { timeout: 15000 });
await pg.locator('.detail-actions .btn-primary').click();
await pg.waitForTimeout(3000);
const src = await pg.locator('.vp-el').getAttribute('src').catch(() => null);
ok(!/macdn\.aoneroom\.com\/other\//.test(src ?? ''), 'Bundled payload does not select the promo clip');
ok(adRequests.length === 0, 'Bundled payload never requests the promo clip (' + adRequests.length + ')');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
errs.slice(0, 10).forEach(e => console.log(e));
await b.close();
process.exit(fail ? 1 : 0);
