# AGENTS.md

## Repository layout

- `MovieBox-Tui-main/` — original Rust terminal (TUI) app. Untouched.
- `app/` — the React + Vite web UI, packaged for Android via Capacitor.
  - `src/lib/moviebox.ts` — signed HTTP client for the MovieBox API.
  - `src/lib/md5.ts` — MD5/HMAC-MD5/base64 implemented in-repo (no deps).
  - `src/data/api.ts` — adapter: API JSON -> app models (`Title`, `MediaDetails`, `Stream`, `ShortItem`, `LiveChannel`, `SportMatch`).
  - `src/data/cache.ts` — in-memory title/details cache shared across screens.
  - `src/data/catalog.ts` — bundled fallback catalog and artwork helper.
  - `src/lib/img.ts` — CDN image resizing (`optimizeImage`, `posterImage`).
  - `src/lib/useAsync.ts` — `useAsync` and the persisted stale-while-revalidate cache.
  - `src/lib/novel.ts` — deterministic novel chapters + reading progress.
- `moviebox-plus-debug.apk` — latest debug APK at repo root (ignored by git).

## Build and test

```bash
cd app
npm run dev                        # dev server on :5173
npm run build                      # -> dist/
npx cap sync android               # dist/ -> android/app/src/main/assets/public
cd android && ./gradlew assembleDebug
```

Toolchain used here: JDK 21, Android SDK at `/workspace/android-sdk`
(build-tools, platforms, platform-tools). Env vars:

```bash
export ANDROID_HOME=/workspace/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

Tests:

```bash
npm run test:unit             # 131 tests: crypto vectors, adapters, live API, ad filtering (Node)
npm run test:media            # real-Chromium proof of the WebView media path (Referer fix)
npm run test:e2e              # boots dist/ and proves a real stream plays end-to-end
npm run test:ui               # 91 interaction tests (Playwright, 390x844)
npm test                      # unit + media + e2e + e2e:series + ui
```

`test:media` and `test:e2e` drive a system Chromium (`/usr/bin/chromium`) — the
same engine as the Android WebView — because the emulator here cannot render.
They serve the built app over `https://localhost` with the app User-Agent, so a
green run is strong evidence the on-device media path works. Both skip cleanly
when Chromium is absent.

`npm run test:unit` needs no server. `npm run test:ui` needs a server; point it
at either one:

```bash
npm run dev &                                   # :5173 (default)
BASE_URL=http://127.0.0.1:4173 npm run test:ui  # after `vite preview`
```

`tests/apkpayload.mjs` runs against the production bundle, which is the same
payload that ships inside the APK. Prefer it when the emulator is unavailable.

## Serving the APK

The download page is served from `/workspace/mbdl` (not `/tmp`, which gets
wiped). Restart it after a rebuild:

```bash
cp moviebox-plus-debug.apk /workspace/mbdl/MovieBoxPlus.apk
nohup python3 -m http.server 12000 --bind 0.0.0.0 \
  --directory /workspace/mbdl > /workspace/mbdl/server.log 2>&1 &
```

Public URL: `https://work-1-cztekbhstulgynne.prod-runtime.all-hands.dev/`

## Things that bite

- **The app streams from the live MovieBox API**, so screens need network. Each
  request is signed (`x-client-token`, `x-tr-signature`) with the shared secret in
  `src/lib/moviebox.ts`. The API's CORS policy allows the Capacitor origin
  (`https://localhost`), so plain `fetch` works from the WebView.
- **Signed requests are cached and de-duplicated** by `MovieBoxClient`; the
  visitor token is refreshed on a 401. Never call the endpoints directly from a
  screen — go through `src/data/api.ts`.
