/**
 * POST /channels/{id}/challenges - creates a blind draw-off challenge.
 *
 * Membership gate: only a member of the channel may create a challenge in
 * it. This mirrors the AC4 membership check in channel-responses.ts and is
 * server-side (getMembership), never a client-supplied flag.
 *
 * Validates drawSeconds (per-drawing timer, 10..3600), toolset (non-empty
 * subsets of BRUSH_STYLE_IDS/PALETTE), and an optional backgroundRef (a PNG
 * data URI, capped at 2_000_000 chars). Challenges are open-ended - there is
 * no deadline/duration here.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, CreateChallengeRequest, CreateChallengeResponse } from "@scribl/shared/api";
import { BRUSH_STYLE_IDS, PALETTE } from "@scribl/shared/tools";
import { createChallenge, getMembership } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { jsonResponse } from "./challenge-shared";

const MIN_DRAW_SECONDS = 10;
const MAX_DRAW_SECONDS = 3600;
const MAX_BACKGROUND_REF_LENGTH = 2_000_000;

const VALID_BRUSH_STYLES: readonly string[] = BRUSH_STYLE_IDS;
const VALID_COLORS: readonly string[] = PALETTE;

const VALIDATION_MESSAGE =
  "word (non-empty string), drawSeconds (integer 10..3600), and toolset " +
  "(non-empty brushes/colors subsets) are required";

function isNonEmptySubset(values: unknown, allowed: readonly string[]): values is string[] {
  if (!Array.isArray(values) || values.length === 0) {
    return false;
  }
  return values.every((value) => typeof value === "string" && allowed.includes(value));
}

function isValidRequest(parsed: CreateChallengeRequest | undefined): parsed is CreateChallengeRequest {
  if (!parsed) {
    return false;
  }
  if (typeof parsed.word !== "string" || parsed.word.trim().length === 0) {
    return false;
  }
  if (
    typeof parsed.drawSeconds !== "number" ||
    !Number.isInteger(parsed.drawSeconds) ||
    parsed.drawSeconds < MIN_DRAW_SECONDS ||
    parsed.drawSeconds > MAX_DRAW_SECONDS
  ) {
    return false;
  }
  if (!parsed.toolset || typeof parsed.toolset !== "object") {
    return false;
  }
  if (!isNonEmptySubset(parsed.toolset.brushes, VALID_BRUSH_STYLES)) {
    return false;
  }
  if (!isNonEmptySubset(parsed.toolset.colors, VALID_COLORS)) {
    return false;
  }
  if (parsed.backgroundRef !== undefined) {
    if (typeof parsed.backgroundRef !== "string" || !parsed.backgroundRef.startsWith("data:image/")) {
      return false;
    }
    if (parsed.backgroundRef.length >= MAX_BACKGROUND_REF_LENGTH) {
      return false;
    }
  }
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];

    if (!channelId || channelId.length === 0) {
      const error: ApiError = { error: "invalid_request", message: "channelId (path) is required" };
      return jsonResponse(400, error);
    }

    let parsed: CreateChallengeRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as CreateChallengeRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!isValidRequest(parsed)) {
      const error: ApiError = { error: "invalid_request", message: VALIDATION_MESSAGE };
      return jsonResponse(400, error);
    }

    const isMember = await getMembership(channelId, callerId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to create a challenge",
      };
      return jsonResponse(403, error);
    }

    const challenge = await createChallenge({
      channelId,
      creatorId: callerId,
      word: parsed.word,
      drawSeconds: parsed.drawSeconds,
      toolset: parsed.toolset,
      backgroundRef: parsed.backgroundRef,
    });

    const response: CreateChallengeResponse = { challenge };
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
