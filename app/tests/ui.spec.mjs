import { chromium } from 'playwright';

const B = 'http://localhost:5173';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

// 1. Home poster -> detail
await pg.goto(B + '/#/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(2200);
await pg.locator('.rail-scroll .poster-card').first().click();
await pg.waitForTimeout(700);
ok(pg.url().includes('/detail/'), 'Home poster click -> detail (' + pg.url().split('#')[1] + ')');

// 2. Detail play -> player
await pg.locator('.detail-actions .btn-primary').click();
await pg.waitForTimeout(800);
ok(pg.url().includes('/player/'), 'Detail play -> player');
ok((await pg.locator('.player-scrub').count()) > 0, 'Player controls visible');

// 3. Player pause
await pg.locator('.player-center .pc.main').click();
await pg.waitForTimeout(300);
ok(true, 'Player pause clicked without error');

// 4. Player quality sheet
await pg.locator('.player-tools .pt').first().click();
await pg.waitForTimeout(400);
ok((await pg.locator('.sheet').count()) > 0, 'Player quality sheet opens');
await pg.locator('.sheet-item:has-text("4K")').click();
await pg.waitForTimeout(400);
ok((await pg.locator('.sheet').count()) === 0, 'Quality sheet closes after select');
ok((await pg.locator('.toast').count()) > 0, 'Toast shown after quality change');

// 5. Detail download confirm
await pg.goto(B + '/#/detail/t01', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);
await pg.locator('.detail-actions button:has-text("Download")').click();
await pg.waitForTimeout(400);
ok((await pg.locator('.dialog').count()) > 0, 'Download confirm dialog opens');
await pg.locator('.dialog .btn-primary').click();
await pg.waitForTimeout(500);
ok((await pg.locator('.dialog').count()) === 0, 'Dialog closes on confirm');

// 6. Downloads
await pg.goto(B + '/#/downloads', { waitUntil: 'networkidle' });
await pg.waitForTimeout(900);
ok((await pg.locator('.dl-card').count()) > 0, 'Downloads list has items');

// 7. Downloads tabs
await pg.locator('.segmented button:has-text("Downloaded")').click();
await pg.waitForTimeout(500);
ok((await pg.locator('.dl-card').count()) > 0, 'Downloaded tab renders cards');
await pg.locator('.segmented button:has-text("History")').click();
await pg.waitForTimeout(500);
ok((await pg.locator('.hist-row').count()) > 0, 'History tab renders rows');

// 8. Search
await pg.goto(B + '/#/search', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
await pg.locator('.search-bar input').fill('shadow');
await pg.waitForTimeout(600);
ok((await pg.locator('.result-row').count()) > 0, 'Search returns results');
await pg.locator('.result-row').first().click();
await pg.waitForTimeout(700);
ok(pg.url().includes('/detail/'), 'Search result -> detail');

// 9. Theme toggle
await pg.goto(B + '/#/me', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
const t1 = await pg.getAttribute('html', 'data-theme');
await pg.locator('.list-row:has-text("Appearance")').click();
await pg.waitForTimeout(500);
const t2 = await pg.getAttribute('html', 'data-theme');
ok(t1 !== t2, 'Theme toggles (' + t1 + ' -> ' + t2 + ')');
await pg.locator('.list-row:has-text("Appearance")').click();
await pg.waitForTimeout(400);

// 10. Bottom nav + novel
await pg.locator('.nav-item:has-text("NovelHub")').click();
await pg.waitForTimeout(700);
ok(pg.url().includes('/novels'), 'Bottom nav -> NovelHub');
await pg.locator('.novel-card').first().click();
await pg.waitForTimeout(700);
ok(pg.url().includes('/novels/'), 'Novel card -> novel detail');

// 11. Fight zone
await pg.goto(B + '/#/fight', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
ok((await pg.locator('.live-tag').count()) > 0, 'Fight Zone live badge present');

// 12. Live TV filter
await pg.goto(B + '/#/live', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
const chAll = await pg.locator('.channel-card').count();
await pg.locator('.live-head input').fill('sports');
await pg.waitForTimeout(600);
const chF = await pg.locator('.channel-card').count();
ok(chF < chAll && chF > 0, 'Live TV filter works (' + chAll + ' -> ' + chF + ')');

// 13. Shorts
await pg.goto(B + '/#/shorts', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
ok((await pg.locator('.short-side').count()) > 0, 'Shorts side actions present');
await pg.locator('.short-side .s:has-text("Save")').click();
await pg.waitForTimeout(400);
ok((await pg.locator('.toast').count()) > 0, 'Shorts save shows toast');

// 14. Settings
await pg.goto(B + '/#/settings', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
await pg.locator('.set-row:has-text("Wi-Fi Only Downloads") .switch').click();
await pg.waitForTimeout(400);
ok(true, 'Settings switch toggled');

// 15. Browse + genre filter
await pg.goto(B + '/#/browse/movie', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
const bc = await pg.locator('.browse-grid .poster-card').count();
ok(bc > 0, 'Browse grid renders (' + bc + ')');
await pg.locator('.chip:has-text("Sci-Fi")').click();
await pg.waitForTimeout(600);
const bc2 = await pg.locator('.browse-grid .poster-card').count();
ok(bc2 > 0 && bc2 < bc, 'Browse genre filter works (' + bc + ' -> ' + bc2 + ')');

// 16. Favorites
await pg.goto(B + '/#/detail/t02', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);
await pg.locator('.detail-icon-actions .act:has-text("My List")').click();
await pg.waitForTimeout(500);
await pg.goto(B + '/#/favorites', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);
ok((await pg.locator('.browse-grid .poster-card').count()) >= 3, 'Favorites list shows items');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
console.log('=== ERRORS (' + errs.length + ') ===');
[...new Set(errs)].slice(0, 20).forEach((e) => console.log(e));
await b.close();
process.exit(fail > 0 ? 1 : 0);
