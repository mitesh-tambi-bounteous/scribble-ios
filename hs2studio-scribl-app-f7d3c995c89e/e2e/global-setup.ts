import { execFileSync } from "node:child_process";
import * as path from "node:path";

import { E2E_DB_NAME, baseDatabaseUrl, deriveE2eDatabaseUrl } from "./db-url";

/** Repo root, derived relatively (this file lives in <root>/e2e/). */
const REPO_ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(REPO_ROOT, "backend");
const PG_CONTAINER = process.env.PG_CONTAINER ?? "scribl-pg";

/** Runs an npm script synchronously in a given cwd, inheriting stdio + the given env. */
function runNpmScript(cwd: string, script: string, env: NodeJS.ProcessEnv): void {
  // eslint-disable-next-line no-console
  console.log(`[e2e setup] (${path.basename(cwd)}) npm run ${script}`);
  execFileSync("npm", ["run", script], { cwd, stdio: "inherit", env });
}

/** Runs a scalar SQL statement inside the Postgres container against a fixed admin database. */
function psqlAdmin(sql: string): string {
  const out = execFileSync(
    "docker",
    ["exec", PG_CONTAINER, "psql", "-U", "scribl", "-d", "postgres", "-tAc", sql],
    { encoding: "utf8" },
  );
  return out.trim();
}

/**
 * Ensures the disposable `scribl_e2e` database exists on the same Postgres
 * server as DATABASE_URL. CREATE DATABASE has no IF NOT EXISTS form, so this
 * guards with an explicit pg_database lookup first.
 */
function ensureE2eDatabaseExists(): void {
  const existing = psqlAdmin(`SELECT 1 FROM pg_database WHERE datname='${E2E_DB_NAME}'`);
  if (existing === "1") {
    // eslint-disable-next-line no-console
    console.log(`[e2e setup] database ${E2E_DB_NAME} already exists`);
    return;
  }
  psqlAdmin(`CREATE DATABASE ${E2E_DB_NAME}`);
  // eslint-disable-next-line no-console
  console.log(`[e2e setup] created database ${E2E_DB_NAME}`);
}

/**
 * Prepares the shared world BEFORE Playwright starts the webServers. It does
 * NOT start or poll the API: the config's webServer array owns both the API
 * (:8787) and Expo web (:8081) and waits on each url. Ordering is safe because
 * the API reads the DB per-request and /health never touches it, so the DB
 * only has to be up + seeded by the time a test issues its first real request.
 *
 * The entire e2e stack (this setup, db:reset/bootstrap/prompts, and the API
 * webServer - see playwright.config.ts) runs against the disposable
 * `scribl_e2e` database, never the shared dev `scribl` database. reset.ts
 * itself also refuses to run against any database not named `*_e2e`.
 *
 * Steps:
 *   1. `docker compose up -d --wait` - bring up (and health-wait) scribl-pg.
 *   2. Create the scribl_e2e database (same server, same creds) if missing.
 *   3. db:reset / db:bootstrap / db:prompts against scribl_e2e specifically.
 */
export default async function globalSetup(): Promise<void> {
  // 1. Ensure the local Postgres container is up and healthy.
  runNpmScript(REPO_ROOT, "db:up", process.env);

  // 2. Ensure the disposable e2e database exists on that same server.
  const devUrl = baseDatabaseUrl();
  const e2eUrl = deriveE2eDatabaseUrl(devUrl);
  ensureE2eDatabaseExists();

  // 3. Deterministic DB: drop + recreate schema, (re)apply schema, seed
  //    prompts - all against scribl_e2e, never the dev DATABASE_URL.
  const e2eEnv: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: e2eUrl };
  runNpmScript(BACKEND_DIR, "db:reset", e2eEnv);
  runNpmScript(BACKEND_DIR, "db:bootstrap", e2eEnv);
  runNpmScript(BACKEND_DIR, "db:prompts", e2eEnv);
}
