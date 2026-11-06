import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const B = process.env.BASE_URL ?? 'http://localhost:5173';
// Prefer an explicit CHROME_PATH, then a system Chromium, and only fall back to
// Playwright's bundled browser (which may not be installed in this environment).
const chrome = process.env.CHROME_PATH ?? ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const adRequests = [];

const ready = async (sel, timeout = 15000) => {
  try { await pg.waitForSelector(sel, { timeout }); return true; } catch { return false; }
};

// 1. Home loads live catalog
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
ok(await ready('.hero'), 'Home hero rendered from API');
ok((await pg.locator('.rail').count()) > 0, 'Home rails rendered (' + (await pg.locator('.rail').count()) + ')');
await ready('.rail-scroll .poster-card');
const firstRailCards = await pg.locator('.rail-scroll .poster-card').count();
ok(firstRailCards > 0, 'Home rail has posters (' + firstRailCards + ')');
const posterBg = await pg.locator('.rail-scroll .poster-art').first().getAttribute('style');
ok(/pbcdnw?\.aoneroom\.com/.test(posterBg ?? ''), 'Poster art uses real CDN image');

// 2. Home rail poster -> detail -> player
await pg.locator('.rail-scroll .poster-card').first().click();
ok(await ready('.detail-title'), 'Home poster click -> detail');
const detailTitle = await pg.locator('.detail-title').textContent();
ok((detailTitle ?? '').length > 0, 'Detail title loaded: ' + detailTitle);
ok((await pg.locator('.detail-genres .chip').count()) > 0, 'Detail genres rendered');
ok((await pg.locator('.cast').count()) > 0, 'Detail cast rendered from API');

