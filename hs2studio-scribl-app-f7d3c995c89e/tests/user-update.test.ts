/**
 * user-update — PATCH /users/{id} (self-only, caller via x-user-id).
 *
 * The caller may only update their own user record. displayName/email/
 * avatarColor are the only writable fields; at least one must be present and
 * valid.
 */
import { handler as userUpdateHandler } from "@/backend/lambda/handlers/user-update";
import { resetMockUsers, createUser } from "@/backend/lambda/data/dynamodb-client";

type EventArg = Parameters<typeof userUpdateHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof userUpdateHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error(
      "expected a structured result ({ statusCode, body }), got string: " + result,
    );
  }
  return result;
}

function makeEvent(opts: {
  userId?: string;
  pathParameters?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    body: opts.rawBody !== undefined ? opts.rawBody : opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

describe("user-update — PATCH /users/{id} self-only gate", () => {
  beforeEach(() => {
    resetMockUsers();
  });

  it("200: caller PATCHes their own id with displayName -> updated user returned", async () => {
    const user = await createUser("selfupdate@example.com", "Original Name");

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: user.id,
          pathParameters: { id: user.id },
          body: { displayName: "New Name" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.user.id).toBe(user.id);
    expect(body.user.displayName).toBe("New Name");
  });

  it("200: caller PATCHes email and avatarColor together", async () => {
    const user = await createUser("multi@example.com", "Multi User");

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: user.id,
          pathParameters: { id: user.id },
          body: { email: "multi-new@example.com", avatarColor: "#ff0000" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.user.email).toBe("multi-new@example.com");
    expect(body.user.avatarColor).toBe("#ff0000");
  });

  it("200: caller PATCHes avatarImage (hand-drawn avatar data-URI) -> persisted", async () => {
    const user = await createUser("avatar@example.com", "Avatar User");
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: user.id,
          pathParameters: { id: user.id },
          body: { avatarImage: dataUri },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.user.avatarImage).toBe(dataUri);
  });

  it("400 invalid_request: empty body", async () => {
    const user = await createUser("emptybody@example.com", "Empty Body");

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: user.id,
          pathParameters: { id: user.id },
          body: {},
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("400 invalid_request: malformed JSON body", async () => {
    const user = await createUser("malformed@example.com", "Malformed");

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: user.id,
          pathParameters: { id: user.id },
          rawBody: "{not valid json",
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("403: caller id !== path id (self-only)", async () => {
    const owner = await createUser("owner@example.com", "Owner");
    const OTHER_CALLER = "user-someone-else";

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          userId: OTHER_CALLER,
          pathParameters: { id: owner.id },
          body: { displayName: "Hijacked" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_authorized");
  });

  it("401 unauthenticated: no x-user-id header", async () => {
    const user = await createUser("noauth@example.com", "No Auth");

    const result = asStructured(
      await userUpdateHandler(
        makeEvent({
          pathParameters: { id: user.id },
          body: { displayName: "Nope" },
        }),
      ),
    );

    expect(result.statusCode).toBe(401);
    expect(parseBody(result.body).error).toBe("unauthenticated");
  });
});
