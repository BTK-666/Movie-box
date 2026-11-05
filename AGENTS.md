# AGENTS.md

## Repository layout

- `MovieBox-Tui-main/` — original Rust terminal (TUI) app. Untouched.
- `app/` — the React + Vite web UI, packaged for Android via Capacitor.
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

Tests (Playwright, viewport 390x844):

```bash
node tests/ui.spec.mjs        # 25 interaction tests, needs dev server on :5173
node tests/apkpayload.mjs     # 18 route/render checks, needs `vite preview` on :4173
```

`tests/apkpayload.mjs` runs against the production bundle, which is the same
payload that ships inside the APK. Prefer it when the emulator is unavailable.

## Things that bite

- **Artwork must be base64 SVG data URIs.** Percent-encoded SVG that contains
  `<defs>` gradients is silently rejected by Chromium's CSS parser, so
  `background-image` ends up empty and the UI looks blank. See `src/data/catalog.ts`.
  `artwork(seed, w, h)` is the public helper for one-off images.
- **Keep the app offline-safe.** Do not reintroduce remote image URLs; the APK
  has to render with no network. `tests/apkpayload.mjs` asserts zero external
  requests.
- **The emulator has no KVM here**, so it is extremely slow and the WebView
  renderer can crash (SIGTRAP) under software rendering. A white/black
  `screencap` is usually the emulator, not the app. Verify via
  `node tests/apkpayload.mjs`, or connect to the WebView with
  `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`.
- Capacitor logs `Unable to read file at path public/plugins` at startup; that
  is benign.
