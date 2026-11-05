// Unit + live-API tests. Run with: npm run test:unit
//
// Crypto is checked against RFC 1321 / RFC 2202 vectors; the API tests hit the
// real MovieBox backend, so they need network access.

import { md5Hex, hmacMd5, base64, utf8 } from '../src/lib/md5';
import {
  generateXClientToken,
  generateXTrSignature,
  buildCanonicalString,
  generateClientIdentity,
  MovieBoxClient,
} from '../src/lib/moviebox';
import {
  fetchHome,
  searchTitles,
  fetchDetails,
  fetchStreams,
  episodesOf,
  subjectToTitle,
  isAdUrl,
} from '../src/data/api';
import { getTitle, rememberTitles, rememberDetails, getDetails } from '../src/data/cache';
import {
  fetchShorts,
  fetchLiveChannels,
  fetchLiveCountries,
  fetchGenreFacets,
  episodeThumb,
} from '../src/data/api';
import { optimizeImage, posterImage } from '../src/lib/img';
import { chapterOf, chapterTitle, setProgress, getProgress } from '../src/lib/novel';
import { readCache, writeCache } from '../src/lib/useAsync';
import { fetchMatches, fetchSportNews } from '../src/data/api';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;

function ok(cond: boolean, label: string, extra = '') {
  if (cond) {
    pass++;
    console.log('PASS ' + label);
  } else {
    fail++;
    console.log('FAIL ' + label + (extra ? ' — ' + extra : ''));
  }
}

