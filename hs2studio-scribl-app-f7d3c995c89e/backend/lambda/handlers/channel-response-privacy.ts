/**
 * Server-side masking for ChannelResponse.backgroundPrompt.
 *
 * backgroundPrompt is the creator's PRIVATE AI background-steering prompt
 * (see domain.ts ChannelResponse.backgroundPrompt doc). It must be visible
 * to the response's own author only — every other channel member reading
 * the same wall must get it stripped, regardless of what the data layer
 * returned. This is enforced here, not left to client-side `isOwner` checks.
 */
import type { ChannelMember, ChannelResponse } from "@scribl/shared/domain";

/** Returns a copy of `response` with backgroundPrompt removed unless the caller is its author. */
export function maskBackgroundPromptIfForeign(
  response: ChannelResponse,
  callerId: string,
): ChannelResponse {
  if (response.authorId === callerId) {
    return response;
  }
  const { backgroundPrompt: _backgroundPrompt, ...rest } = response;
  return rest;
}

/** Maps a list of channel responses, masking backgroundPrompt on every non-caller-authored one. */
export function maskForeignBackgroundPrompt(
  responses: readonly ChannelResponse[],
  callerId: string,
): ChannelResponse[] {
  return responses.map((response) => maskBackgroundPromptIfForeign(response, callerId));
}

/** Same masking applied to each member's embedded `response`, when present. */
export function maskForeignBackgroundPromptOnMembers(
  members: readonly ChannelMember[],
  callerId: string,
): ChannelMember[] {
  return members.map((member) =>
    member.response
      ? { ...member, response: maskBackgroundPromptIfForeign(member.response, callerId) }
      : member,
  );
}
