import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomNav } from "@/components/nav/BottomNav";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { formatDayCount, formatPromptDateBadge, formatPromptTimeLeft } from "@/src/lib/promptClock";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import { useStreakStore } from "@/src/stores/useStreakStore";

/** Countdown tick interval; bounded, cleaned up on unmount. */
const COUNTDOWN_TICK_MS = 30_000;

/**
 * Today screen — the one live screen in the foundation slice. Reads today's
 * prompt through the Zustand store (never hard-coded), shows defined
 * loading / error / loaded states. Draw/wall/streak screens are out of
 * scope here (S-002+).
 */
export default function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, loading, error, load } = usePromptStore();
  const {
    current: streakCurrent,
    loading: streakLoading,
    error: streakError,
    load: loadStreak,
  } = useStreakStore();
  const hydrated = useAuthStore((state) => state.hydrated);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), COUNTDOWN_TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (hydrated && currentUser === null) {
      router.replace("/sign-up");
    }
  }, [hydrated, currentUser, router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    void load();
  }, [currentUser, load]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    void loadStreak();
  }, [currentUser, loadStreak]);

  if (!hydrated || currentUser === null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="auth-check-loading" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader onBack={() => goBack("/home")} label="PROMPT OF THE DAY" />

      <View className="w-full max-w-[760px] self-center flex-1 justify-between px-6 pb-6">
        <View className="flex-1 items-center justify-center gap-5">
          {loading && <ActivityIndicator testID="prompt-loading" />}

          {!loading && error && (
            <View className="items-center gap-3">
              <Text className="text-foreground text-center">
                Could not load today&apos;s prompt.
              </Text>
              <Button onPress={() => void load()}>
                <Text>Try again</Text>
              </Button>
            </View>
          )}

          {!loading && !error && data && (
            <View className="items-center gap-5">
              <View className="bg-surface border-line rounded-full border px-3 py-1.5">
                <Text
                  testID="today-date"
                  className="text-muted text-xs font-extrabold uppercase tracking-widest"
                >
                  {formatPromptDateBadge(data.prompt.date)}
                </Text>
              </View>
              <Text className="font-display text-foreground text-center text-[42px]">
                {data.prompt.text}
              </Text>
              <Text className="text-muted text-center text-[15px]">
                Stick figures encouraged. The wobblier the better. You&apos;ve got one shot —
                everyone sees the same prompt.
              </Text>
              <View className="flex-row gap-3">
                <View className="bg-surface border-line min-w-[136px] flex-1 rounded-card border p-4">
                  <Text className="text-muted text-xs">Time left</Text>
                  <Text
                    testID="today-countdown"
                    numberOfLines={1}
                    className="font-display text-foreground text-[19px]"
                  >
                    {formatPromptTimeLeft(data.prompt.date, now)}
                  </Text>
                </View>
                <View className="bg-surface border-line min-w-[112px] flex-1 rounded-card border p-4">
                  <Text className="text-muted text-xs">Your streak</Text>
                  <Text numberOfLines={1} className="font-display text-foreground text-[22px]">
                    {formatDayCount(!streakLoading && !streakError ? streakCurrent : 0)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {!loading && !error && !data && (
            <Text className="text-foreground text-center">No prompt available today.</Text>
          )}
        </View>

        <Button
          className="w-full"
          testID="today-open-canvas"
          onPress={() => router.push("/draw")}
        >
          <Text>Open the canvas</Text>
        </Button>
      </View>

      <View className="px-4 pb-4 items-center">
        <View className="w-full max-w-[760px] self-center">
          <BottomNav
            onHome={() => router.push("/home")}
            onDraw={() => router.push("/draw")}
            onYou={() => router.push("/settings")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
