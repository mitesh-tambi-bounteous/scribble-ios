import { defineConfig, devices } from "@playwright/test";

import { e2eDatabaseUrl } from "./e2e/db-url";

/**
 * Playwright acceptance suite for the Scribl POC. Drives the REAL Expo web
 * app (served on :8081) against the REAL local Postgres (via the thin backend
 * API on :8787). Deterministic, script-asserted, DB-verified - no visual /
 * LLM judgment.
 *
 * - globalSetup brings up + reseeds Postgres (docker compose + backend db:*).
 * - webServer boots BOTH servers itself: the API (:8787) AND Expo web (:8081),
 *   waiting on each url before tests run. A bare `npm run test:e2e` from a cold
 *   state therefore reproduces the real cold start a human hits: if the API is
 *   down, the web app's fetches fail and the suite goes red (see smoke.spec).
 * - Serial (workers: 1): one shared DB + one shared API, so tests must not
 *   race each other on shared aggregate reads (participant counts, etc.).
 */
const WEB_PORT = 8081;
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;
const API_PORT = 8787;
const API_HEALTH_URL = `http://localhost:${API_PORT}/health`;

// The entire e2e stack (this API server included) runs against the
// disposable scribl_e2e database, never the shared dev DATABASE_URL - see
// e2e/db-url.ts and e2e/global-setup.ts.
const E2E_DATABASE_URL = e2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Skia web renders through CanvasKit (WebGL). Headless Chromium
          // needs a software GL backend for that to succeed.
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
  // Two web servers: Playwright starts BOTH and waits for each url check
  // before running any test. Order in the array does not gate startup - both
  // are launched together and awaited in parallel.
  webServer: [
    {
      // The thin backend API. /health returns 200 without touching the DB, so
      // it is a pure liveness probe; globalSetup has already seeded Postgres.
      command: "cd backend && npm run api",
      url: API_HEALTH_URL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      // Deterministic voice->text: the stub provider ignores audio content
      // and always returns a fixed transcript (see e2e/voice-caption.spec.ts).
      // Forced (not just defaulted) so a dev .env with STT_PROVIDER=cloud
      // (real Whisper) can't leak into e2e and break the stub assertion.
      env: {
        ...process.env,
        DATABASE_URL: E2E_DATABASE_URL,
        STT_PROVIDER: "stub",
      },
    },
    {
      // `npm run web` triggers the preweb hook (setup-skia-web), guaranteeing
      // public/canvaskit.wasm exists before the canvas mounts.
      command: `npm run web -- --port ${WEB_PORT}`,
      url: WEB_BASE_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CI: "1", EXPO_PUBLIC_RESTORE_SESSION: "1" },
    },
  ],
});
