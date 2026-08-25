/**
 * SQL driver seam: production talks to Neon over HTTP via
 * @neondatabase/serverless; local dev/e2e against a plain Postgres container
 * cannot use that HTTP driver, so this module swaps in a `pg`-backed adapter
 * that mimics the same surface (tagged template + function-call +
 * `.transaction`) when the target looks like localhost, or when
 * SCRIBL_PG_DRIVER=node is set explicitly.
 *
 * Production behavior is unchanged: no `pg` import happens unless the local
 * path is selected, and the real neon() call is identical to before.
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";

/** Minimal shape of the neon tagged-template sql executor we depend on. */
export type SqlExecutor = NeonQueryFunction<false, false>;

/** A pending statement produced by the tagged-template form, batchable via `.transaction`. */
interface PgStatement extends Promise<unknown[]> {
  text: string;
  values: unknown[];
}

function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Rewrites a tagged-template's interpolations into a `$1..$n` parameterized query. */
function buildParameterizedQuery(strings: TemplateStringsArray, values: unknown[]): PgStatement {
  let text = strings[0] ?? "";
  const MAX_PARAMS = 200; // bounded loop guard
  if (values.length > MAX_PARAMS) {
    throw new Error(`sql-driver: too many interpolated params (${values.length})`);
  }
  for (let i = 0; i < values.length; i += 1) {
    text += `$${i + 1}` + (strings[i + 1] ?? "");
  }

  let poolPromise: Promise<unknown[]> | undefined;
  const statement = {
    text,
    values,
    then(onFulfilled?: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
      if (!poolPromise) {
        poolPromise = runSingleStatement(text, values);
      }
      return poolPromise.then(onFulfilled, onRejected);
    },
    catch(onRejected?: (e: unknown) => unknown) {
      return this.then(undefined, onRejected);
    },
    finally(onFinally?: () => void) {
      return this.then(
        (v) => {
          onFinally?.();
          return v;
        },
        (e) => {
          onFinally?.();
          throw e;
        },
      );
    },
  } as PgStatement;
  return statement;
}

// Module-level pg.Pool singleton (lazy).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Postgres type OIDs whose default node-pg parsing (JS Date) diverges from
// the Neon HTTP driver (raw strings). We normalize pg's parsing to match
// Neon so dev/e2e (local Postgres) behaves like production (Neon).
const OID_DATE = 1082;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;

let _typeParsersRegistered = false;

/** Registers pg type parsers once so DATE/TIMESTAMP(TZ) come back as strings, matching Neon. */
function registerPgTypeParsers(pgTypes: {
  setTypeParser: (oid: number, parser: (value: string) => unknown) => void;
}): void {
  if (_typeParsersRegistered) {
    return;
  }
  _typeParsersRegistered = true;

  // DATE -> identity: keep the raw "YYYY-MM-DD" string, same as Neon.
  pgTypes.setTypeParser(OID_DATE, (value: string) => value);

  // TIMESTAMP / TIMESTAMPTZ -> ISO 8601 string ending in "Z", same as Neon.
  // Raw pg text for TIMESTAMP has no tz offset (e.g. "2026-07-02 10:00:00"),
  // so we must assume UTC ourselves before parsing, or `new Date()` would
  // interpret it in the server's local timezone. TIMESTAMPTZ raw text
  // already carries an offset (e.g. "2026-07-02 10:00:00+00"), so it can be
  // parsed directly.
  const toIsoString = (raw: string, assumeUtc: boolean): string | null => {
    if (raw === null || raw === undefined) {
      return null;
    }
    const normalized = assumeUtc ? `${raw.replace(" ", "T")}Z` : raw;
    const parsed = new Date(normalized);
    return parsed.toISOString();
  };
  pgTypes.setTypeParser(OID_TIMESTAMP, (value: string) => toIsoString(value, true));
  pgTypes.setTypeParser(OID_TIMESTAMPTZ, (value: string) => toIsoString(value, false));
}

function getPool(url: string): any {
  if (!_pool) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pg = require("pg") as {
      Pool: new (opts: { connectionString: string }) => unknown;
      types: { setTypeParser: (oid: number, parser: (value: string) => unknown) => void };
    };
    registerPgTypeParsers(pg.types);
    const { Pool } = pg;
    _pool = new Pool({ connectionString: url });
  }
  return _pool;
}

let _poolUrl: string | undefined;

async function runSingleStatement(text: string, values: unknown[]): Promise<unknown[]> {
  if (!_poolUrl) {
    throw new Error("sql-driver: pool not initialized");
  }
  const pool = getPool(_poolUrl);
  const result = await pool.query(text, values);
  return result.rows as unknown[];
}

async function runTransaction(statements: PgStatement[]): Promise<unknown[]> {
  if (!_poolUrl) {
    throw new Error("sql-driver: pool not initialized");
  }
  const pool = getPool(_poolUrl);
  const client = await pool.connect();
  const results: unknown[] = [];
  try {
    await client.query("BEGIN");
    const MAX_STATEMENTS = 200; // bounded loop guard
    if (statements.length > MAX_STATEMENTS) {
      throw new Error(`sql-driver: transaction has ${statements.length} statements; exceeds cap`);
    }
    for (let i = 0; i < statements.length; i += 1) {
      const stmt = statements[i];
      if (!stmt) {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const res = await client.query(stmt.text, stmt.values);
      results.push(res.rows);
    }
    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Builds a pg-backed adapter mimicking the neon `SqlExecutor` surface. */
function makePgSql(url: string): SqlExecutor {
  _poolUrl = url;

  const sql = ((first: TemplateStringsArray | string, ...rest: unknown[]) => {
    if (typeof first === "string") {
      // Function-call form: raw SQL string, optionally with a params array,
      // e.g. sql("...$1...", [a]) or sql("...") with no params.
      const params = Array.isArray(rest[0]) ? (rest[0] as unknown[]) : [];
      return runSingleStatement(first, params);
    }
    return buildParameterizedQuery(first, rest);
  }) as unknown as SqlExecutor & {
    transaction: (queries: PgStatement[]) => Promise<unknown[]>;
  };

  (sql as unknown as { transaction: (queries: PgStatement[]) => Promise<unknown[]> }).transaction =
    (queries: PgStatement[]) => runTransaction(queries);

  return sql;
}

/** Test-only: closes the pooled pg connection so test runners can exit cleanly. */
export async function __closePgPoolForTests(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
  }
}

/**
 * Returns a sql executor for `url`. Local Postgres (localhost/127.0.0.1) or
 * SCRIBL_PG_DRIVER=node routes through the pg-backed adapter; everything else
 * (production, Neon-hosted) uses the real neon() HTTP driver, unchanged.
 */
export function makeSql(url: string): SqlExecutor {
  if (process.env.SCRIBL_PG_DRIVER === "node" || isLocalUrl(url)) {
    return makePgSql(url);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const neonModule = require("@neondatabase/serverless") as {
    neon: (connectionString: string) => SqlExecutor;
  };
  return neonModule.neon(url);
}
