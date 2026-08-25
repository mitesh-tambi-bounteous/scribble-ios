/**
 * Onboarding-store tests (src/stores/useOnboardingStore.ts). Mirrors
 * tests/useStreakStore.test.ts: mocks the AsyncStorage seam directly and
 * confirms checkOnboarded()/completeOnboarding() reflect success/failure
 * into { hasOnboarded, loading, error } — screens read only from this
 * store, never touching AsyncStorage directly.
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useOnboardingStore } from "@/src/stores/useOnboardingStore";

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({ hasOnboarded: null, loading: false, error: null });
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it("has an initial state of { hasOnboarded: null, loading: false, error: null }", () => {
    expect(useOnboardingStore.getState()).toMatchObject({
      hasOnboarded: null,
      loading: false,
      error: null,
    });
  });

  it("checkOnboarded() sets hasOnboarded false when storage has no value (first run)", async () => {
    mockGetItem.mockResolvedValueOnce(null);

    await useOnboardingStore.getState().checkOnboarded();

    expect(mockGetItem).toHaveBeenCalledWith("scribl:hasOnboarded");
    expect(useOnboardingStore.getState().hasOnboarded).toBe(false);
    expect(useOnboardingStore.getState().loading).toBe(false);
    expect(useOnboardingStore.getState().error).toBeNull();
  });

  it("checkOnboarded() sets hasOnboarded true when storage value is \"true\"", async () => {
    mockGetItem.mockResolvedValueOnce("true");

    await useOnboardingStore.getState().checkOnboarded();

    expect(useOnboardingStore.getState().hasOnboarded).toBe(true);
    expect(useOnboardingStore.getState().loading).toBe(false);
    expect(useOnboardingStore.getState().error).toBeNull();
  });

  it("checkOnboarded() failure sets error and leaves hasOnboarded at its default", async () => {
    mockGetItem.mockRejectedValueOnce(new Error("boom"));

    await useOnboardingStore.getState().checkOnboarded();

    expect(useOnboardingStore.getState().error).toBe("boom");
    expect(useOnboardingStore.getState().loading).toBe(false);
    expect(useOnboardingStore.getState().hasOnboarded).toBeNull();
  });

  it("completeOnboarding() writes \"true\" to storage and sets hasOnboarded true", async () => {
    mockSetItem.mockResolvedValueOnce(undefined);

    await useOnboardingStore.getState().completeOnboarding();

    expect(mockSetItem).toHaveBeenCalledWith("scribl:hasOnboarded", "true");
    expect(useOnboardingStore.getState().hasOnboarded).toBe(true);
    expect(useOnboardingStore.getState().loading).toBe(false);
    expect(useOnboardingStore.getState().error).toBeNull();
  });

  it("completeOnboarding() failure sets error and leaves hasOnboarded at its default", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("write failed"));

    await useOnboardingStore.getState().completeOnboarding();

    expect(useOnboardingStore.getState().error).toBe("write failed");
    expect(useOnboardingStore.getState().loading).toBe(false);
    expect(useOnboardingStore.getState().hasOnboarded).toBeNull();
  });
});
