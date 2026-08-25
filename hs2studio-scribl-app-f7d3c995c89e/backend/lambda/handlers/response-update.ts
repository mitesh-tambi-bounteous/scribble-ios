/**
 * PATCH /channels/{id}/responses/{responseId} - creator-only edit/regenerate.
 *
 * AC4 channel isolation (S-004): server-side membership check
 * (data.getMembership) against the caller's server-resolved identity.
 * Non-member -> HTTP 403. Runs before the creator gate.
 *
 * CREATOR GATE (launch-relevant, mirrors user-update.ts's self-only gate and
 * reaction-add.ts's authorId check): only the response's own author may edit
 * its caption/backgroundPrompt or trigger a regenerate. Enforced against the
 * already-loaded response's authorId — never a client-supplied claim ->
 * HTTP 403 not_authorized.
 *
 * On regenerate=true, fires the enhance pipeline fire-and-forget (never
 * awaited, mirrors submit.ts) with the effective backgroundPrompt (the new
 * body value if provided, else whatever was already stored on the response)
 * threaded through as user steering.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, UpdateResponseRequest } from "@scribl/shared/api";
import type { ChannelResponse } from "@scribl/shared/domain";
import { getMembership, getPromptById, getResponseById, markEnhancementPending, updateResponse } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { triggerEnhancement } from "../enhance/trigger";
import { isEnhanceEnabled } from "../enhance/config";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: UpdateResponseRequest | undefined): parsed is UpdateResponseRequest {
  if (!parsed) {
    return false;
  }
  const hasText = typeof parsed.text === "string";
  const hasBackgroundPrompt = typeof parsed.backgroundPrompt === "string";
  const hasRegenerate = typeof parsed.regenerate === "boolean";
  return hasText || hasBackgroundPrompt || hasRegenerate;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];
    const responseId = event.pathParameters?.["responseId"];

    let parsed: UpdateResponseRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as UpdateResponseRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (
      !channelId ||
      channelId.length === 0 ||
      !responseId ||
      responseId.length === 0 ||
      !isValidRequest(parsed)
    ) {
      const error: ApiError = {
        error: "invalid_request",
        message:
          "channelId + responseId (path) and at least one of text/backgroundPrompt/regenerate (body) are required",
      };
      return jsonResponse(400, error);
    }

    const target = await getResponseById(responseId);
    if (!target) {
      const error: ApiError = {
        error: "not_found",
        message: "no such response",
      };
      return jsonResponse(404, error);
    }

    // AC4 gate: server-side membership authz, before the creator gate.
    // Ignores any client-supplied member/unlocked claim entirely.
    const isMember = await getMembership(channelId, userId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to edit its responses",
      };
      return jsonResponse(403, error);
    }

    // Creator gate: enforced against the already-loaded response's authorId,
    // never a client claim. Only the author may edit/regenerate their own
    // response.
    if (target.authorId !== userId) {
      const error: ApiError = {
        error: "not_authorized",
        message: "you may only edit your own response",
      };
      return jsonResponse(403, error);
    }

    const { text, backgroundPrompt, regenerate } = parsed;

    if (text !== undefined || backgroundPrompt !== undefined) {
      await updateResponse(responseId, { text, backgroundPrompt });
    }

    // Master kill-switch gate: when AI enhancement is off, skip mark-pending
    // + trigger entirely. Without this gate, markEnhancementPending would
    // flip status to "pending" and triggerEnhancement would then no-op
    // (see trigger.ts), leaving the response stuck at "pending" forever —
    // the client polls, times out, and forces a false "failed"/unavailable
    // state. Caption/backgroundPrompt edits above are unaffected by this gate.
    if (regenerate === true && isEnhanceEnabled()) {
      // Flip status to "pending" (without touching enhanced_image_ref, so
      // the previous background stays visible — no flash-to-blank) BEFORE
      // firing the enhance pipeline, so the client's polling/spinner kicks
      // in immediately rather than only on reload. setEnhancementResult's
      // status param is typed "ready" | "failed" only (see data/index.ts),
      // so this dedicated mark-pending path is what makes "pending"
      // observable; triggerEnhancement's own async body persists
      // "ready"/"failed" via setEnhancementResult when it settles.
      await markEnhancementPending(responseId);

      const effectiveBackgroundPrompt = backgroundPrompt !== undefined ? backgroundPrompt : target.backgroundPrompt;

      void (async (): Promise<void> => {
        let promptContext: string | undefined;
        try {
          const prompt = await getPromptById(target.promptId);
          promptContext = prompt?.text;
        } catch {
          // best-effort prompt-text lookup; never blocks regenerate
        }
        triggerEnhancement({
          responseId,
          imageDataUri: target.imageRef,
          promptContext,
          backgroundPrompt: effectiveBackgroundPrompt,
        });
      })();
    }

    const updated = await getResponseById(responseId);
    const response: { response: ChannelResponse } = { response: updated ?? target };
    return jsonResponse(200, response);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      const error: ApiError = { error: "unauthenticated", message: err.message };
      return jsonResponse(401, error);
    }
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
