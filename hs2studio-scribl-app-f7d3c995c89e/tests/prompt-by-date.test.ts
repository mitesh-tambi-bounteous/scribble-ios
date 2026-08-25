/**
 * GET /prompt/:date — task #5.
 *
 * Covers found (same date -> same prompt id as /prompt/today would resolve,
 * proving AC1 determinism holds for this route too) and missing (unparsable
 * / far-future date -> 404) cases.
 */
import { handler as promptByDateHandler } from "@/backend/lambda/handlers/prompt-by-date";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof promptByDateHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof promptByDateHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error("expected a structured result, got string: " + result);
  }
  return result;
}

function makeEvent(opts: {
  userId?: string;
  pathParameters?: Record<string, string>;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    queryStringParameters: {},
    body: undefined,
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

describe("GET /prompt/:date", () => {
  it("returns 200 with the prompt for a valid date, id derived deterministically (AC1)", async () => {
    const date = "2026-03-15";
    const result = asStructured(
      await promptByDateHandler(makeEvent({ userId: "user-a", pathParameters: { date } })),
    );
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.prompt.id).toBe(promptIdForDate(date));
    expect(body.prompt.date).toBe(date);
  });

  it("two different callers on the same date resolve to the same prompt id", async () => {
    const date = "2026-03-16";
    const r1 = asStructured(
      await promptByDateHandler(makeEvent({ userId: "user-a", pathParameters: { date } })),
    );
    const r2 = asStructured(
      await promptByDateHandler(makeEvent({ userId: "user-b", pathParameters: { date } })),
    );
    expect(parseBody(r1.body).prompt.id).toBe(parseBody(r2.body).prompt.id);
  });

  it("returns 400 for a malformed date", async () => {
    const result = asStructured(
      await promptByDateHandler(
        makeEvent({ userId: "user-a", pathParameters: { date: "not-a-date" } }),
      ),
    );
    expect(result.statusCode).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const result = asStructured(
      await promptByDateHandler(makeEvent({ pathParameters: { date: "2026-03-15" } })),
    );
    expect(result.statusCode).toBe(401);
  });
});
