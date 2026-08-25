/**
 * sql-driver: integration test for the pg-backed adapter against a REAL
 * local Postgres. Skipped by default; the mock-only `npm test` run must
 * never require a database.
 *
 * To run against the local container (see backend/README or WS0 notes):
 *   docker run/compose up scribl-pg on localhost:5433 (db scribl, user
 *   scribl, password scribl), then:
 *
 *   SCRIBL_PG_IT=1 SCRIBL_PG_TEST_URL=postgres://scribl:scribl@localhost:5433/scribl \
 *     npx jest tests/sql-driver.test.ts
 *
 * If SCRIBL_PG_IT is unset, or the DB is unreachable, all tests skip (not
 * fail) so this file is safe to leave in the normal jest run.
 */
import { makeSql, __closePgPoolForTests } from "@/backend/lambda/data/sql-driver";

const RUN_IT = process.env.SCRIBL_PG_IT === "1";
const TEST_URL =
  process.env.SCRIBL_PG_TEST_URL ?? "postgres://scribl:scribl@localhost:5433/scribl";

type MaybeDescribe = typeof describe | typeof describe.skip;
const maybeDescribe: MaybeDescribe = RUN_IT ? describe : describe.skip;

maybeDescribe("sql-driver: pg adapter against local Postgres (SCRIBL_PG_IT=1)", () => {
  let sql: ReturnType<typeof makeSql>;
  let reachable = true;

  beforeAll(async () => {
    sql = makeSql(TEST_URL);
    try {
      await sql`SELECT 1 AS ok`;
    } catch {
      reachable = false;
    }
  });

  it("tagged-template SELECT with params returns rows", async () => {
    if (!reachable) return;
    // pg returns untyped params as text (no column type to coerce to), so
    // compare loosely on the numeric param rather than assert a strict type.
    const rows = (await sql`SELECT ${1} AS a, ${"x"} AS b`) as Array<{
      a: number | string;
      b: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.a)).toBe(1);
    expect(rows[0]?.b).toBe("x");
  });

  it("function-call form executes raw DDL", async () => {
    if (!reachable) return;
    await sql("CREATE TABLE IF NOT EXISTS sql_driver_it_test (id INT PRIMARY KEY)");
    const rows = (await sql("SELECT 1 AS ok")) as Array<{ ok: number }>;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it("transaction commits all statements together", async () => {
    if (!reachable) return;
    await sql("DELETE FROM sql_driver_it_test");
    await (sql as unknown as { transaction: (q: unknown[]) => Promise<unknown[]> }).transaction([
      sql`INSERT INTO sql_driver_it_test (id) VALUES (${1})`,
      sql`INSERT INTO sql_driver_it_test (id) VALUES (${2})`,
    ]);
    const rows = (await sql("SELECT id FROM sql_driver_it_test ORDER BY id")) as Array<{
      id: number;
    }>;
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("transaction rolls back all statements on failure", async () => {
    if (!reachable) return;
    await sql("DELETE FROM sql_driver_it_test");
    await expect(
      (sql as unknown as { transaction: (q: unknown[]) => Promise<unknown[]> }).transaction([
        sql`INSERT INTO sql_driver_it_test (id) VALUES (${3})`,
        sql`INSERT INTO sql_driver_it_test (id) VALUES (${3})`, // duplicate PK -> fails
      ]),
    ).rejects.toThrow();
    const rows = (await sql("SELECT id FROM sql_driver_it_test ORDER BY id")) as Array<{
      id: number;
    }>;
    expect(rows).toEqual([]);
  });

  it("DATE columns come back as YYYY-MM-DD strings, matching Neon", async () => {
    if (!reachable) return;
    const rows = (await sql("SELECT prompt_date FROM prompts LIMIT 1")) as Array<{
      prompt_date: unknown;
    }>;
    if (rows.length === 0) return; // no seed data present; nothing to assert
    expect(typeof rows[0]?.prompt_date).toBe("string");
    expect(rows[0]?.prompt_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("TIMESTAMPTZ columns come back as Z-suffixed ISO strings, matching Neon", async () => {
    if (!reachable) return;
    const rows = (await sql("SELECT created_at FROM prompts LIMIT 1")) as Array<{
      created_at: unknown;
    }>;
    if (rows.length === 0) return; // no seed data present; nothing to assert
    expect(typeof rows[0]?.created_at).toBe("string");
    expect(rows[0]?.created_at).toMatch(/Z$/);
  });

  afterAll(async () => {
    if (!reachable) {
      await __closePgPoolForTests();
      return;
    }
    await sql("DROP TABLE IF EXISTS sql_driver_it_test");
    await __closePgPoolForTests();
  });
});
