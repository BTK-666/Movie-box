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
npm run test:unit             # 118 tests: crypto vectors, adapters, live API, ad filtering (Node)
npm run test:ui               # 62 interaction tests (Playwright, 390x844)
npm test                      # both
```

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
- **The stream CDN is User-Agent gated — this is the #1 playback gotcha.**
  `bcdn.hakunaymatata.com` returns **HTTP 428 Precondition Required** to *any*
  `Mozilla/*` User-Agent and **206** to a non-Mozilla one (the MovieBox Android
  UA, `ExoPlayerLib`, `Dalvik`, `okhttp`, or even an empty UA). An Android
  WebView sends `Mozilla/...` by default, so every `<video>` request 428s and the
  element reports `MEDIA_ELEMENT_ERROR: Format error` (code 4) — the app then
  shows "no playable source". The Rust TUI never hit this because reqwest sent
  the MovieBox app UA. The fix lives in `capacitor.config.json`:
  `android.overrideUserAgent` sets the WebView UA to the MovieBox app string.
  `tests/unit.spec.ts` ("Stream delivery") asserts the config is set, that it is
  not a browser UA, and that the CDN answers 206 for it / 428 for a browser UA.
  Removing that override silently breaks playback for *every* title.
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
- **The emulator has no KVM here**, so it is extremely slow and the WebView
  renderer can crash (SIGTRAP) under software rendering. A white `screencap` is
  usually the emulator, not the app — a JS-free static page crashes the same way.
  Verify behaviour in Chromium instead (`npm run test:ui`), or connect to the
  WebView with `adb forward tcp:9222 localabstract:webview_devtools_remote`.
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
- **The visitor backend has no novel service.** `i-api.aoneroom.com` and the
  `/novel/*` paths 404; NovelHub is a signed-in feature of the official client.
  `src/lib/novel.ts` generates deterministic chapters locally so the reader works.
- **`useCachedAsync` is stale-while-revalidate**: a cached screen paints first and
  refreshes in the background. The cache is persisted to `localStorage`
  (`mb-cache-v1`, newest 12 entries, ~1.5 MB cap) so a cold start still paints
  instantly. Tests assert paint time, not request count.
- **The JDK is not preinstalled.** `sudo apt-get install -y openjdk-21-jdk-headless`
  before `./gradlew assembleDebug`; set `JAVA_HOME` as shown above.
- **Real data sources**: shorts = `business/shorts` (`media.video[].url`),
  live TV = `live/tv-channel-list-by-country`, sports = `sport/match-list` +
  `sport-news/trending`.
