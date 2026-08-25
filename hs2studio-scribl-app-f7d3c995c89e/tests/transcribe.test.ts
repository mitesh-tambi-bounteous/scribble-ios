/**
 * POST /transcribe — voice-to-text behind the transcription seam (T3).
 *
 * Default (stub) adapter must return a deterministic transcript with no API
 * key set, so e2e/CI stay green.
 */
import { handler as transcribeHandler } from "@/backend/lambda/handlers/transcribe";
import { STUB_TRANSCRIPT } from "@/backend/lambda/transcription";

type EventArg = Parameters<typeof transcribeHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof transcribeHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error(
      "expected a structured result ({ statusCode, body }), got string: " + result,
    );
  }
  return result;
}

function makeEvent(opts: { userId?: string; body?: unknown }): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

describe("POST /transcribe (T3 — provider seam, stub default)", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.STT_PROVIDER;
    delete process.env.STT_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("stub mode (default) -> 200 with the deterministic transcript", async () => {
    const result = asStructured(
      await transcribeHandler(
        makeEvent({
          userId: "user-1",
          body: { audioBase64: "ZmFrZS1hdWRpby1ieXRlcw==", mimeType: "audio/webm" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).transcript).toBe(STUB_TRANSCRIPT);
  });

  it("missing audioBase64 -> 400 invalid_request", async () => {
    const result = asStructured(
      await transcribeHandler(
        makeEvent({ userId: "user-1", body: { mimeType: "audio/webm" } }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("empty audioBase64 -> 400 invalid_request", async () => {
    const result = asStructured(
      await transcribeHandler(
        makeEvent({
          userId: "user-1",
          body: { audioBase64: "", mimeType: "audio/webm" },
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("unauthenticated (no x-user-id) -> 401", async () => {
    const result = asStructured(
      await transcribeHandler(
        makeEvent({ body: { audioBase64: "ZmFrZQ==", mimeType: "audio/webm" } }),
      ),
    );

    expect(result.statusCode).toBe(401);
    expect(parseBody(result.body).error).toBe("unauthenticated");
  });

  it("BF-5: cloud provider requested without an API key -> 500, never silently serves the stub", async () => {
    process.env.STT_PROVIDER = "cloud";

    const result = asStructured(
      await transcribeHandler(
        makeEvent({
          userId: "user-1",
          body: { audioBase64: "ZmFrZS1hdWRpby1ieXRlcw==", mimeType: "audio/webm" },
        }),
      ),
    );

    expect(result.statusCode).toBe(500);
    expect(parseBody(result.body).message).toMatch(/STT_API_KEY|OPENAI_API_KEY/);
  });
});
