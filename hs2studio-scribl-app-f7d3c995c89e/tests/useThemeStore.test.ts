/**
 * useThemeStore — runtime theme persistence (src/stores/useThemeStore.ts).
 *
 * Confirms: fresh state defaults to "scribble"; load() ignores a value under
 * the legacy "scribl:theme" key; load() honors a value under the current
 * "scribl:theme:v2" key; setTheme() persists under the v2 key.
 */

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useThemeStore } from "@/src/stores/useThemeStore";

describe("useThemeStore", () => {
  beforeEach(async () => {
    useThemeStore.setState({ theme: "scribble" });
    await AsyncStorage.clear();
  });

  it("defaults to 'scribble' before load()", () => {
    expect(useThemeStore.getState().theme).toBe("scribble");
  });

  it("load() ignores a value stored under the legacy 'scribl:theme' key", async () => {
    await AsyncStorage.setItem("scribl:theme", "ink");

    await useThemeStore.getState().load();

    expect(useThemeStore.getState().theme).toBe("scribble");
  });

  it("load() honors a value stored under the current 'scribl:theme:v2' key", async () => {
    await AsyncStorage.setItem("scribl:theme:v2", "studio");

    await useThemeStore.getState().load();

    expect(useThemeStore.getState().theme).toBe("studio");
  });

  it("setTheme() writes the v2 key (and updates in-memory state)", async () => {
    await useThemeStore.getState().setTheme("notepad");

    expect(useThemeStore.getState().theme).toBe("notepad");
    expect(await AsyncStorage.getItem("scribl:theme:v2")).toBe("notepad");
  });
});
