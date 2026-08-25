/**
 * Screen test for the Family screen (app/family.tsx).
 *
 * Tile matrix (ux-flow-spec section 6) driven ONLY by `member.response`:
 *  - response present (own OR other) -> drawing tile, tap views /response/[id]
 *  - response absent + NOT you       -> "hasn't drawn yet" placeholder, tap no-op
 *  - response absent + IS you        -> "Draw for this wall" CTA, tap clears
 *                                       draft then pushes /draw (never /write)
 *
 * The feed (Batch 2 redesign) is a FlatList (testID "family-day-feed") of day
 * sections driven by useFamilyStore's daysByChannel/loadChannelDays, not the
 * old day-strip. The grid no longer reads useWallStore; there is no
 * client-side authorId join. Header back uses goBack("/home"), never
 * router.push.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";

jest.mock("@/src/config/features", () => ({ AI_ENABLED: true }));

const mockRouterPush = jest.fn();
const mockGoBack = jest.fn();
const mockClearDraft = jest.fn();
let mockChannelId = "channel-1";

jest.mock("expo-router", () => {
  const actualReact = jest.requireActual("react");
  return {
    useRouter: () => ({ push: jest.fn() }),
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
    useLocalSearchParams: () => ({ channelId: mockChannelId }),
    // Screen tests don't simulate navigation focus/blur; running the
    // callback as a normal effect on mount/dep-change is enough to exercise
    // it without needing a real navigation focus event.
    useFocusEffect: (callback: () => void) => actualReact.useEffect(callback, [callback]),
  };
});

jest.mock("@/src/lib/nav", () => ({
  goBack: (...args: unknown[]) => mockGoBack(...args),
}));

const mockLoadPromptByDate = jest.fn();

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({
    data: { prompt: { id: "prompt-x", text: "Draw a sleepy cat", date: "2026-07-01", createdAt: "" } },
    load: jest.fn(),
    promptsByDate: { "2026-06-30": { text: "Draw your favorite meal" } },
    loadPromptByDate: mockLoadPromptByDate,
  }),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string } }) => unknown) =>
    selector({ currentUser: { id: "user-me" } }),
}));

jest.mock("@/src/stores/useFamilyStore", () => ({
  useFamilyStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

jest.mock("@/src/stores/useWallStore", () => ({
  useWallStore: jest.fn(),
}));

jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: jest.fn(),
}));

jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: { getState: () => ({ clearDraft: mockClearDraft }) },
}));

import { useFamilyStore } from "@/src/stores/useFamilyStore";
import { useWallStore } from "@/src/stores/useWallStore";
import { useWallsStore } from "@/src/stores/useWallsStore";
import type { ChannelMember, ChannelResponse } from "@scribl/shared/domain";
import FamilyScreen from "../app/family";

const mockUseFamilyStore = useFamilyStore as unknown as jest.Mock & { getState: jest.Mock };
const mockUseWallStore = useWallStore as unknown as jest.Mock;
const mockUseWallsStore = useWallsStore as unknown as jest.Mock;

function makeResponse(over: Partial<ChannelResponse>): ChannelResponse {
  return {
    id: "response-x",
    promptId: "prompt-x",
    channelId: "channel-1",
    authorId: "user-x",
    authorName: "X",
    createdAt: "2026-07-01T09:00:00.000Z",
    reactions: [],
    ...over,
  };
}

const bobResponse = makeResponse({
  id: "response-bob-1",
  authorId: "user-bob",
  authorName: "Bob",
  imageRef: "data:image/png;base64,BOB",
  enhancedImageRef: "data:image/png;base64,BOBENH",
  enhancementStatus: "ready",
  text: "A very sleepy cat.",
  reactions: [{ emoji: "❤️", userId: "user-me" }],
});

const meResponse = makeResponse({
  id: "response-me-1",
  authorId: "user-me",
  authorName: "You",
  imageRef: "data:image/png;base64,ME",
});

/**
 * Wires useFamilyStore for a single-day feed: today's day is the only entry
 * in daysByChannel/byDay, with the given members/lock state.
 */