- **The stream CDN is User-Agent *and* Referer gated — this is the #1 playback
  gotcha.** `bcdn.hakunaymatata.com` returns **HTTP 428 Precondition Required** to
  *any* `Mozilla/*` User-Agent and **206** to a non-Mozilla one (the MovieBox
  Android UA, `ExoPlayerLib`, `Dalvik`, `okhttp`, or even an empty UA). An Android
  WebView sends `Mozilla/...` by default, so every `<video>` request 428s and the
  element reports `MEDIA_ELEMENT_ERROR: Format error` (code 4) — the app then
  shows "no playable source". The Rust TUI never hit this because reqwest sent
  the MovieBox app UA. Fix 1 lives in `capacitor.config.json`:
  `android.overrideUserAgent` sets the WebView UA to the MovieBox app string.
- **The same CDN answers HTTP 429 to *any* request that carries a `Referer`.** A
  Capacitor WebView serves the app from `https://localhost`, so media requests
  would otherwise send `Referer: https://localhost/` and every stream fails to
  load with `MEDIA_ELEMENT_ERROR` code 4 — the "This source failed to load — try
  another quality" message. Fix 2 is the document-wide
  `<meta name="referrer" content="no-referrer">` in `index.html`. `test:media`
  proves both directions: with the meta the CDN request carries no Referer and
  the stream plays; without it Chromium leaks `https://localhost/` and the stream
  is blocked. Removing *either* fix silently breaks playback for every title.
  `tests/unit.spec.ts` ("Stream delivery") asserts both.
- **Movie streams are mostly HEVC.** `fetchStreams` sorts H.264 first for the same
  resolution because HEVC only decodes where the device has a decoder. The player
  probes `canPlayType('hvc1…')` once and, on devices without an HEVC decoder,
  re-ranks H.264 first; it also falls back to the next source when one fails.
  Measured coverage on the visitor tier: movies ~24/25 have a source (only ~1/25
  in H.264), series ~3/25. HEVC-only movies are fine once the UA fix is in (the
  WebView decodes HEVC on most modern Android devices); the codec re-rank is only
  a fallback for devices without an HEVC decoder.
- **Promo clips are ads and are never played.** When a title is not licensed for
  the visitor tier, MovieBox substitutes a ~23 s H.264 clip from
  `macdn.aoneroom.com/other/...`. `isAdUrl()` in `src/data/api.ts` recognises it
  (plus the fixed notice hashes and `/notice.mp4`) and `fetchStreams` drops it
  outright — the app then honestly reports "no playable source" instead of
  looping an ad. `Player.tsx` filters again as a guard against cached payloads.
  Series episodes and VIP titles (`vipInfo.requireMemberType`) are all gated this
  way, so most series have no source on the visitor tier.
- **`play-info` needs `se`/`ep`.** Without them the endpoint returns no streams
  for series; `fetchStreams` probes `se=1&ep=1` (then `ep=2`) and the legacy
  `resource` listing as fallbacks.
- **Artwork must be base64 SVG data URIs.** Percent-encoded SVG that contains
  `<defs>` gradients is silently rejected by Chromium's CSS parser, so
  `background-image` ends up empty and the UI looks blank. See `src/data/catalog.ts`.
  `artwork(seed, w, h)` is the public helper for one-off images. It is now only a
  fallback for titles the API returns without a cover.
- **Playback starts inline on the detail page (YouTube-style), not on a route.**
  `src/components/VideoPlayer.tsx` is the single video surface: `variant="inline"`
  keeps a 16:9 box in the detail hero with episodes/cast below it, `variant="full"`
  fills the `/player/:id` route. Fullscreen is a state toggle (a `.vp-fs` fixed
  overlay) plus a landscape lock from `@capacitor/screen-orientation`
  (`src/lib/orientation.ts`, with the browser Screen Orientation API as fallback) —
  the Fullscreen API alone is unreliable inside the Android WebView. The Home hero
  Play button navigates to `/detail/:id?play=1`, which Detail turns into inline
  playback as soon as the episode list resolves (or immediately if it never does).
