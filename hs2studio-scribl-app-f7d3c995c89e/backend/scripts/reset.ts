/**
 * DB reset: drops every Scribl table (CASCADE) and re-runs schema.sql to
 * recreate them. Idempotent and safe to re-run — a no-op set of tables is
 * fine, and schema.sql itself is idempotent (IF NOT EXISTS / ON CONFLICT).
 *
 * Does NOT insert prompts — prompts are provisioned separately via
 * `npm run db:prompts` (see backend/scripts/prompts.ts).
 *
 * Run: `npm run db:reset` (from backend/).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { makeSql } from "../lambda/data/sql-driver";
import { assertDatabaseUrl, splitStatements } from "./schema-runner";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/** Drop order doesn't matter with CASCADE, but listed for clarity/logging. */
const TABLES = [
  "challenge_ratings",
  "challenge_entries",
  "challenges",
  "reactions",
  "comments",
  "responses",
  "submissions",
  "channel_members",
  "channels",
  "prompts",
  "families",
  "users",
] as const;

/**
 * Refuses to run unless the target database is clearly disposable (name ends
 * in `_e2e`) or the caller explicitly opts in with ALLOW_DB_RESET=1. This
 * script drops every Scribl table with CASCADE - it must never be able to
 * silently wipe a shared dev/staging database again.
 */
function assertResetAllowed(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  const allowed = dbName.endsWith("_e2e") || process.env.ALLOW_DB_RESET === "1";
  if (allowed) {
    return;
  }
  console.error(
    `reset: REFUSING to reset database "${dbName}". This script drops and recreates ` +
      `every Scribl table (CASCADE), so it only runs against a disposable database ` +
      `whose name ends in "_e2e" (e.g. scribl_e2e). Point DATABASE_URL at that database, ` +
      `or set ALLOW_DB_RESET=1 to override.`,
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const url = assertDatabaseUrl(process.env.DATABASE_URL);
  assertResetAllowed(url);
  const sql = makeSql(url);

  console.log(`reset: dropping ${TABLES.length} table(s)`);
  for (let i = 0; i < TABLES.length; i += 1) {
    const table = TABLES[i];
    // eslint-disable-next-line no-await-in-loop
    await sql(`DROP TABLE IF EXISTS ${table} CASCADE`);
    console.log(`reset: dropped ${table}`);
  }

  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const statements = splitStatements(schemaSql);

  console.log(`reset: recreating schema from ${statements.length} statement(s)`);

  const MAX_STATEMENTS = 500; // bounded loop guard
  if (statements.length > MAX_STATEMENTS) {
    throw new Error(`schema.sql has ${statements.length} statements; exceeds reset safety cap`);
  }

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (!statement) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await sql(statement);
  }

  console.log("reset: done");
}

main().catch((err) => {
  console.error("reset failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
