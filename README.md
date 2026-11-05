# MovieBox+

A MovieBox+ style streaming app: movies, TV, anime, novels, short dramas, fight
zone and live TV.

Two frontends live in this repo:

| Path | What it is |
| --- | --- |
| `MovieBox-Tui-main/` | Original Rust terminal (TUI) app |
| `app/` | React + Vite web UI, packaged for Android with Capacitor |

## Run the web app

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle -> dist/
```

## Build the Android APK

```bash
cd app
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

The APK is self-contained: app id `com.moviebox.plus`, minSdk 24, targetSdk 36.
All artwork is generated in-app as inline SVG, so the UI renders fully offline.

## Tests

```bash
cd app
node tests/ui.spec.mjs       # 25 interaction tests (dev server on :5173)
node tests/apkpayload.mjs    # 18 route/render checks against the APK payload
```

## Screens

Home, Detail, Player, Search, Downloads, Me, NovelHub, Novel Detail, Shorts,
Fight Zone, Live TV, Browse, Addons, Settings, History, Favorites.
