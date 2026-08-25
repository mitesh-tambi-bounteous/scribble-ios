/**
 * DynamoDB single-table key schema for the Scribl POC.
 *
 * NOTE on ADR 0004: production's system of record is Aurora Serverless v2
 * (Postgres) — ADR 0004 revised away from DynamoDB. This POC slice uses
 * DynamoDB on purpose (cheap to demonstrate AC1/AC2/AC4 invariants via CDK).
 * The data-access layer (dynamodb-client.ts) is kept thin so the store can
 * be swapped for Aurora later without touching handler code.
 *
 * Single-table access patterns (PK/SK), all satisfied by point lookups or
 * simple queries — no GSIs needed for the POC slice:
 *
 *   Entity        PK                    SK                  Access pattern
 *   ------------  --------------------  ------------------  --------------------------------
 *   Prompt        PROMPT#<date>         PROMPT#<date>       Get today's prompt (by date) (S-001, live)
 *   Submission    USER#<userId>         SUBMISSION#<promptId>  Point EXISTS check: has this user
 *                                                              submitted this prompt? (AC2 / S-003)
 *   ChannelResp   CHANNEL#<channelId>   RESPONSE#<promptId>#<responseId>
 *                                                           Query: list a channel's responses for
 *                                                           a prompt, scoped to one channel (AC4 / S-004)
 *   Membership    CHANNEL#<channelId>   MEMBER#<userId>     Point lookup: is this user a member of
 *                                                              this channel? (AC4 / S-004)
 *
 * Submission and Membership are both modeled as point-lookup items
 * specifically so the future S-003/S-004 handlers can authorize with a
 * single GetItem each, ahead of returning any peer content (ADR 0007 risk
 * note: keep the authz check off the latency budget).
 */

export function promptKey(date: string): { pk: string; sk: string } {
  return { pk: `PROMPT#${date}`, sk: `PROMPT#${date}` };
}

export function submissionKey(userId: string, promptId: string): { pk: string; sk: string } {
  return { pk: `USER#${userId}`, sk: `SUBMISSION#${promptId}` };
}

export function channelResponseKey(
  channelId: string,
  promptId: string,
  responseId: string,
): { pk: string; sk: string } {
  return { pk: `CHANNEL#${channelId}`, sk: `RESPONSE#${promptId}#${responseId}` };
}

export function channelResponseSkPrefix(promptId: string): string {
  return `RESPONSE#${promptId}#`;
}

export function membershipKey(channelId: string, userId: string): { pk: string; sk: string } {
  return { pk: `CHANNEL#${channelId}`, sk: `MEMBER#${userId}` };
}

/** Logical item-type discriminator stored alongside PK/SK (for debugging / future GSIs). */
export type ItemType = "PROMPT" | "SUBMISSION" | "CHANNEL_RESPONSE" | "MEMBERSHIP";
