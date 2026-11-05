import { chromium } from 'playwright';
// Verify the EXACT payload bundled into the APK (android/app/src/main/assets/public)
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const blocked = [];
await pg.route('**/*', r => {
  const u = r.request().url();
  if (u.startsWith('http://localhost:4173')) return r.continue();
  blocked.push(u); return r.abort();
});
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

await pg.goto('http://localhost:4173/#/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);
ok((await pg.locator('.poster-art').count()) > 0, 'Home renders posters');
const withArt = await pg.$$eval('.poster-art', els => els.filter(e => (e.getAttribute('style')||'').includes('data:image')).length);
ok(withArt > 0, 'Posters carry embedded artwork (' + withArt + ')');
ok((await pg.locator('.bottom-nav').count()) > 0, 'Bottom nav present');

for (const [name, route, sel] of [
  ['Detail', '/#/detail/tv01', '.ep-row'],
  ['Player', '/#/player/t01', '.player-scrub'],
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
ok(blocked.length === 0, 'No external requests needed (blocked=' + blocked.length + ')');
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
errs.slice(0, 10).forEach(e => console.log(e));
await b.close();
process.exit(fail ? 1 : 0);
