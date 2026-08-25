/**
 * Full daily-loop integration test against the default mock adapter — the
 * exact data seam the screens drive (Today: getTodayPrompt/getStreak; Draw:
 * submit + recordSubmission; Wall: getChannelResponses + addReaction). This is
 * the authoritative, headless-safe proof of the steps whose UI path is gated by
 * the Skia canvas (which can't rasterize in node/headless Chromium): submit ->
 * unlock -> reaction -> streak increment.
 *
 * Uses jest.resetModules() + a fresh require so the mock's module-level overlay
 * state (submittedPromptIds / streakHistory / reactions) starts clean. The
 * mock adapter is a clean slate (no seeded users/history/responses/streak) —
 * TODAY is computed dynamically rather than hardcoded, and the expected
 * streak progression is 0 -> 1 (a fresh history, not a pre-seeded one).
 */

import type { DataClient } from "@/src/data/client";

const PROMPT_ID = "prompt-2026-07-01";
const TODAY = new Date().toISOString().slice(0, 10);
const CHANNEL_ID = "channel-alpha";

describe("daily loop end-to-end (mock seam)", () => {
  it("prompt -> locked -> submit -> unlock -> reaction, with streak 0 -> 1", async () => {
    jest.resetModules();
    const { mockDataClient: client }: { mockDataClient: DataClient } = require("@/src/data/mock");
    const { NotSubmittedError } = require("@/src/data/client");

    // 1) Today: prompt is present and unsubmitted; clean-slate streak is 0.
    const before = await client.getTodayPrompt();
    expect(before.prompt.id).toBe(PROMPT_ID);
    expect(before.submissionStatus.submitted).toBe(false);
    expect((await client.getStreak()).current).toBe(0);

    // 2) Wall is locked before submit (AC2 relayed as NotSubmittedError).
    await expect(client.getChannelResponses(CHANNEL_ID, PROMPT_ID)).rejects.toBeInstanceOf(
      NotSubmittedError,
    );

    // 3) Draw "Done": submit, then the wired streak record.
    await client.submit({
      promptId: PROMPT_ID,
      channelIds: [CHANNEL_ID],
      imageRef: "data:image/png;base64,ZmFrZQ==",
    });
    await client.recordSubmission(TODAY);

    // 4) Today now reflects the submission and the incremented streak (0 -> 1).
    const after = await client.getTodayPrompt();
    expect(after.submissionStatus.submitted).toBe(true);
    const streak = await client.getStreak();
    expect(streak.current).toBe(1);
    expect(streak.lastSubmittedDate).toBe(TODAY);

    // 5) Wall unlocks: shows the caller's own entry.
    const responseId = `response-user-unknown-${PROMPT_ID}-${CHANNEL_ID}`;
    const unlocked = await client.getChannelResponses(CHANNEL_ID, PROMPT_ID);
    expect(unlocked.responses.some((r) => r.id === responseId && r.authorName === "You")).toBe(
      true,
    );

    // 6) Reaction lands and is reflected on a subsequent read.
    await client.addReaction(CHANNEL_ID, PROMPT_ID, responseId, "🎉");
    const reacted = await client.getChannelResponses(CHANNEL_ID, PROMPT_ID);
    const own = reacted.responses.find((r) => r.id === responseId);
    expect(own?.reactions).toEqual(
      expect.arrayContaining([{ emoji: "🎉", userId: expect.any(String) }]),
    );
  });
});