- **The emulator has no KVM here**, so it is extremely slow and the WebView
  renderer can crash (SIGTRAP) under software rendering. A white `screencap` is
  usually the emulator, not the app — a JS-free static page crashes the same way.
  Verify behaviour in Chromium instead (`npm run test:media` / `test:e2e` /
  `test:ui`), or connect to the WebView with
  `adb forward tcp:9222 localabstract:webview_devtools_remote`.
- **Capacitor kills the app when the WebView renderer dies.** The stock
  `BridgeActivity` returns `false` from `onRenderProcessGone`, so the OS tears
  down the whole process (observed as
  `Render process ...'s crash wasn't handled by all associated webviews` on the
  low-RAM emulator). `MainActivity.java` overrides the callback via a
  `WebViewListener` to destroy the dead WebView and `recreate()` the activity, so
  the app recovers instead of vanishing. This is why `MainActivity` is no longer
  an empty class.
- Capacitor logs `Unable to read file at path public/plugins` at startup; that
  is benign.
- **State persists in `localStorage`** under `mb-store-v1`. A fresh install starts
  empty: My List, Downloads and History fill up as the user browses.
- **Images must go through `optimizeImage`.** The CDN is Alibaba OSS, so
  `?x-oss-process=image/resize,w_<n>` resizes server-side (a 2.35 MB banner
  becomes ~600 KB). Full-size posters made the feed look like it was hanging.
- **Ads are promo `BANNER`/`ADS` groups in `tab-operating`.** `fetchHome` skips
  groups and slides whose title matches the promo patterns; do not render them
  as browsable titles.
