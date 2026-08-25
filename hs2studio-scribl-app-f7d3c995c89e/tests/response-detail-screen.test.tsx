/**
 * WS4b-2 / W3a screen test for the Response detail screen (app/response/[id].tsx).
 *
 * Confirms real stored data drives the screen: author name/caption come from
 * the store's data (no "Marcus"/"burnt sienna" fallbacks), reaction counts
 * seed from data.reactions (not the old 41/18/7 constants), a real imageRef
 * renders as an Image instead of the synthetic Doodle, the enhanced-toggle
 * image (detail variant) drives original/enhanced display, the shared
 * Avatar renders the author's real color, share carries enhancement
 * params, and back uses goBack("/home").
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";

const mockLoad = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({
    id: "response-alice-1",
    channelId: "channel-1",
    promptId: "prompt-x",
  }),
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (href: unknown) => mockReplace(href),
  },
}));

jest.mock("@/src/stores/useResponseDetailStore", () => ({
  useResponseDetailStore: jest.fn(),
}));

jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: () => ({ walls: [{ id: "channel-1", name: "Family" }], load: jest.fn() }),
}));

// The viewer ("user-me") — distinct from the reaction authors below, so no
// reaction renders as the current user's own (active) by default.
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string } }) => unknown) =>
    selector({ currentUser: { id: "user-me" } }),
}));

// Default to AI ON for this file's primary suite; the "AI_ENABLED=false"
// suite below overrides via jest.resetModules() + a scoped jest.doMock.
jest.mock("@/src/config/features", () => ({ AI_ENABLED: true }));

import { useResponseDetailStore } from "@/src/stores/useResponseDetailStore";
import ResponseDetailScreen from "../app/response/[id]";

const mockUseResponseDetailStore = useResponseDetailStore as unknown as jest.Mock;

describe("ResponseDetailScreen (WS4b-2)", () => {
  beforeEach(() => {
    mockLoad.mockClear();
    mockBack.mockClear();
    mockPush.mockClear();
    mockCanGoBack.mockClear();
    mockReplace.mockClear();
  });

  it("renders the real author, caption, and reaction counts from data (no fabricated fallbacks)", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        text: "A very sleepy cat.",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [
          { emoji: "❤️", userId: "user-bob" },
          { emoji: "❤️", userId: "user-carl" },
        ],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-author").props.children).toBe("Alice");
    expect(screen.getByTestId("response-caption").props.children).toBe("A very sleepy cat.");
    expect(screen.queryByText("Marcus")).toBeNull();
    expect(screen.queryByText(/burnt sienna/)).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByTestId("response-image")).toBeNull();
  });

  it("renders a real stored drawing as an Image when imageRef is present", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        imageRef: "data:image/png;base64,AAAA",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-image")).toBeTruthy();
  });

  it("shows the enhanced image by default and flips to original via the toggle", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        imageRef: "data:image/png;base64,AAAA",
        enhancedImageRef: "data:image/png;base64,BBBB",
        enhancementStatus: "ready",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("enhanced-image")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("enhance-toggle"));

    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });

  it("renders the author avatar with the real authorAvatarColor", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        authorAvatarColor: "#123456",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    const avatar = screen.getByText("A").parent;
    expect(avatar?.props.style.backgroundColor).toBe("#123456");
  });

  it("includes enhancement params when sharing", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        imageRef: "data:image/png;base64,AAAA",
        enhancedImageRef: "data:image/png;base64,BBBB",
        enhancementStatus: "ready",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    await fireEvent.press(screen.getByLabelText("Share"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/share",
      params: expect.objectContaining({
        enhancedImageRef: "data:image/png;base64,BBBB",
        enhancementStatus: "ready",
      }),
    });
  });

  it("goes back using goBack fallback semantics", async () => {
    mockCanGoBack.mockReturnValue(true);
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    await fireEvent.press(screen.getByLabelText("Go back"));

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it("reaction tap updates in place without re-triggering a full (spinner) load", async () => {
    const mockAddReaction = jest.fn().mockResolvedValue(undefined);
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: mockAddReaction,
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);
    expect(mockLoad).toHaveBeenCalledTimes(1); // mount load only

    await fireEvent.press(screen.getByTestId("reaction-heart"));
    await waitFor(() =>
      expect(mockAddReaction).toHaveBeenCalledWith(
        "channel-1",
        "prompt-x",
        "response-alice-1",
        "❤️",
      ),
    );
    // Flush the addReaction promise chain so a buggy `.then(load)` would fire.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // addReaction already writes the server echo into `data`; a non-silent
    // load() would flip loading:true and flash the full-screen spinner.
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("resets the Save label when the caption is edited after a save", async () => {
    const mockUpdateResponse = jest.fn().mockResolvedValue(undefined);
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-me",
        authorName: "Me",
        text: "My own caption",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      updateResponse: mockUpdateResponse,
      regenerate: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    await fireEvent.press(screen.getByTestId("response-save-button"));
    await screen.findByText("Saved");

    await fireEvent.changeText(screen.getByTestId("response-caption-input"), "Edited caption");

    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("owner (currentUserId === authorId) sees owner-edit controls, not the read-only caption", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-me",
        authorName: "Me",
        text: "My own caption",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      updateResponse: jest.fn(),
      regenerate: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-owner-edit")).toBeTruthy();
    expect(screen.getByTestId("response-caption-input")).toBeTruthy();
    expect(screen.getByTestId("response-background-prompt-input")).toBeTruthy();
    expect(screen.getByTestId("response-save-button")).toBeTruthy();
    expect(screen.queryByTestId("response-caption")).toBeNull();
  });

  it("non-owner (currentUserId !== authorId) sees read-only caption, not owner-edit controls", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        text: "Alice's caption",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      updateResponse: jest.fn(),
      regenerate: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-caption")).toBeTruthy();
    expect(screen.queryByTestId("response-owner-edit")).toBeNull();
  });
});

describe("ResponseDetailScreen (AI_ENABLED=false)", () => {
  // See enhanced-toggle-image.test.tsx: the mocked features module is a live
  // CommonJS binding, so flipping this field retroactively changes what the
  // already-imported screen sees — no resetModules/re-require needed.
  const features = jest.requireMock("@/src/config/features") as { AI_ENABLED: boolean };

  beforeEach(() => {
    mockLoad.mockClear();
    features.AI_ENABLED = false;
  });

  afterAll(() => {
    features.AI_ENABLED = true;
  });

  it("owner sees only caption + save, no toggle/background-prompt/regenerate", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-me",
        authorName: "Me",
        text: "My own caption",
        imageRef: "data:image/png;base64,AAAA",
        enhancedImageRef: "data:image/png;base64,BBBB",
        enhancementStatus: "ready",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      updateResponse: jest.fn(),
      regenerate: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-owner-edit")).toBeTruthy();
    expect(screen.getByTestId("response-caption-input")).toBeTruthy();
    expect(screen.getByTestId("response-save-button")).toBeTruthy();
    expect(screen.queryByTestId("response-background-prompt-input")).toBeNull();
    expect(screen.queryByTestId("response-regenerate-button")).toBeNull();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });

  it("non-owner sees no AI chrome even when enhancement is ready", async () => {
    mockUseResponseDetailStore.mockReturnValue({
      data: {
        id: "response-alice-1",
        promptId: "prompt-x",
        channelId: "channel-1",
        authorId: "user-alice",
        authorName: "Alice",
        text: "Alice's caption",
        imageRef: "data:image/png;base64,AAAA",
        enhancedImageRef: "data:image/png;base64,BBBB",
        enhancementStatus: "ready",
        createdAt: "2026-07-01T09:00:00.000Z",
        reactions: [],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      addReaction: jest.fn(),
      startEnhancementPolling: jest.fn(() => jest.fn()),
    });

    await render(<ResponseDetailScreen />);

    expect(screen.getByTestId("response-caption")).toBeTruthy();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });
});