function setFamilyStore(opts: {
  members: ChannelMember[];
  locked?: boolean;
  loading?: boolean;
  error?: string | null;
  daysByChannel?: Record<string, { promptId: string; isoDate: string; responseCount: number }[]>;
  byDay?: Record<
    string,
    { members: ChannelMember[]; loading: boolean; error: string | null; locked: boolean }
  >;
  daysLoading?: boolean;
  daysError?: string | null;
}): void {
  const days = opts.daysByChannel ?? {
    "channel-1": [{ promptId: "prompt-x", isoDate: "2026-07-01", responseCount: opts.members.length }],
  };
  const perPromptByDay =
    opts.byDay ??
    {
      "prompt-x": {
        members: opts.members,
        loading: opts.loading ?? false,
        error: opts.error ?? null,
        locked: opts.locked ?? false,
      },
    };
  // Store shape is byDay[channelId][promptId] (scoped per channel); tests
  // pass the per-prompt map for the channel under test (mockChannelId).
  const byDay = { [mockChannelId]: perPromptByDay };
  const state = {
    members: opts.members,
    loading: opts.loading ?? false,
    error: opts.error ?? null,
    locked: opts.locked ?? false,
    load: jest.fn(),
    byDay,
    loadDays: jest.fn(),
    daysByChannel: days,
    daysLoading: opts.daysLoading ?? false,
    daysError: opts.daysError ?? null,
    loadChannelDays: jest.fn(),
  };
  mockUseFamilyStore.mockReturnValue(state);
  mockUseFamilyStore.getState.mockReturnValue(state);
}

