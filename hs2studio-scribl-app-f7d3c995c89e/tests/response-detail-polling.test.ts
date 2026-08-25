/**
 * Unit test for the bounded-polling decision helper used by
 * useResponseDetailStore (T5). Kept pure so it's testable without fake
 * timers on the store/zustand itself.
 */

import {
  ENHANCEMENT_POLL_MAX_ATTEMPTS,
  shouldContinuePolling,
} from "@/src/stores/useResponseDetailStore";

describe("shouldContinuePolling", () => {
  it("continues while status is pending and under the attempt cap", () => {
    expect(shouldContinuePolling("pending", 0)).toBe(true);
    expect(shouldContinuePolling("pending", ENHANCEMENT_POLL_MAX_ATTEMPTS - 1)).toBe(true);
  });

  it("stops once the attempt cap is hit, even if still pending", () => {
    expect(shouldContinuePolling("pending", ENHANCEMENT_POLL_MAX_ATTEMPTS)).toBe(false);
  });

  it("stops on ready", () => {
    expect(shouldContinuePolling("ready", 0)).toBe(false);
  });

  it("stops on failed", () => {
    expect(shouldContinuePolling("failed", 0)).toBe(false);
  });

  it("stops on undefined status", () => {
    expect(shouldContinuePolling(undefined, 0)).toBe(false);
  });
});
