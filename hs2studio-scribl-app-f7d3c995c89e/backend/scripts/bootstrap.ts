/**
 * DB bootstrap: reads backend/db/schema.sql and executes it against Neon
 * (via @neondatabase/serverless), using DATABASE_URL from the environment.
 * Idempotent — schema.sql uses IF NOT EXISTS / ON CONFLICT throughout, so
 * this is safe to re-run.
 *
 * Run: `npm run db:bootstrap` (from backend/).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { makeSql } from "../lambda/data/sql-driver";
import { assertDatabaseUrl, splitStatements } from "./schema-runner";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main(): Promise<void> {
  const url = assertDatabaseUrl(process.env.DATABASE_URL);
  const sql = makeSql(url);

  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const statements = splitStatements(schemaSql);

  console.log(`bootstrap: executing ${statements.length} statement(s) from ${schemaPath}`);

  const MAX_STATEMENTS = 500; // bounded loop guard
  if (statements.length > MAX_STATEMENTS) {
    throw new Error(`schema.sql has ${statements.length} statements; exceeds bootstrap safety cap`);
  }

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (!statement) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await sql(statement);
  }

  console.log("bootstrap: done");
}

main().catch((err) => {
  console.error("bootstrap failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
