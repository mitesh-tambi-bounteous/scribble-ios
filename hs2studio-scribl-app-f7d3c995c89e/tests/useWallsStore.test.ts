/**
 * useWallsStore — real walls list via dataClient.listWalls/createWall
 * (src/stores/useWallsStore.ts). No client-side membership gating; AC4 stays
 * server-side. Confirms load()/createWall() relay the data-client seam, and
 * that no SEED_WALLS fixture remains in the module.
 */

jest.mock("@/src/data", () => ({
  dataClient: { listWalls: jest.fn(), createWall: jest.fn() },
}));

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import type { Channel } from "@scribl/shared/index";

import { dataClient } from "@/src/data";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

const mockListWalls = dataClient.listWalls as jest.Mock;
const mockCreateWall = dataClient.createWall as jest.Mock;

const CHANNEL_1: Channel = { id: "channel-1", name: "Family", kind: "group", isPublic: false };
const CHANNEL_2: Channel = { id: "channel-2", name: "Friends", kind: "group", isPublic: false };

describe("useWallsStore", () => {
  beforeEach(() => {
    useWallsStore.setState({ walls: [], loading: false, error: null });
    useAuthStore.setState({ currentUser: null, loading: false, error: null });
    mockListWalls.mockReset();
    mockCreateWall.mockReset();
  });

  it("load() with no current user clears walls and never calls dataClient.listWalls", async () => {
    await useWallsStore.getState().load();

    expect(mockListWalls).not.toHaveBeenCalled();
    expect(useWallsStore.getState().walls).toEqual([]);
  });

  it("load() calls dataClient.listWalls(userId) and populates walls from the result", async () => {
    useAuthStore.setState({
      currentUser: { id: "user-demo", email: "demo@scribl.test", displayName: "Demo", createdAt: "2026-07-01T00:00:00.000Z" },
      loading: false,
      error: null,
    });
    mockListWalls.mockResolvedValueOnce([CHANNEL_1, CHANNEL_2]);

    await useWallsStore.getState().load();

    expect(mockListWalls).toHaveBeenCalledWith("user-demo");
    expect(useWallsStore.getState().walls).toEqual([CHANNEL_1, CHANNEL_2]);
    expect(useWallsStore.getState().loading).toBe(false);
    expect(useWallsStore.getState().error).toBeNull();
  });

  it("load() failure sets error, leaves walls untouched, clears loading", async () => {
    useAuthStore.setState({
      currentUser: { id: "user-demo", email: "demo@scribl.test", displayName: "Demo", createdAt: "2026-07-01T00:00:00.000Z" },
      loading: false,
      error: null,
    });
    useWallsStore.setState({ walls: [CHANNEL_1], loading: false, error: null });
    mockListWalls.mockRejectedValueOnce(new Error("network down"));

    await useWallsStore.getState().load();

    expect(useWallsStore.getState().error).toBe("network down");
    expect(useWallsStore.getState().walls).toEqual([CHANNEL_1]);
    expect(useWallsStore.getState().loading).toBe(false);
  });

  it("createWall() calls dataClient.createWall(input) then reloads via listWalls", async () => {
    useAuthStore.setState({
      currentUser: { id: "user-demo", email: "demo@scribl.test", displayName: "Demo", createdAt: "2026-07-01T00:00:00.000Z" },
      loading: false,
      error: null,
    });
    mockCreateWall.mockResolvedValueOnce(CHANNEL_1);
    mockListWalls.mockResolvedValueOnce([CHANNEL_1]);

    const input = { name: "Family", kind: "group" as const, isPublic: false };
    await useWallsStore.getState().createWall(input);

    expect(mockCreateWall).toHaveBeenCalledWith(input);
    expect(mockListWalls).toHaveBeenCalledWith("user-demo");
    expect(useWallsStore.getState().walls).toEqual([CHANNEL_1]);
  });

  it("createWall() failure sets error, resolves false, and does not throw", async () => {
    mockCreateWall.mockRejectedValueOnce(new Error("boom"));

    const ok = await useWallsStore.getState().createWall({ name: "Family", kind: "group", isPublic: false });

    expect(ok).toBe(false);
    expect(useWallsStore.getState().error).toBe("boom");
    expect(useWallsStore.getState().loading).toBe(false);
  });

  it("createWall() success resolves true", async () => {
    useAuthStore.setState({
      currentUser: { id: "user-demo", email: "demo@scribl.test", displayName: "Demo", createdAt: "2026-07-01T00:00:00.000Z" },
      loading: false,
      error: null,
    });
    mockCreateWall.mockResolvedValueOnce(CHANNEL_1);
    mockListWalls.mockResolvedValueOnce([CHANNEL_1]);

    const ok = await useWallsStore.getState().createWall({ name: "Family", kind: "group", isPublic: false });

    expect(ok).toBe(true);
    expect(useWallsStore.getState().error).toBeNull();
  });

  it("does not export a SEED_WALLS fixture (real data client only, no hardcoded seed)", () => {
    const mod = require("@/src/stores/useWallsStore");
    expect(mod.SEED_WALLS).toBeUndefined();
  });
});
