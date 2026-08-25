/**
 * No-op teardown. Playwright starts and stops both webServers (API + Expo web)
 * itself, so there is no detached process to reap here. The Postgres container
 * is intentionally LEFT RUNNING so re-runs are fast (globalSetup reseeds it);
 * `docker compose down` is a manual step, not part of the suite lifecycle.
 */
export default async function globalTeardown(): Promise<void> {
  // Nothing to tear down.
}