- **Series and anime play through the UGC collection, not `play-info`.** On the
  visitor tier `play-info/v2` answers almost every episode with the same 23 s
  "update your app" trap from `macdn.aoneroom.com` (`signCookie` is empty). The
  real per-episode files live in the UGC collection behind the title:
  `/wefeed-mobile-bff/ugc/video/first-by-subject?subjectId=<id>` returns
  `belongToCollection.{collectionId,videoNum}`, and
  `/wefeed-mobile-bff/ugc/collection/download-list?collectionId=<c>&page=<p>&perPage=50`
  lists episodes (`epTitle` like `S1EP7`) each with real `resources[]` on
  `bcdn.hakunaymatata.com/resource/...`. This is the path AnyFilm uses and it is
  what `ugcEpisodeStreams` / `ugcEpisodeCounts` in `src/data/api.ts` implement.
  Without it every series and anime returns zero sources. Some resources carry a
  `signCookie` whose `urlprefix=<base64>` hides the real `index.m3u8` base URL
  (AnyFilm's "anti-piracy dummy bypass"); decode it and swap the URL when the
  returned `url` looks like a trap.
- **`season-info` is authoritative for episode counts** (`seasons[].maxEp`), but
  UGC-only series carry none — fall back to the collection labels for the picker.
- **The visitor backend has no novel service.** `i-api.aoneroom.com` and the
  `/novel/*` paths 404; NovelHub is a signed-in feature of the official client.
  `src/lib/novel.ts` generates deterministic chapters locally so the reader works.
- **Real data sources**: shorts = `business/shorts` (`media.video[].url`),
  live TV = `live/tv-channel-list-by-country`, sports = `sport/match-list` +
  `sport-news/trending`.
- **Tests**: `npm run test:unit` (live API + UGC series probes), `test:media`,
  `test:e2e` (movie playback), `test:e2e:series` (series playback through the UI),
  `test:ui`. The UI suites need a server; run `npm run dev` and
  `BASE_URL=http://localhost:5173 npm test`, or just `npm test` if port 5173 is up.
- **`useCachedAsync` is stale-while-revalidate**: a cached screen paints first and
  refreshes in the background. The cache is persisted to `localStorage`
  (`mb-cache-v1`, newest 12 entries, ~1.5 MB cap) so a cold start still paints
  instantly. Tests assert paint time, not request count.
- **The JDK is not preinstalled.** `sudo apt-get install -y openjdk-21-jdk-headless`
  before `./gradlew assembleDebug`; set `JAVA_HOME` as shown above.
- **Real data sources**: shorts = `business/shorts` (`media.video[].url`),
  live TV = `live/tv-channel-list-by-country`, sports = `sport/match-list` +
  `sport-news/trending`.

## Video Drop server (workspace tool, not part of the app)

`/workspace/videodrop/server.py` is a standalone upload server used to get a
video clip to the agent so it can be analysed. It is **outside this repo** and
not committed here.

- Public URL: `https://work-1-cztekbhstulgynne.prod-runtime.all-hands.dev/` (port 12000)
- Uploads are chunked (8 MB) because the public reverse proxy 502s long requests.
- Deletes are **soft** — uploads move to `/workspace/videodrop/trash/`, never
  hard-deleted. Do not run `rm -rf` on `uploads/`; it can destroy a user's clip.
- See `/workspace/videodrop/RESTART.md` for endpoints and restart steps.

## Reference-UI parity (video-driven redesign)

The home/search/detail/download/player surfaces were rebuilt to match the
reference screen recording the user supplied:

- **Home** — category chips `Football / Trending / Movie / Anime / Cricket / TV`;
  the Trending tab derives `TOP Movies` and `Top Series` rails from the
  catalogue's highest-rated titles (the backend exposes no named feed), and only
  those two rails carry the sub-category chips
  (movie: Bollywood / South Indian / Hollywood / New;
  tv: Indian Drama / Reality-TV / Anime / Asian Drama / Western).
- **Search** — content-type chips `All / Movie/Series / Sports / Music / Education`
  (genre-hint matching, since the API has no type facet).
- **Detail** — `For you / Comments` tabs (the comments API is not reachable from
  the WebView, so the tab shows an honest empty state), season chips `All / 01…`,
  and the `Resources · Uploaded by <name>` line.
- **Download sheet** — resolution row `1080P/720P/480P/360P`, `S01 E01` rows with
  size + duration, and a footer total (`Download · 4.09GB`). It shows a loading
  state until the UGC collection arrives.
- **Player** — `Fit` (object-fit toggle), `Language`, and a `Tap to Lock` hint
  beside the lock icon.

The parity assertions live at the end of `tests/ui.spec.mjs` (suite #20).

## CDN access, playback tiers and the minimal player

**The CDN is User-Agent gated.** `bcdn.hakunaymatata.com` answers:

| User-Agent | Response |
| :--- | :--- |
| `ExoPlayerLib/*`, `okhttp/*`, `VLC`, `curl`, the Capacitor UA | `206` (plays) |
| any Chromium `Mozilla/5.0 … Chrome/…` | `428` (blocked) |

So a stream that "fails" in a desktop browser usually plays fine on device.
`npm run test:media` and `test:e2e` therefore launch Chromium with the
Capacitor User-Agent; that is the configuration the APK actually uses. The
`428` you see in the UI suite's console is the desktop UA, not a product bug.

**Real streams vs trap clips.** `play-info` returns a 23-second
"please update your app" MP4 from `macdn.aoneroom.com/other/…` for most
titles. The genuine signed files live in
`subject.resourceDetectors[].resolutionList[]` (movies) and in the UGC
collection (`ugc/video/first-by-subject` → `ugc/collection/download-list`)
for series, anime and short dramas. `isAdUrl()` drops the trap clips and
`fetchStreams()` merges all of those sources, preferring H.264 when the
device reports no HEVC decoder.

**Player controls are deliberately three things only:** quality, fullscreen
and next. Everything else (lock, fit, speed, subtitle picker, cast, mute) was
removed on request; the UI suite asserts the control row stays at two buttons.

## Content coverage

Verified playable on the visitor tier: movies, TV series, anime, K-drama and
shorts/reels. There is **no novel/book API** — neither reference repo exposes
one and every `/novel/*` probe 404s — so NovelHub keeps its bundled catalogue
and the deterministic local chapter generator. Shorts are real videos from
`business/shorts`, surfaced as the "Hot Short TV" rail on Home.
