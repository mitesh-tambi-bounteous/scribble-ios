/**
 * GET /walls — caller identified via x-user-id. Returns channels the caller
 * is a member of.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ListWallsResponse } from "@scribl/shared/api";
import type { Channel } from "@scribl/shared/domain";
import { countChannelMembers, listWallsForUser } from "../data";
import { getCallerUserId } from "./identity";

/**
 * Matches a personal "Family" channel id of the form `channel-{userId}-family`.
 * NOTE (BF-13): Family is no longer auto-provisioned at signup — new users
 * start with only Personal Archive. This dedupe/rank logic is retained for
 * the BF-8/BF-9 shared-membership case where such Family channels exist
 * (e.g. created explicitly), and is simply dormant for users who have none.
 */
const FAMILY_CHANNEL_ID_PATTERN = /^channel-.+-family$/;

/**
 * BF-8 dedupe rule: on invite-accept/member-add, the invitee JOINS the
 * inviter's existing shared Family channel (member-add.ts) — she doesn't
 * leave her own auto-provisioned one. If she now belongs to more than one
 * "Family" channel, and her own auto-provisioned one is still empty (just
 * her), drop it from the list in favor of the shared/populated one. Does
 * NOT touch AC4 membership — this only reorders what's shown, never what a
 * non-member can read.
 */
async function dedupeAutoProvisionedFamilyChannel(
  walls: readonly Channel[],
  userId: string,
): Promise<readonly Channel[]> {
  const familyChannels = walls.filter((w) => FAMILY_CHANNEL_ID_PATTERN.test(w.id));
  if (familyChannels.length < 2) {
    return walls;
  }

  const ownAutoChannelId = `channel-${userId}-family`;
  const own = familyChannels.find((w) => w.id === ownAutoChannelId);
  const others = familyChannels.filter((w) => w.id !== ownAutoChannelId);
  if (!own || others.length === 0) {
    return walls;
  }

  const [ownMemberCount, otherMemberCounts] = await Promise.all([
    countChannelMembers(own.id),
    Promise.all(others.map((w) => countChannelMembers(w.id))),
  ]);
  const hasPopulatedShared = otherMemberCounts.some((n) => n > 1);
  if (ownMemberCount <= 1 && hasPopulatedShared) {
    return walls.filter((w) => w.id !== own.id);
  }
  return walls;
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Sort key for the caller's own auto-provisioned personal channels, so the
 * picker reads sensibly: Personal Archive, then Family/Friends/Co-Workers,
 * then any user-created groups last. Rank is derived from the deterministic
 * `channel-{userId}-{suffix}` id scheme (auth-signup.ts).
 */
function personalRank(channel: Channel, userId: string): number {
  const order = ["archive", "family", "friends", "coworkers"];
  for (let i = 0; i < order.length; i += 1) {
    if (channel.id === `channel-${userId}-${order[i]}`) {
      return i;
    }
  }
  return order.length + 1;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const walls = await listWallsForUser(userId);
    const deduped = await dedupeAutoProvisionedFamilyChannel(walls, userId);
    const ordered = [...deduped].sort(
      (a, b) => personalRank(a, userId) - personalRank(b, userId),
    );
    const response: ListWallsResponse = { walls: ordered };
    return jsonResponse(200, response);
  } catch (err) {
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
