/**
 * Shared helper: derives the disposable `scribl_e2e` database URL from the
 * dev DATABASE_URL, so every e2e-adjacent consumer (global-setup,
 * playwright.config, helpers) points at the same isolated database instead
 * of the shared dev DB.
 *
 * Deliberately has no dependency on the `dotenv` package (not installed at
 * the repo root) - it reads process.env.DATABASE_URL first, falling back to
 * a minimal parse of the repo-root .env file.
 */
import * as fs from "node:fs";
import * as path from "node:path";

/** Name of the disposable database the entire e2e stack runs against. */
export const E2E_DB_NAME = "scribl_e2e";

const REPO_ROOT = path.resolve(__dirname, "..");
const MAX_ENV_LINES = 500; // bounded loop guard

/** Minimal `DATABASE_URL=...` line reader for the repo-root .env file. */
function readDatabaseUrlFromEnvFile(): string | undefined {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    return undefined;
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n").slice(0, MAX_ENV_LINES);
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i]?.trim() ?? "";
    if (trimmed.startsWith("DATABASE_URL=")) {
      return trimmed.slice("DATABASE_URL=".length).trim();
    }
  }
  return undefined;
}

/** Resolves the configured dev DATABASE_URL (process.env first, then repo-root .env). */
export function baseDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  const url = fromEnv && fromEnv.trim().length > 0 ? fromEnv : readDatabaseUrlFromEnvFile();
  if (!url || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL is not set (checked process.env and repo-root .env). Copy .env.example to .env.",
    );
  }
  return url;
}

/** Swaps the database name in a Postgres connection URL, preserving host/port/creds/query. */
export function deriveE2eDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${E2E_DB_NAME}`;
  return parsed.toString();
}

/** The dev DATABASE_URL rewritten to target the disposable `scribl_e2e` database. */
export function e2eDatabaseUrl(): string {
  return deriveE2eDatabaseUrl(baseDatabaseUrl());
}
