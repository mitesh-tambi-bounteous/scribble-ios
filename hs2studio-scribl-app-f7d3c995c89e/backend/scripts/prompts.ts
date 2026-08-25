/**
 * Prompt provisioning: inserts daily prompts for today + the next N days,
 * keyed by the REAL calendar date (id `prompt-YYYY-MM-DD`). Chooses a prompt
 * body deterministically from backend/seeds/prompts.ts by day index, so the
 * same date always resolves to the same prompt (AC1). Uses
 * ON CONFLICT (prompt_date) DO NOTHING so re-running only fills gaps.
 *
 * Run: `npm run db:prompts` (from backend/).
 */
import * as path from "node:path";
import dotenv from "dotenv";
import { makeSql } from "../lambda/data/sql-driver";
import { assertDatabaseUrl } from "./schema-runner";
import { ADMIN_PROMPTS } from "../seeds/prompts";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MAX_DAYS = 60; // bounded loop guard
const DEFAULT_DAYS = 7;

/** Formats a Date as YYYY-MM-DD in UTC (stable, no local-timezone drift). */
function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Deterministic day-index into ADMIN_PROMPTS, derived from days-since-epoch. */
function promptBodyForDayIndex(dayIndex: number): string {
  const body = ADMIN_PROMPTS[dayIndex % ADMIN_PROMPTS.length];
  if (!body) {
    throw new Error("ADMIN_PROMPTS is empty; cannot provision prompts");
  }
  return body;
}

async function main(): Promise<void> {
  const url = assertDatabaseUrl(process.env.DATABASE_URL);
  const sql = makeSql(url);

  const days = Number(process.env.PROMPT_DAYS ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new Error(`PROMPT_DAYS must be an integer between 1 and ${MAX_DAYS}, got ${days}`);
  }

  const today = new Date();
  const epochDaysBase = Math.floor(today.getTime() / 86_400_000);

  let inserted = 0;
  let skipped = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today.getTime() + offset * 86_400_000);
    const isoDate = toIsoDate(date);
    const id = `prompt-${isoDate}`;
    const body = promptBodyForDayIndex(epochDaysBase + offset);

    // eslint-disable-next-line no-await-in-loop
    const result = await sql(
      "INSERT INTO prompts (id, prompt_date, title, body) VALUES ($1, $2, NULL, $3) ON CONFLICT (prompt_date) DO NOTHING RETURNING id",
      [id, isoDate, body],
    );
    if (Array.isArray(result) && result.length > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`prompts: inserted ${inserted}, skipped ${skipped} (already present) of ${days} day(s)`);
}

main().catch((err) => {
  console.error("prompts failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