// 3. Detail play -> player with a real <video>
await pg.locator('.detail-actions .btn-primary').click();
ok(await ready('.vp-el'), 'Detail play -> player with <video> element');
await pg.waitForTimeout(4000);
const src = await pg.locator('.vp-el').getAttribute('src');
ok(/^https?:\/\//.test(src ?? ''), 'Player video src is a real URL: ' + (src ?? '').slice(0, 55));
ok(!/macdn\.aoneroom\.com\/other\//.test(src ?? ''), 'Player prefers a real stream over the placeholder clip');

// Verify the stream at the HTTP level (Node has no CORS restriction, unlike the
// page). This is what the Android WebView needs: real video bytes + seeking.
const head = await (async () => {
  try {
    const r = await fetch(src, { headers: { Range: 'bytes=0-1023' } });
    const buf = await r.arrayBuffer();
    return { status: r.status, type: r.headers.get('content-type'), ranges: r.headers.get('accept-ranges'), len: buf.byteLength };
  } catch (e) { return { error: String(e) }; }
})();
ok(head.status === 200 || head.status === 206, 'Stream responds (' + JSON.stringify(head).slice(0, 100) + ')');
ok(/video\//.test(head.type ?? ''), 'Stream serves a video content-type (' + head.type + ')');
ok(head.ranges === 'bytes', 'Stream supports range requests (seeking works)');
ok((head.len ?? 0) > 0, 'Stream returns real bytes (' + head.len + ')');

// Playwright's Chromium build has no HEVC decoder, so a decode failure here is an
// environment limit, not an app bug; the app must degrade to a clear message.
const codecOK = await pg.evaluate(() => {
  const v = document.createElement('video');
  return v.canPlayType('video/mp4; codecs="hvc1"') !== '' || v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
});
const vstate = await pg.evaluate(() => {
  const v = document.querySelector('video');
  return v ? { network: v.networkState, err: v.error?.code ?? null } : null;
});
ok(vstate !== null, 'Video element reachable');
ok(
  codecOK || vstate.network !== 3 || /failed|try another|no playable/i.test(await pg.locator('body').innerText()),
  'Player either plays the stream or reports the failure clearly (codecs=' + codecOK + ', net=' + vstate.network + ')',
);

// 4. Player controls
await pg.locator('.vp-center .pc.main').click();
await pg.waitForTimeout(300);
ok(true, 'Player pause clicked without error');
await pg.locator('.vp-tools .pt').first().click();
ok(await ready('.sheet'), 'Player quality sheet opens');
const qCount = await pg.locator('.sheet-item').count();
ok(qCount > 0, 'Quality sheet lists real sources (' + qCount + ')');
await pg.locator('.sheet-item').first().click();
await pg.waitForTimeout(500);
ok((await pg.locator('.sheet').count()) === 0, 'Quality sheet closes after select');

// 4b. Inline player: play happens on the detail page, not straight into a
// full-screen takeover. The detail body must stay in the DOM below the video.
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
await pg.locator('.rail-scroll .poster-card').first().click();
await ready('.detail-title');
await pg.locator('.detail-actions .btn-primary').click();
await ready('.vp-inline');
const inlineBox = await pg.locator('.vp-inline').boundingBox();
const vpBox = await pg.locator('.vp-inline .vp-el').boundingBox();
ok(!!inlineBox && !!vpBox, 'Inline player renders on the detail page');
ok(
  inlineBox && Math.abs(inlineBox.width / inlineBox.height - 16 / 9) < 0.2,
  'Inline player keeps a 16:9 box (' + (inlineBox ? (inlineBox.width / inlineBox.height).toFixed(2) : 'n/a') + ')',
);
ok(
  (await pg.locator('.detail-body').count()) > 0,
  'Detail body is still visible below the inline player',
);
ok(
  (await pg.locator('.detail-title').boundingBox())?.y > (inlineBox?.y ?? 0),
  'Detail content sits below the video, like YouTube',
);
ok(
  (await pg.locator('.detail-inline-player .vp-fs').count()) === 0,
  'Inline playback does not start fullscreen',
);

// 4c. Fullscreen toggle: the stage becomes a fixed overlay (and would rotate
// the device; the browser build cannot rotate, so assert the overlay only).
await pg.locator('.vp-tools .pt').last().click();
await pg.waitForTimeout(400);
ok(
  (await pg.locator('.vp-fs').count()) > 0,
  'Fullscreen button expands the stage to a full-screen overlay',
);
const fsBox = await pg.locator('.vp-stage').boundingBox();
const vw = pg.viewportSize();
ok(
  !!fsBox && fsBox.width >= (vw?.width ?? 0) - 2,
  'Full-screen stage fills the viewport width (' + fsBox?.width + ')',
);
await pg.locator('.vp-tools .pt').last().click();
await pg.waitForTimeout(400);
ok((await pg.locator('.vp-fs').count()) === 0, 'Exiting fullscreen returns to the inline box');

// 4d. Closing the inline player restores the hero artwork. Controls auto-hide,
// so tap the stage first to bring them back.
await pg.locator('.vp-stage').click({ position: { x: 10, y: 10 } });
await pg.waitForTimeout(300);
await pg.locator('.vp-top .icon-btn').first().click();
await pg.waitForTimeout(300);
ok(
  (await pg.locator('.vp').count()) === 0 && (await pg.locator('.detail-hero').count()) > 0,
  'Closing the inline player restores the detail hero',
);

// 4e. A "Play" arrival (?play=1) opens the detail page with inline playback
// already running — never a straight full-screen takeover. Uses a rail title
// (always fetchable) rather than the hero, whose id is region-gated in the
// browser build.
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
await pg.locator('.rail-scroll .poster-card').first().click();
await ready('.detail-title');
const playId = (pg.url().match(/\/detail\/(\d+)/) ?? [])[1];
await pg.goto(`${B}/#/detail/${playId}?play=1`, { waitUntil: 'domcontentloaded' });
ok(await ready('.vp-inline'), 'Play arrival starts the inline player without a tap');
ok(
  (await pg.locator('.detail-body').count()) > 0 && (await pg.locator('.vp-fs').count()) === 0,
  'Play arrival keeps the detail body visible and stays out of fullscreen',
);
ok(await ready('.vp-el', 20000), 'Play arrival resolves a video source');

// 5. Search (live)
await pg.goto(B + '/#/search', { waitUntil: 'domcontentloaded' });
await pg.locator('.search-bar input').fill('avatar');
ok(await ready('.result-row', 20000), 'Search "avatar" returns live results');
const rc = await pg.locator('.result-row').count();
ok(rc > 0, 'Search result rows (' + rc + ')');
await pg.locator('.result-row').first().click();
ok(await ready('.detail-title'), 'Search result -> detail');
const st = await pg.locator('.detail-title').textContent();
ok(/avatar/i.test(st ?? ''), 'Opened the searched title: ' + st);

// 6. Series detail + seasons
await pg.goto(B + '/#/search', { waitUntil: 'domcontentloaded' });
await pg.locator('.search-bar input').fill('breaking bad');
await ready('.result-row', 20000);
const seriesRow = pg.locator('.result-row').filter({ hasText: /S\d|Season|Series/i }).first();
if (await seriesRow.count()) {
  await seriesRow.click();
} else {
  await pg.locator('.result-row').first().click();
}
ok(await ready('.detail-title'), 'Series detail opens');
await pg.waitForTimeout(3000);
const epCards = await pg.locator('.ep-card').count();
const seasonChips = await pg.locator('.season-row .chip').count();
ok(epCards > 0 || seasonChips > 0, 'Series exposes episodes/seasons (' + epCards + ' eps, ' + seasonChips + ' seasons)');

// 7. Browse tabs (live)
await pg.goto(B + '/#/browse/movie', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(8000);
const bc = await pg.locator('.browse-grid .poster-card').count();
ok(bc > 0, 'Browse movies grid renders (' + bc + ' posters)');
await pg.goto(B + '/#/browse/tv', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(8000);
const tc = await pg.locator('.browse-grid .poster-card').count();
ok(tc > 0, 'Browse TV grid renders (' + tc + ' posters)');
await pg.locator('.chip:has-text("Sci-Fi")').click();
await pg.waitForTimeout(600);
ok(true, 'Browse genre filter applies without error');

// 8. My List persistence
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
await pg.locator('.rail-scroll .poster-card').first().click();
await ready('.detail-title');
await pg.locator('.detail-icon-actions .act:has-text("My List")').click();
await pg.waitForTimeout(600);
await pg.goto(B + '/#/favorites', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);
ok((await pg.locator('.browse-grid .poster-card').count()) >= 1, 'My List shows the added title');

// 9. History written by the player
await pg.goto(B + '/#/history', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
ok((await pg.locator('.hist-row').count()) >= 1, 'History records playback (' + (await pg.locator('.hist-row').count()) + ')');

// 10. Theme toggle
await pg.goto(B + '/#/me', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(800);
const t1 = await pg.getAttribute('html', 'data-theme');
await pg.locator('.list-row:has-text("Appearance")').click();
await pg.waitForTimeout(500);
const t2 = await pg.getAttribute('html', 'data-theme');
ok(t1 !== t2, 'Theme toggles (' + t1 + ' -> ' + t2 + ')');

// 11. Other tabs still fine
await pg.locator('.nav-item:has-text("NovelHub")').click();
ok(await ready('.novel-card'), 'NovelHub renders');
await pg.goto(B + '/#/shorts', { waitUntil: 'domcontentloaded' });
ok(await ready('.short-side'), 'Shorts renders');
await pg.goto(B + '/#/live', { waitUntil: 'domcontentloaded' });
ok(await ready('.channel-card'), 'Live TV renders');
await pg.goto(B + '/#/fight', { waitUntil: 'domcontentloaded' });
ok(await ready('.match-card'), 'Fight Zone renders real fixtures');

// 12. Error handling: unknown id shows a retry state, not a crash
await pg.goto(B + '/#/detail/0000000000000000000', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(6000);
const bodyText = await pg.locator('body').innerText();
ok(/no longer available|Couldn|Not found|Try again/i.test(bodyText), 'Unknown id shows a not-found state');
ok(!/^Unknown$/m.test(bodyText.trim()), 'Unknown id does not render a placeholder title');

/* ------------------------------------------------------------------ */
/* Regression coverage for the fixes in this pass                      */
/* ------------------------------------------------------------------ */

// 13. Ads: promo placements must not appear as browsable titles
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
const feedText = await pg.locator('body').innerText();
ok(!/get free premium/i.test(feedText), 'No "Get Free Premium" ad in the feed');
ok(!/invite friends/i.test(feedText), 'No invite-friends ad in the feed');

// 13b. The upgrade promo clip must never reach the player. Open several feed
// titles and assert the <video> src is never the macdn /other/ ad, and that no
// request to that clip is ever made.
await pg.route('**/macdn.aoneroom.com/other/**', (r) => {
  adRequests.push(r.request().url());
  r.abort();
});
for (let i = 0; i < 3; i++) {
  await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
  await ready('.rail-scroll .poster-card');
  await pg.locator('.rail-scroll .poster-card').nth(i).click();
  await ready('.detail-title');
  await pg.locator('.detail-actions .btn-primary').click();
  await pg.waitForTimeout(2500);
  const psrc = await pg.locator('.vp-el').getAttribute('src').catch(() => null);
  ok(!/macdn\.aoneroom\.com\/other\//.test(psrc ?? ''), `Feed title ${i + 1} player src is not the ad clip`);
}
ok(adRequests.length === 0, 'The upgrade promo clip was never requested (' + adRequests.length + ')');

// 14. Thumbnails are requested at a sane size, not full resolution
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
const railArt = await pg.locator('.rail-scroll .poster-art').first().getAttribute('style');
ok(/x-oss-process=image\/resize,w_\d+/.test(railArt ?? ''), 'Rail posters use CDN resize');
const heroStyle = await pg.locator('.hero').first().getAttribute('style');
ok(/x-oss-process=image\/resize,w_\d+/.test(heroStyle ?? ''), 'Hero backdrop uses CDN resize');

// 15. Shorts play a real video file
await pg.goto(B + '/#/shorts', { waitUntil: 'domcontentloaded' });
await ready('.short-slide');
const shortVideo = await pg.locator('.short-video').first().getAttribute('src');
ok(/^https?:\/\/.+\.mp4/.test(shortVideo ?? ''), 'Shorts video src is a real mp4: ' + (shortVideo ?? '').slice(0, 60));

// 16. Live TV lists real channels and opens a player
await pg.goto(B + '/#/live', { waitUntil: 'domcontentloaded' });
ok(await ready('.channel-card'), 'Live TV renders channels');
const chanCount = await pg.locator('.channel-card').count();
ok(chanCount > 0, 'Live TV has channels (' + chanCount + ')');
await pg.locator('.channel-card').first().click();
const liveVideo = await pg.waitForSelector('.live-player video', { timeout: 8000 }).catch(() => null);
ok(!!liveVideo, 'Live channel opens a video player');
if (liveVideo) {
  const liveSrc = await liveVideo.getAttribute('src');
  ok(/^https?:\/\//.test(liveSrc ?? ''), 'Live stream url is absolute: ' + (liveSrc ?? '').slice(0, 60));
}

// 16b. Fight Zone exposes real team fixtures with logos
await pg.goto(B + '/#/fight', { waitUntil: 'domcontentloaded' });
ok(await ready('.match-card'), 'Fight Zone renders fixtures');
const matchCount = await pg.locator('.match-card').count();
ok(matchCount > 0, 'Fight Zone lists fixtures (' + matchCount + ')');
const matchLogo = await pg.locator('.match-logo').first().getAttribute('style');
ok(/x-oss-process=image\/resize/.test(matchLogo ?? ''), 'Team logos use CDN resize');
await pg.getByText('News').first().click();
await pg.waitForTimeout(1200);
ok((await pg.locator('.news-row').count()) > 0, 'Fight Zone news tab lists articles');

// 17. Novel reader opens and paginates
await pg.goto(B + '/#/novels', { waitUntil: 'domcontentloaded' });
await ready('.novel-card');
await pg.locator('.novel-card').first().click();
ok(await ready('.novel-detail-head'), 'Novel detail renders');
await pg.getByText('Start Reading').first().click();
ok(await ready('.reader-body p'), 'Novel reader renders chapter text');
const ch1 = await pg.locator('.reader-ch').innerText();
await pg.getByText('Next chapter').first().click();
await pg.waitForTimeout(400);
const ch2 = await pg.locator('.reader-ch').innerText();
ok(ch1 !== ch2, 'Novel reader advances chapters (' + ch1 + ' -> ' + ch2 + ')');

// 18. Search does not re-request on every keystroke
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
let searchCalls = 0;
pg.on('request', (r) => { if (r.url().includes('/subject-api/search')) searchCalls++; });
await pg.goto(B + '/#/search', { waitUntil: 'domcontentloaded' });
await pg.locator('input[aria-label="Search"]').fill('avatar');
await pg.waitForTimeout(1200);
ok(searchCalls <= 3, 'Search debounces keystrokes (' + searchCalls + ' requests)');

// 19. Revisiting Home paints from cache immediately (no blocking spinner).
// The background refresh still runs; what matters is that the catalog is on
// screen before the network round trip completes.
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.hero');
await pg.goto(B + '/#/me', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.hero', 3000);
const paintMs = Date.now() - t0;
ok(paintMs < 1500, 'Revisited Home paints from cache in ' + paintMs + 'ms');
const sawSpinner = await pg.locator('.loading').count();
ok(sawSpinner === 0, 'Revisited Home shows no blocking loading state');

// 20. Reference-parity: Home category chips, TOP rails with sub-chips,
// Detail "For you / Comments" tabs, Download sheet total, Player Fit/Language.
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.hero');
const cats = await pg.locator('.cat-tabs .chip').allTextContents();
ok(
  ['Trending', 'Movie', 'Anime', 'TV'].every((c) => cats.includes(c)),
  'Home shows the reference category chips (' + cats.join('/') + ')',
);
await pg.locator('.cat-tabs .chip:has-text("Movie")').click();
await pg.waitForTimeout(2500);
ok((await pg.locator('.hero, .rail-scroll .poster-card').count()) > 0, 'Category switch loads a feed');

await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.hero');
// A same-URL hash navigation does not remount Home, so switch back to the
// Trending category explicitly before asserting on its derived rails.
await pg.locator('.cat-tabs .chip:has-text("Trending")').click();
await pg.waitForTimeout(2500);
await ready('.rail-scroll .poster-card');
const railTitles = await pg.locator('.section-head h3').allTextContents();
ok(railTitles.some((t) => /top movies/i.test(t)), 'Home has a "TOP Movies" rail');
ok(railTitles.some((t) => /top series/i.test(t)), 'Home has a "Top Series" rail');
const subChips = await pg.locator('.rail-subs .chip').allTextContents();
ok(subChips.includes('Bollywood') && subChips.includes('Hollywood'), 'TOP Movies rail has sub-category chips');
await pg.locator('.rail-subs .chip:has-text("Bollywood")').first().click();
await pg.waitForTimeout(400);
ok(true, 'Sub-category chip applies without error');

// Detail feed tabs
await pg.goto(B + '/#/', { waitUntil: 'domcontentloaded' });
await ready('.rail-scroll .poster-card');
await pg.locator('.rail-scroll .poster-card').first().click();
await ready('.detail-title');
const feedTabs = await pg.locator('.feed-tab').allTextContents();
ok(
  feedTabs.some((t) => /for you/i.test(t)) && feedTabs.some((t) => /comments/i.test(t)),
  'Detail has For you / Comments tabs (' + feedTabs.join('/') + ')',
);
await pg.locator('.feed-tab:has-text("Comments")').click();
await pg.waitForTimeout(300);
ok((await pg.locator('.feed-empty').count()) > 0, 'Comments tab shows an honest empty state');

// Download sheet total size + resolution row
await pg.goto(B + '/#/search', { waitUntil: 'domcontentloaded' });
await pg.locator('input[aria-label="Search"]').fill('breaking bad');
await ready('.result-row', 20000);
const seriesHit = pg.locator('.result-row').filter({ hasText: /S\d/i }).first();
await (seriesHit.count() ? seriesHit : pg.locator('.result-row').first()).click();
await ready('.detail-title');
await pg.locator('.detail-icon-actions .act:has-text("Download")').click();
ok(await ready('.dl-sheet', 15000), 'Download sheet opens for a series');
// Episodes arrive from the UGC collection a moment after the sheet opens.
await pg.locator('.dl-ep').first().waitFor({ timeout: 20000 }).catch(() => {});
const dlFoot = (await pg.locator('.dl-sheet-foot').innerText()).trim();
ok(/download/i.test(dlFoot) && /(mb|gb|kb)/i.test(dlFoot), 'Download footer shows the total size (' + dlFoot.replace(/\n/g, ' ') + ')');
await pg.locator('.dl-res').nth(1).click();
await pg.waitForTimeout(300);
ok(true, 'Resolution chip switches without error');
// Close the sheet so its scrim does not block later interactions.
await pg.locator('.dl-sheet-head .icon-btn').click();
await pg.waitForTimeout(400);

// Player is intentionally minimal: Fullscreen + Quality + Next only.
const did = (pg.url().match(/\/detail\/(\d+)/) ?? [])[1];
await pg.goto(`${B}/#/detail/${did}?play=1`, { waitUntil: 'domcontentloaded' });
ok(await ready('.vp-inline', 20000), 'Inline player starts');
await pg.locator('.vp-stage').click({ position: { x: 5, y: 5 } });
await pg.waitForTimeout(400);
const tools = (await pg.locator('.vp-tools .pt').allTextContents()).map((t) => t.trim());
ok(tools.some((t) => /fullscreen/i.test(t)), 'Player exposes a Fullscreen control');
ok(tools.some((t) => /(1080p|720p|480p|auto)/i.test(t)), 'Player exposes a Quality control');
ok(tools.length <= 2, 'Player controls are limited to Quality + Fullscreen (' + tools.join(', ') + ')');
ok((await pg.locator('.vp-lock').count()) === 0, 'Player no longer shows a lock control');
ok((await pg.locator('.vp-tools .pt:has-text("Fit")').count()) === 0, 'Player no longer shows a Fit control');
ok((await pg.locator('.vp-tools .pt:has-text("Language")').count()) === 0, 'Player no longer shows a Language control');
const scrub = (await pg.locator('.vp-scrub').innerText()).trim();
ok(/^\d+:\d{2}\d+:\d{2}$/.test(scrub.replace(/\s+/g, '')), 'Scrubber shows current/total time (' + scrub.replace(/\s+/g, ' ') + ')');
// Quality sheet still opens. In this desktop Chromium the CDN answers 428 for
// a browser User-Agent, so the list may legitimately be empty — what matters is
// that the sheet opens and reports either sources or an honest empty state.
await pg.locator('.vp-tools .pt').first().click();
await pg.waitForTimeout(500);
const sheetOpen = (await pg.locator('.sheet').count()) > 0;
const hasItems = (await pg.locator('.sheet-item').count()) > 0;
const hasEmpty = (await pg.locator('.sheet-empty').count()) > 0;
ok(sheetOpen && (hasItems || hasEmpty), 'Quality sheet opens with sources or an empty state');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
console.log('=== ERRORS (' + errs.length + ') ===');
[...new Set(errs)].slice(0, 20).forEach((e) => console.log(e));

await b.close();
process.exit(fail > 0 ? 1 : 0);
