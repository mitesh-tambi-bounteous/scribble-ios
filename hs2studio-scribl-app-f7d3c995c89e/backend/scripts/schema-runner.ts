/**
 * Shared helpers for scripts that execute backend/db/schema.sql (or other
 * multi-statement .sql files) against Neon's HTTP driver, which runs one
 * statement per query and therefore needs statements split up front.
 */

/**
 * Splits a SQL file into individual statements on semicolons at line end,
 * skipping blank/comment-only lines. Bounded by the caller's own statement
 * count check — this function itself just splits a finite, small file.
 */
export function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

/** Throws if DATABASE_URL is missing/blank; never logs the value itself. */
export function assertDatabaseUrl(url: string | undefined): string {
  if (!url || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Copy the repo-root .env.example to .env and fill it in."
    );
  }
  return url;
}
