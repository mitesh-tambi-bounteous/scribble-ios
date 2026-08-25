# Running the web target

> **Android / iOS: DEFERRED — blocked on IT admin rights.** Native tooling
> (Xcode / Android SDK) is not installed and must not be installed in this
> environment. Only the web target is exercised below. Native builds will be
> picked up once IT grants the required installs.

Scribl ships from **one Expo source** for iOS, Android, and web (AC7 parity).
The web target uses Metro + CanvasKit (via `@shopify/react-native-skia`'s web
build) instead of native Skia, but it is the same `DrawingCanvas` component.

## Reproducible steps

```bash
# 1. install JS deps
npm install

# 2. materialize canvaskit.wasm (+ glue JS) into public/
#    (bundled with @shopify/react-native-skia; reads app.json to detect
#    the metro bundler and defaults to the public/ folder)
npx setup-skia-web

# 3. start the Metro dev server for web
npm run web
```

`npm run web` runs `expo start --web` and serves the Today screen from
`http://localhost:8081`. The app boots against the **mock data client**
(`src/data/mock.ts`, the default in `src/data/index.ts`) — zero AWS calls —
and renders the seeded prompt of the day
("Draw the first thing that made you smile today.").

### Verifying without a browser

In a headless environment, verify the dev server is serving a clean bundle
with curl and by inspecting Metro's own stdout:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081
curl -s "http://localhost:8081/node_modules/expo-router/entry.js.bundle?platform=web&dev=true" \
  | grep -c "Draw the first thing that made you smile today"
```

Both should return non-error status codes, and the second command should
report at least one match (the seeded prompt string is present in the served
bundle). Metro's stdout/stderr should show `Web Bundled ... node_modules/expo-router/entry.js (N modules)`
with no error lines.

## Export proof (headless)

A static web export is the most reliable headless proof that the Skia-web
wiring (CanvasKit wasm) is actually bundled:

```bash
npx expo export -p web
```

This produces a `dist/` directory. Confirm the CanvasKit wasm asset is
present in the export output:

```bash
find dist -iname "canvaskit*"
# dist/canvaskit.wasm
```

## Voice captions (web)

The caption screen includes a microphone button that records audio via the browser's
MediaRecorder API. On submit, the web app sends the audio (base64-encoded) to the
backend `/transcribe` endpoint.

**STT provider configuration:**
- `STT_PROVIDER=stub` (default): fixed transcript for deterministic testing.
- `STT_PROVIDER=cloud`: OpenAI whisper-1 real transcription; requires `OPENAI_API_KEY` or `STT_API_KEY` in .env.

**Transcript handling:**
The transcribed text fills the caption field only when it's empty. If the user typed
a caption while recording, the typed text always wins (voice is ignored).

**E2E testing:**
Playwright tests pin `STT_PROVIDER=stub` (see `playwright.config.ts`) to keep voice
transcription deterministic and avoid API calls during CI.

**E2E database isolation:**
The entire e2e stack (global setup, the API webServer, and DB assertions in
`e2e/helpers.ts`) runs against a disposable `scribl_e2e` database on the same
local Postgres container, never the shared dev `scribl` database — see
`e2e/db-url.ts`. `backend/scripts/reset.ts` (which drops every table with
CASCADE) enforces this itself: it refuses to run against any database whose
name doesn't end in `_e2e`, unless `ALLOW_DB_RESET=1` is explicitly set.

**Native:** Voice recording is stubbed for iOS/Android in this POC (S-013).

## Notes

- `canvaskit.wasm` is gitignored (`public/canvaskit.wasm`, `dist/canvaskit.wasm`);
  regenerate it with `npx setup-skia-web` after every fresh `npm install`.
- `components/canvas/DrawingCanvas.tsx` only takes the `@shopify/react-native-skia/lib/module/web`
  (`WithSkiaWeb`) path when `Platform.OS === "web"`; native platforms use the
  regular native Skia bindings from the same component.
- No EAS, no Expo-cloud services are used to produce this build — Metro dev
  server and `expo export -p web` are both local, OSS Expo CLI commands.