describe("FamilyScreen — tile matrix (ux-flow-spec section 6)", () => {
  beforeEach(() => {
    mockChannelId = "channel-1";
    mockRouterPush.mockClear();
    mockGoBack.mockClear();
    mockClearDraft.mockClear();
    mockLoadPromptByDate.mockClear();
    mockUseWallStore.mockReturnValue({
      archiveResponses: [],
      archiveLoading: false,
      loadArchive: jest.fn(),
      data: null,
      loading: false,
      error: null,
      locked: false,
      load: jest.fn(),
      react: jest.fn(),
    });
    setFamilyStore({
      members: [
        { userId: "user-me", displayName: "You", email: "me@x.com", hasDrawnToday: true, avatarColor: "#FF0000", response: meResponse },
        { userId: "user-bob", displayName: "Bob", email: "bob@x.com", hasDrawnToday: true, avatarColor: "#00FF00", response: bobResponse },
      ],
    });
    mockUseWallsStore.mockReturnValue({
      walls: [{ id: "channel-1", name: "The Smiths" }],
      load: jest.fn(),
    });
  });

  // Pressing NativeWind-styled Pressables schedules a deferred press-state
  // update; drain it (inside act, while still mounted) so it can't leak into
  // the next test's render as an "overlapping act()".
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("renders the real channel name, and no prompt subtitle in the header", async () => {
    await render(<FamilyScreen />);
    expect(screen.getByText("The Smiths")).toBeTruthy();
    expect(screen.queryByText("The Family, today")).toBeNull();
    expect(screen.queryByText("Draw a sleepy cat")).toBeTruthy(); // rendered as the day-section subheading, not the header
  });

  it("renders the day feed with a section per active day, testID family-day-feed", async () => {
    await render(<FamilyScreen />);
    expect(screen.getByTestId("family-day-feed")).toBeTruthy();
    expect(screen.getByTestId("family-day-section-prompt-x")).toBeTruthy();
    expect(screen.queryByTestId("family-day-strip")).toBeNull();
  });

  it("shows the day's prompt in gray, WITHOUT a 'Jul 1 ·' date prefix", async () => {
    await render(<FamilyScreen />);
    // The heading ("Today") and the prompt text are separate nodes; no
    // combined "Today · Draw a sleepy cat" (old day-strip format) string.
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Draw a sleepy cat")).toBeTruthy();
    expect(screen.queryByText("Today · Draw a sleepy cat")).toBeNull();
    expect(screen.queryByText(/Jul 1 ·/)).toBeNull();
  });

  it("renders a member's drawing via EnhancedToggleImage using that response's refs", async () => {
    await render(<FamilyScreen />);
    // enhancementStatus "ready" + enhancedImageRef => enhanced shown by default
    // (spec 7); the rendered <Image> uri proves both refs + status were wired.
    const bobImage = screen.getByTestId("response-image-response-bob-1");
    expect(bobImage.props.source.uri).toBe("data:image/png;base64,BOBENH");
    expect(screen.getAllByTestId("enhance-toggle").length).toBeGreaterThan(0);
  });

  it("renders a member's caption text and real reaction count from member.response", async () => {
    await render(<FamilyScreen />);
    expect(screen.getByTestId("family-member-caption-user-bob")).toHaveTextContent(
      "A very sleepy cat.",
    );
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders a member response with an empty caption without crashing (no text node under <View>)", async () => {
    // Regression: `{response.text && <Text/>}` rendered the empty string "" as a
    // bare text-node child of a <View>, which RN rejects ("Unexpected text node").
    setFamilyStore({
      members: [
        {
          userId: "user-bob",
          displayName: "Bob",
          email: "bob@x.com",
          hasDrawnToday: true,
          avatarColor: "#00FF00",
          response: makeResponse({ id: "response-bob-empty", authorId: "user-bob", authorName: "Bob", imageRef: "data:image/png;base64,BOB", text: "" }),
        },
      ],
    });
    await render(<FamilyScreen />);
    // Tile renders; no caption Text node is emitted for the empty string.
    expect(screen.getByTestId("response-image-response-bob-empty")).toBeTruthy();
    expect(screen.queryByTestId("family-member-caption-user-bob")).toBeNull();
  });

  it("tapping your OWN tile and ANOTHER member's tile both push /response/[id]; /write is never pushed", async () => {
    await render(<FamilyScreen />);
    const tiles = screen.getAllByTestId("family-member-tile");
    // Members render in order: [me, bob]. Serialize the two presses so the
    // first's deferred press-state update settles before the second's act.
    await act(async () => {
      fireEvent.press(tiles[0]);
    });
    await act(async () => {
      fireEvent.press(tiles[1]);
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: "/response/[id]",
        params: { id: "response-me-1", channelId: "channel-1", promptId: "prompt-x" },
      });
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: "/response/[id]",
        params: { id: "response-bob-1", channelId: "channel-1", promptId: "prompt-x" },
      });
    });
    // Never route to the create-flow caption screen from a view tap.
    const pushedToWrite = mockRouterPush.mock.calls.some(
      (call) => call[0] === "/write" || (typeof call[0] === "object" && call[0]?.pathname === "/write"),
    );
    expect(pushedToWrite).toBe(false);
  });

  it("family-edit-tile renders only on the current user's own response tile, not on other members'", async () => {
    await render(<FamilyScreen />);
    const editTiles = screen.getAllByTestId("family-edit-tile");
    expect(editTiles).toHaveLength(1);

    const tiles = screen.getAllByTestId("family-member-tile");
    const [meTile, bobTile] = tiles;
    expect(meTile).toBeTruthy();
    expect(bobTile).toBeTruthy();

    // The single edit tile is a descendant of the "me" tile, not Bob's.
    expect(within(meTile).getByTestId("family-edit-tile")).toBeTruthy();
    expect(within(bobTile).queryByTestId("family-edit-tile")).toBeNull();
  });

  it("member with hasDrawnToday=true but no response renders a placeholder tile whose tap is a no-op (old join-miss crash path)", async () => {
    setFamilyStore({
      members: [
        { userId: "user-carol", displayName: "Carol", email: "carol@x.com", hasDrawnToday: true, avatarColor: "#0000FF", response: undefined },
      ],
    });
    await render(<FamilyScreen />);

    expect(screen.queryByTestId("family-member-tile")).toBeNull();
    const placeholder = screen.getByTestId("family-placeholder-tile");
    fireEvent.press(placeholder);
    await waitFor(() => expect(mockRouterPush).not.toHaveBeenCalled());
  });

  it("your OWN tile without a response renders a Draw-for-this-wall CTA that clears the draft then pushes /draw (never /write)", async () => {
    setFamilyStore({
      members: [
        { userId: "user-me", displayName: "You", email: "me@x.com", hasDrawnToday: false, avatarColor: "#FF0000", response: undefined },
      ],
    });
    await render(<FamilyScreen />);

    const cta = screen.getByTestId("family-cta-tile");
    fireEvent.press(cta);

    await waitFor(() => {
      expect(mockClearDraft).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/draw");
    });
    const pushedToWrite = mockRouterPush.mock.calls.some((call) => call[0] === "/write");
    expect(pushedToWrite).toBe(false);
  });

  it("header back uses goBack('/home'), never router.push", async () => {
    await render(<FamilyScreen />);
    fireEvent.press(screen.getByLabelText("Go back"));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledWith("/home"));
    const pushedHome = mockRouterPush.mock.calls.some((call) => call[0] === "/home");
    expect(pushedHome).toBe(false);
  });

  it("shows a Try again button on daysError that re-triggers loadChannelDays", async () => {
    const mockLoadChannelDays = jest.fn();
    setFamilyStore({
      members: [],
      daysByChannel: { "channel-1": [] },
      byDay: {},
      daysError: "boom",
    });
    mockUseFamilyStore.mockReturnValue({
      ...mockUseFamilyStore(),
      loadChannelDays: mockLoadChannelDays,
    });

    await render(<FamilyScreen />);

    expect(screen.getByText("Could not load the family wall.")).toBeTruthy();
    fireEvent.press(screen.getByText("Try again"));
    await waitFor(() => expect(mockLoadChannelDays).toHaveBeenCalledWith("channel-1"));
  });

  it("a fresh wall (no responses yet, listChannelDays returns nothing) still renders today's CTA", async () => {
    setFamilyStore({
      members: [],
      daysByChannel: { "channel-1": [] }, // server reports no days - fresh wall
      byDay: {},
    });

    await render(<FamilyScreen />);

    expect(screen.getByTestId("family-day-feed")).toBeTruthy();
    expect(screen.getByTestId("family-day-section-prompt-x")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("selecting a different day's section shows that day's prompt/members (day list has two days)", async () => {
    setFamilyStore({
      members: [
        { userId: "user-me", displayName: "You", email: "me@x.com", hasDrawnToday: true, avatarColor: "#FF0000", response: meResponse },
        { userId: "user-bob", displayName: "Bob", email: "bob@x.com", hasDrawnToday: true, avatarColor: "#00FF00", response: bobResponse },
      ],
      daysByChannel: {
        "channel-1": [
          { promptId: "prompt-x", isoDate: "2026-07-01", responseCount: 2 },
          { promptId: "prompt-2026-06-30", isoDate: "2026-06-30", responseCount: 1 },
        ],
      },
      byDay: {
        "prompt-x": {
          members: [
            { userId: "user-me", displayName: "You", email: "me@x.com", hasDrawnToday: true, avatarColor: "#FF0000", response: meResponse },
            { userId: "user-bob", displayName: "Bob", email: "bob@x.com", hasDrawnToday: true, avatarColor: "#00FF00", response: bobResponse },
          ],
          loading: false,
          error: null,
          locked: false,
        },
        "prompt-2026-06-30": {
          members: [
            { userId: "user-carol", displayName: "Carol", email: "carol@x.com", hasDrawnToday: true, avatarColor: "#0000FF", response: undefined },
          ],
          loading: false,
          error: null,
          locked: false,
        },
      },
    });

    await render(<FamilyScreen />);
    expect(screen.getByTestId("family-day-section-prompt-x")).toBeTruthy();
    // Both sections render in the FlatList (it's a feed, not a single
    // selected day); the yesterday section carries its own prompt text.
    expect(screen.getByTestId("family-day-section-prompt-2026-06-30")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    expect(screen.getByText("Draw your favorite meal")).toBeTruthy();
  });

  describe("Personal Archive channel", () => {
    beforeEach(() => {
      mockChannelId = "user-1-archive";
      mockUseWallStore.mockReturnValue({
        archiveResponses: [
          makeResponse({
            id: "response-archive-1",
            authorId: "user-me",
            authorName: "You",
            promptId: "prompt-2026-06-20",
            imageRef: "data:image/png;base64,OLD",
            text: "An old doodle",
          }),
          makeResponse({
            id: "response-archive-2",
            authorId: "user-me",
            authorName: "You",
            promptId: "prompt-2026-07-01",
            imageRef: "data:image/png;base64,NEW",
            text: "A new doodle",
          }),
        ],
        archiveLoading: false,
        loadArchive: jest.fn(),
        data: null,
        loading: false,
        error: null,
        locked: false,
        load: jest.fn(),
        react: jest.fn(),
      });
    });

    it("renders a flat gallery with no day sections and an always-present Draw CTA", async () => {
      await render(<FamilyScreen />);

      expect(screen.queryByTestId("family-day-section-prompt-x")).toBeNull();
      expect(screen.queryByText("Today")).toBeNull();
      expect(screen.queryByText("Yesterday")).toBeNull();

      const tiles = screen.getAllByTestId("family-archive-tile");
      expect(tiles).toHaveLength(2);

      const cta = screen.getByTestId("family-cta-tile");
      fireEvent.press(cta);
      await waitFor(() => {
        expect(mockClearDraft).toHaveBeenCalledTimes(1);
        expect(mockRouterPush).toHaveBeenCalledWith("/draw");
      });
    });

    it("tapping an archive tile pushes /response/[id]", async () => {
      await render(<FamilyScreen />);
      const tiles = screen.getAllByTestId("family-archive-tile");
      fireEvent.press(tiles[0]);
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith({
          pathname: "/response/[id]",
          params: { id: "response-archive-1", channelId: "user-1-archive", promptId: "prompt-2026-06-20" },
        });
      });
    });

    it("renders a caption footer on each archive tile with the response's text", async () => {
      await render(<FamilyScreen />);

      expect(screen.getByTestId("family-archive-caption-response-archive-1")).toHaveTextContent(
        "An old doodle",
      );
      expect(screen.getByTestId("family-archive-caption-response-archive-2")).toHaveTextContent(
        "A new doodle",
      );
    });

    it("calls loadChannelDays for the archive channel and loadArchive with promptIds derived from ALL known days (not just today/yesterday)", async () => {
      const mockLoadChannelDays = jest.fn();
      const mockLoadArchive = jest.fn();
      setFamilyStore({
        members: [],
        daysByChannel: {
          "user-1-archive": [
            { promptId: "prompt-x", isoDate: "2026-07-01", responseCount: 1 },
            { promptId: "prompt-2026-06-20", isoDate: "2026-06-20", responseCount: 1 },
            { promptId: "prompt-2026-05-01", isoDate: "2026-05-01", responseCount: 1 },
          ],
        },
        byDay: {},
      });
      mockUseFamilyStore.mockReturnValue({
        ...mockUseFamilyStore(),
        loadChannelDays: mockLoadChannelDays,
      });
      mockUseWallStore.mockReturnValue({
        archiveResponses: [],
        archiveLoading: false,
        loadArchive: mockLoadArchive,
        data: null,
        loading: false,
        error: null,
        locked: false,
        load: jest.fn(),
        react: jest.fn(),
      });

      await render(<FamilyScreen />);

      expect(mockLoadChannelDays).toHaveBeenCalledWith("user-1-archive");
      await waitFor(() => {
        const call = mockLoadArchive.mock.calls[mockLoadArchive.mock.calls.length - 1];
        expect(call[0]).toBe("user-1-archive");
        expect(call[1]).toEqual(
          expect.arrayContaining(["prompt-x", "prompt-2026-06-20", "prompt-2026-05-01"]),
        );
        expect(call[1]).toHaveLength(3);
      });
    });

    it("an empty archive (no responses at all) still renders only the Draw CTA, no tiles", async () => {
      mockUseWallStore.mockReturnValue({
        archiveResponses: [],
        archiveLoading: false,
        loadArchive: jest.fn(),
        data: null,
        loading: false,
        error: null,
        locked: false,
        load: jest.fn(),
        react: jest.fn(),
      });

      await render(<FamilyScreen />);

      expect(screen.getByTestId("family-cta-tile")).toBeTruthy();
      expect(screen.queryByTestId("family-archive-tile")).toBeNull();
    });
  });
});