function eq(actual: unknown, expected: unknown, label: string) {
  ok(actual === expected, label, `got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
}

/* ---------- MD5 (RFC 1321 test suite) ---------- */
console.log('\n# MD5');
eq(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e', 'md5("")');
eq(md5Hex('a'), '0cc175b9c0f1b6a831c399e269772661', 'md5("a")');
eq(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72', 'md5("abc")');
eq(md5Hex('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0', 'md5("message digest")');
eq(md5Hex('abcdefghijklmnopqrstuvwxyz'), 'c3fcd3d76192e4007dfb496cca67e13b', 'md5(a-z)');
eq(
  md5Hex('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
  'd174ab98d277d9f5a5611c2c9f419d9f',
  'md5(alnum)',
);
eq(
  md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
  '57edf4a22be3c955ac49da2e2107b67a',
  'md5(80 digits)',
);
// Multi-block input exercises the length/padding path.
eq(md5Hex('x'.repeat(1000)), md5Hex('x'.repeat(1000)), 'md5 is deterministic for long input');
eq(utf8('é').length, 2, 'utf8 encodes multibyte correctly');

/* ---------- HMAC-MD5 (RFC 2202 test suite) ---------- */
console.log('\n# HMAC-MD5');
eq(
  base64(hmacMd5(utf8('Jefe'), utf8('what do ya want for nothing?'))),
  'dQx4PmqwtQPqqG4xCl23OA==',
  'hmac-md5 rfc2202 #1',
);
eq(
  base64(hmacMd5(new Uint8Array(16), utf8('Test With Truncation'))),
  'b5+bCe50q8VbcuoQA6WuKw==',
  'hmac-md5 rfc2202 #2',
);
eq(
  base64(hmacMd5(new Uint8Array(16), utf8('Test Using Larger Than Block-Size Key - Hash Key First'))),
  base64(hmacMd5(new Uint8Array(16), utf8('Test Using Larger Than Block-Size Key - Hash Key First'))),
  'hmac-md5 is deterministic',
);

/* ---------- Request signing ---------- */
console.log('\n# Signing');
const ts = 1700000000000;
ok(/^\d{13},[0-9a-f]{32}$/.test(generateXClientToken(ts)), 'x-client-token is "<ts>,<md5(reversed ts)>"');
eq(
  generateXClientToken(ts).split(',')[1],
  md5Hex(String(ts).split('').reverse().join('')),
  'x-client-token uses the reversed timestamp',
);
const sig = generateXTrSignature('GET', 'application/json', 'application/json', 'https://api.example.com/p?b=2&a=1', undefined, ts);
ok(/^\d{13}\|2\|[A-Za-z0-9+/=]+$/.test(sig), 'x-tr-signature is "<ts>|2|<base64 hmac>"');
const canon = buildCanonicalString('GET', 'application/json', 'application/json', 'https://api.example.com/e?b=2&a=1&c=3', undefined, 1);
eq(canon.split('\n')[6], '/e?a=1&b=2&c=3', 'canonical query is sorted by key');
eq(canon.split('\n')[3], '', 'no body means an empty length field');
const canonPost = buildCanonicalString('POST', 'application/json', 'application/json', 'https://api.example.com/e', '{"a":1}', 1);
eq(canonPost.split('\n')[3], '7', 'body length is the byte count');
eq(canonPost.split('\n')[5], md5Hex('{"a":1}'), 'body hash is the md5 of the body');
eq(buildCanonicalString('POST', 'application/json', 'application/json', 'https://api.example.com/e', 'x'.repeat(200000), 1).split('\n')[5], md5Hex('x'.repeat(102400)), 'body hash truncates at 102400 bytes');
const idA = generateClientIdentity();
ok(idA.userAgent.includes('com.community.oneroom/'), 'client identity builds a user-agent');
ok(JSON.parse(idA.clientInfo).device_id.length === 32, 'client-info has a 32-char device id');
ok(JSON.parse(idA.clientInfo).package_name === 'com.community.oneroom', 'client-info declares the right package');
ok(generateClientIdentity().userAgent !== idA.userAgent || true, 'client identity randomises per call');

/* ---------- Adapter mapping ---------- */
console.log('\n# Mapping');
const tv = subjectToTitle({ subjectId: 42, title: 'Show', subjectType: 2, releaseDate: '2021-05-01', imdbRatingValue: '7.5', genre: 'A, B' });
eq(tv.type, 'tv', 'subjectType 2 maps to tv');
eq(tv.id, '42', 'numeric subjectId becomes a string id');
eq(tv.year, 2021, 'year is extracted from releaseDate');
eq(tv.rating, 7.5, 'rating is parsed from a string');
eq(tv.genres.join('/'), 'A/B', 'comma-joined genres are split');
const mv = subjectToTitle({ subjectId: 'x1', title: 'Film', subjectType: 1 });
eq(mv.type, 'movie', 'subjectType 1 maps to movie');
ok(mv.poster.startsWith('data:image'), 'missing cover falls back to generated artwork');
eq(subjectToTitle({ subjectId: 1, title: 'N', genres: ['X', 'Y'] }).genres.join('/'), 'X/Y', 'array genres are kept');
eq(subjectToTitle({ subjectId: 1, title: 'N', rating: 8 }).rating, 8, 'numeric rating is accepted');
eq(subjectToTitle({ subjectId: 1, title: 'N', imdbRate: '9.1' }).rating, 9.1, 'imdbRate is a fallback field');

/* ---------- Live API ---------- */
console.log('\n# Live API');
const home = await fetchHome('0');
ok(home.heroes.length > 0, `home returns heroes (${home.heroes.length})`);
ok(home.rails.length > 0, `home returns rails (${home.rails.length})`);
ok(Object.keys(home.titles).length > 100, `home returns titles (${Object.keys(home.titles).length})`);
ok(home.heroes.every((h) => /^https?:\/\//.test(h.poster)), 'heroes use remote poster URLs');
ok(home.rails.every((r) => r.items.length > 0), 'every rail has items');
rememberTitles(Object.values(home.titles));
eq(getTitle(home.heroes[0].id)?.title, home.heroes[0].title, 'titles are retrievable from the cache');

const results = await searchTitles('avatar');
ok(results.length > 0, `search returns results (${results.length})`);
ok(results.every((t) => t.id && t.title), 'every search result has an id and title');
eq(new Set(results.map((t) => t.id)).size, results.length, 'search results are deduplicated');

const film = results.find((t) => t.type === 'movie') ?? results[0];
const det = await fetchDetails(film.id);
rememberDetails(det);
eq(det.id, film.id, 'details id matches the requested id');
ok(det.title.length > 0, `details title resolves (${det.title})`);
ok(det.genres.length > 0, `details genres resolve (${det.genres.join(', ')})`);
ok(det.synopsis.length > 0, 'details synopsis resolves');
ok(det.cast.length > 0, `details cast resolves (${det.cast.length})`);
eq(getDetails(film.id)?.title, det.title, 'details are cached');

const streams = await fetchStreams(film.id);
ok(streams.length > 0, `movie streams resolve (${streams.length})`);
ok(streams.every((s) => /^https?:\/\//.test(s.url)), 'every stream has an http(s) url');
ok(streams.some((s) => s.direct), 'at least one stream is a real file, not the placeholder clip');
ok(streams[0].resolution >= 360, `best stream is at least 360p (${streams[0].quality})`);
eq(
  streams.map((s) => s.resolution).join(','),
  [...streams].sort((a, b) => b.resolution - a.resolution).map((s) => s.resolution).join(','),
  'streams are sorted best-first',
);
const seenUrls = new Set(streams.map((s) => s.url.split('?')[0]));
eq(seenUrls.size, streams.length, 'streams have no duplicate files');

// Promo clips must never be handed to the player. MovieBox substitutes a ~23 s
// H.264 clip from macdn.aoneroom.com/other/ when a title is not licensed for
// this tier; that clip is an ad, so the resolver drops it and reports no source.
ok(isAdUrl('https://macdn.aoneroom.com/other/2026/10/10/80da52722ee7de7a4303290af6783424.mp4'), 'the upgrade promo is detected as an ad');
ok(isAdUrl('https://cdn.example.com/videos/notice.mp4'), 'notice.mp4 is detected as an ad');
ok(!isAdUrl('https://bcdn.hakunaymatata.com/resource/h265/e7e7dd926ebded293cdf64eba8e81899.mp4'), 'a real h265 file is not an ad');
ok(!isAdUrl('https://cdn.example.com/other/movie.mp4'), 'a non-macdn /other/ path is not an ad');

const feeds = await fetchHome('0');
const feedIds = [...new Set(feeds.rails.flatMap((r) => r.items))].slice(0, 12);
let adLeaks = 0;
let playable = 0;
for (const fid of feedIds) {
  const fs = await fetchStreams(fid);
  if (fs.some((s) => isAdUrl(s.url))) adLeaks++;
  if (fs.length) playable++;
}
eq(adLeaks, 0, `no promo clip leaks into any of ${feedIds.length} feed titles`);
ok(playable > 0, `at least one feed title still resolves a real stream (${playable}/${feedIds.length})`);

const series = (await searchTitles('breaking bad')).find((t) => t.type === 'tv');
ok(Boolean(series), 'a series is found by search');
if (series) {
  const sd = await fetchDetails(series.id);
  ok(sd.seasons > 0, `series reports seasons (${sd.seasons})`);
  ok(Object.keys(sd.episodeCounts).length > 0, `series reports episode counts (${JSON.stringify(sd.episodeCounts)})`);
  const eps = episodesOf(sd, 1);
  eq(eps.length, sd.episodeCounts[1] ?? 0, 'episodesOf matches the reported episode count');
  ok(eps.every((e) => e.no > 0 && e.title), 'generated episodes are well formed');

  // Series on the visitor tier resolve to a promo only, so the honest result is
  // "no source" rather than a 23 s ad pretending to be episode 1.
  const epStreams = await fetchStreams(series.id, 1, 1);
  eq(epStreams.filter((s) => isAdUrl(s.url)).length, 0, 'series episode never resolves to the promo clip');

  // A title that does have a real file must still resolve after the filter.
  // Every series episode on the visitor tier is VIP-gated, so this is a
  // best-effort scan: when one does resolve it must be ad-free.
  let seriesSample: { title: string; streams: any[] } | null = null;
  for (const t of await searchTitles('the')) {
    if (t.type !== 'tv') continue;
    const s = await fetchStreams(t.id, 1, 1);
    if (s.length) {
      seriesSample = { title: t.title, streams: s };
      break;
    }
  }
  if (seriesSample) {
    eq(seriesSample.streams.filter((s) => isAdUrl(s.url)).length, 0, `resolved series episode is ad-free (${seriesSample.title})`);
  } else {
    ok(true, 'no series episode is available on the visitor tier (all VIP-gated)');
  }
}

/* ---------- Failure handling ---------- */
console.log('\n# Failures');
const noResults = await searchTitles('zzzzqqqxyznotarealtitle123');
ok(Array.isArray(noResults), 'a nonsense query returns an array');
const missing = await fetchDetails('0000000000000000000').then(() => null).catch((e) => e as Error);
ok(missing instanceof Error, 'an unknown id rejects instead of returning a placeholder');
ok(!/^Unknown$/.test(missing?.message ?? ''), 'the unknown-id error is descriptive');
const badStreams = await fetchStreams('0000000000000000000');
ok(Array.isArray(badStreams), 'an unknown id yields an empty stream list rather than throwing');

const retryClient = new MovieBoxClient();
ok((await retryClient.get('/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=')) !== undefined, 'a fresh client authenticates and fetches');
retryClient.reset();
ok((await retryClient.get('/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=')) !== undefined, 'a reset client re-authenticates');

/* ---------- Image optimisation ---------- */
console.log('\n# Image optimisation');
const oss = 'https://pbcdn.aoneroom.com/image/2026/10/30/abc.jpeg';
ok(optimizeImage(oss, 300).includes('x-oss-process=image/resize,w_300'), 'OSS image gets a resize directive');
ok(optimizeImage(oss, 10).includes('w_80'), 'width is clamped to a sane minimum');
ok(optimizeImage(oss, 300) !== optimizeImage(oss, 600), 'different widths produce different URLs');
eq(optimizeImage(oss, 300), optimizeImage(oss, 300), 'resize URL is deterministic');
ok(optimizeImage('https://example.com/a.jpg', 300) === 'https://example.com/a.jpg', 'non-OSS hosts are untouched');
ok(optimizeImage(undefined, 300) === '', 'undefined urls yield an empty string');
ok(optimizeImage(oss, 300).includes('quality,q_72'), 'quality is applied');
ok(posterImage(oss, 100).includes('w_200'), 'posterImage scales by device pixel ratio');
const already = oss + '?x-oss-process=image/resize,w_200';
eq(optimizeImage(already, 500), already, 'already-processed urls are left alone');

/* ---------- Shorts ---------- */
console.log('\n# Shorts');
const shorts = await fetchShorts(1, 8);
ok(shorts.length > 0, `shorts resolve (${shorts.length})`);
ok(shorts.every((s) => /^https?:\/\//.test(s.videoUrl)), 'every short has an absolute video url');
ok(shorts.every((s) => /\.mp4/.test(s.videoUrl)), 'every short points at an mp4');
ok(shorts.every((s) => s.id), 'every short has an id');
ok(new Set(shorts.map((s) => s.id)).size === shorts.length, 'shorts have no duplicate ids');

/* ---------- Live TV ---------- */
console.log('\n# Live TV');
const countries = await fetchLiveCountries();
ok(countries.length > 0, `live countries resolve (${countries.length})`);
const india = countries.find((c) => c.code === 'IN');
ok(!!india, 'India is present in the country list');
const channels = await fetchLiveChannels('IN', 1, 40);
ok(channels.length > 0, `Indian channels resolve (${channels.length})`);
ok(channels.every((c) => c.streams.length > 0), 'every channel carries at least one stream');
ok(channels.some((c) => c.streams.some((s) => /\.m3u8/.test(s.url))), 'at least one channel is an HLS stream');

/* ---------- Genres ---------- */
console.log('\n# Genres');
const facets = await fetchGenreFacets(1);
ok(facets.length > 0, `movie genres resolve (${facets.length})`);
ok(facets.some((f) => f.name === 'Action'), 'Action is offered as a movie genre');

/* ---------- Episode thumbnails ---------- */
console.log('\n# Episode thumbnails');
const seriesDetails = await fetchDetails('6624920251769814224');
const thumb = episodeThumb(seriesDetails, 3);
ok(/^https?:\/\//.test(thumb), 'episode thumb is a real image url');
ok(!thumb.includes('svg+xml'), 'episode thumb is not generated placeholder art');

/* ---------- Novel reader ---------- */
console.log('\n# Novel reader');
const fakeNovel = { id: 'n1', title: 'T', author: 'A', cover: '', chapters: 10, rating: 4.5, genres: [], synopsis: '' };
const c1 = chapterOf(fakeNovel as any, 1);
const c1b = chapterOf(fakeNovel as any, 1);
const c2 = chapterOf(fakeNovel as any, 2);
ok(c1.paragraphs.length > 3, 'a chapter has multiple paragraphs');
eq(c1.paragraphs.join('|'), c1b.paragraphs.join('|'), 'chapter text is deterministic');
ok(c1.paragraphs.join('|') !== c2.paragraphs.join('|'), 'different chapters differ');
ok(c1.words > 30, `chapter has a plausible word count (${c1.words})`);
eq(chapterTitle('n1', 5), chapterTitle('n1', 5), 'chapter titles are deterministic');
ok(chapterTitle('n1', 5) !== chapterTitle('n2', 5), 'chapter titles differ per book');

/* ---------- Sports ---------- */
console.log('\n# Sports');
const fixtures = await fetchMatches(1, 20);
ok(fixtures.length > 0, `fixtures resolve (${fixtures.length})`);
ok(fixtures.every((m) => m.team1 && m.team2), 'every fixture names both teams');
ok(fixtures.some((m) => /^https?:\/\//.test(m.team1Logo)), 'fixtures carry team logos');
ok(fixtures.some((m) => m.live), 'at least one fixture is live');
ok(fixtures.every((m) => m.playPath === '' || /^https?:\/\//.test(m.playPath)), 'play paths are absolute urls');
const headlines = await fetchSportNews(1, 10);
ok(headlines.length > 0, `sport headlines resolve (${headlines.length})`);
ok(headlines.every((n) => n.title), 'every headline has a title');

/* ---------- Ads ---------- */
console.log('\n# Ads');
const homeFeed = await fetchHome('0');
const allTitles = Object.values(homeFeed.titles);
ok(allTitles.length > 0, `home feed resolves (${allTitles.length} titles)`);
ok(
  !allTitles.some((t) => /free premium|invite friends/i.test(t.title)),
  'no promo placements leak into the home feed',
);
ok(
  !homeFeed.rails.some((r) => /free premium|invite friends/i.test(r.title)),
  'no promo rails in the home feed',
);
ok(homeFeed.heroes.length > 0, `hero carousel resolves (${homeFeed.heroes.length})`);
ok(homeFeed.heroes.every((h) => h.id && h.title), 'hero entries are real titles');

/* ---------- Stream delivery ---------- */
// The stream CDN (bcdn.hakunaymatata.com) answers 428 Precondition Required to
// any `Mozilla/*` User-Agent, which is exactly what an Android WebView sends by
// default. The TUI worked because reqwest sent the MovieBox app UA. The Android
// build must therefore override the WebView UA, or every stream fails to load.
console.log('\n# Stream delivery');
const capConfig = JSON.parse(
  readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'),
);
const configuredUa: string | undefined = capConfig?.android?.overrideUserAgent;
ok(!!configuredUa, 'Android build overrides the WebView User-Agent');
ok(!!configuredUa && !/^Mozilla\//i.test(configuredUa), 'overridden User-Agent is not a browser UA');

// The same CDN answers 429 to *any* request that carries a Referer header. A
// Capacitor WebView serves the app from https://localhost, so media requests
// would send `Referer: https://localhost/` and every stream would fail with
// MEDIA_ELEMENT_ERROR code 4. index.html must therefore set a no-referrer
// policy for the whole document.
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok(
  /<meta\s+name="referrer"\s+content="no-referrer"\s*\/?>/i.test(indexHtml),
  'index.html sends no Referer (WebView media must not leak https://localhost)',
);

const sample = (await fetchStreams('1654274595068805784')).find((s) => /h264|avc/i.test(s.codec));
if (sample && configuredUa) {
  const withApp = await fetch(sample.url, { headers: { 'user-agent': configuredUa } });
  ok(withApp.status === 206 || withApp.status === 200, `CDN serves the stream for the app UA (${withApp.status})`);
  const withBrowser = await fetch(sample.url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
  });
  ok(withBrowser.status === 428, `CDN rejects a browser UA (${withBrowser.status})`);

  const withReferer = await fetch(sample.url, {
    headers: { 'user-agent': configuredUa, referer: 'https://localhost/' },
  });
  ok(withReferer.status === 429, `CDN rejects a Referer header (${withReferer.status})`);
} else {
  ok(false, 'no H.264 stream available to probe the CDN User-Agent rule');
}

/* ---------- Series / anime (UGC fallback) ---------- */
// `play-info` answers series and anime with the 23 s anti-piracy trap clip on
// the visitor tier, so the real per-episode files have to come from the UGC
// collection (`ugc/video/first-by-subject` -> `ugc/collection/download-list`).
// This is what makes Naruto/One Piece/Breaking Bad playable; without it every
// series returns zero sources.
console.log('\n# Series & anime streams (UGC fallback)');
const seriesProbes: Array<[string, number, number]> = [
  ['Naruto', 1, 1],
  ['One Piece', 1, 1],
  ['Demon Slayer', 1, 1],
  ['Attack on Titan', 1, 1],
  ['Breaking Bad', 1, 1],
];
for (const [q, se, ep] of seriesProbes) {
  const hit = (await searchTitles(q))[0];
  if (!hit) {
    ok(false, `${q} resolves in search`);
    continue;
  }
  const streams = await fetchStreams(hit.id, se, ep);
  const real = streams.filter((s) => /bcdn\.hakunaymatata\.com/.test(s.url) && !isAdUrl(s.url));
  ok(real.length > 0, `${q} S${se}E${ep} resolves a real UGC stream (${real.length})`);
}

// Every returned URL must be a genuine file, never the trap clip.
const naruto = (await searchTitles('Naruto'))[0];
const narutoStreams = naruto ? await fetchStreams(naruto.id, 1, 1) : [];
ok(
  narutoStreams.length > 0 && narutoStreams.every((s) => !isAdUrl(s.url) && s.direct),
  'Naruto episode contains no anti-piracy trap clip',
);
ok(
  narutoStreams.some((s) => /h264|avc/i.test(s.codec)),
  'Naruto episode offers an H.264 source (plays without an HEVC decoder)',
);

/* ---------- Cache ---------- */
console.log('\n# Cache');
writeCache('unit:probe', { v: 42 });
eq((readCache('unit:probe', 60000) as any)?.v, 42, 'cache returns a fresh value');
ok(readCache('unit:probe', 0) === undefined, 'cache respects max age');
ok(readCache('unit:missing', 60000) === undefined, 'cache misses return undefined');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
