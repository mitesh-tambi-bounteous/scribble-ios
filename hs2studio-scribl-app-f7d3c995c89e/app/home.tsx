import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Award,
  Check,
  ChevronRight,
  Flame,
  LogOut,
  NotebookPen,
  Plus,
  Swords,
  Users,
} from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { BottomNav } from "@/components/nav/BottomNav";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { isArchiveChannel } from "@/src/lib/channels";
import { formatDayCount } from "@/src/lib/promptClock";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import { useStatsStore } from "@/src/stores/useStatsStore";
import { useStreakStore } from "@/src/stores/useStreakStore";
import { useWallsStore, type Wall } from "@/src/stores/useWallsStore";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
/** Bounded: weeklyCompletion is always exactly 7 entries (see useStatsStore). */
const MAX_WEEK_ENTRIES = 7;

/** Derives a single-letter day label from an ISO "YYYY-MM-DD" date string. */
function weekdayLetter(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "?";
  }
  return WEEKDAY_LETTERS[parsed.getDay()] ?? "?";
}

/** No membership/participation endpoint yet; keep the wall list honest. */
function wallSubtitle(wall: Wall): string {
  if (wall.kind === "challenge") return "Challenge wall";
  if (isArchiveChannel(wall.id)) return "Just you — unlimited draws";
  return "Private wall";
}

/**
 * Home screen (S-009/S-015 restyle). Reads streak + walls only from their
 * stores; the "Your walls" list and week strip are read-only presentation of
 * store/static data — no client-side unlock logic lives here.
 */
export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  // Streak is best-effort (mirrors app/index.tsx): its loading/error state
  // never blocks the screen, it just falls back to a 0-day badge.
  const { current: streakCurrent, error: streakError, load: loadStreak } = useStreakStore();
  const { walls, loading: wallsLoading, error: wallsError, load: loadWalls } = useWallsStore();
  const { data: promptData, loading: promptLoading, error: promptError, load: loadPrompt } =
    usePromptStore();
  const {
    drawingsCount,
    weeklyCompletion,
    bestStreak,
    badges,
    loading: statsLoading,
    error: statsError,
    load: loadStats,
  } = useStatsStore();
  // Surface the first error among the screen's blocking stores rather than
  // silently rendering zeros/empty on failure.
  const loading = wallsLoading || promptLoading || statsLoading;
  const error = wallsError ?? promptError ?? statsError;
  const displayedStreak = streakError ? 0 : streakCurrent;

  function retryAll(): void {
    void loadStreak();
    loadWalls();
    void loadPrompt();
    void loadStats();
  }
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const displayName = currentUser?.displayName ?? "there";

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace("/sign-up");
  }

  useEffect(() => {
    void loadStreak();
  }, [loadStreak]);

  useEffect(() => {
    loadWalls();
  }, [loadWalls]);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const promptId = promptData?.prompt.id;
  const weekEntries = weeklyCompletion.slice(0, MAX_WEEK_ENTRIES);
  const doneThisWeek = weekEntries.filter((entry) => entry.done).length;
  const todayIndex = weekEntries.length - 1;

  function handleWallPress(wall: Wall): void {
    if (wall.kind === "challenge") {
      router.push({ pathname: "/challenge-wall", params: { channelId: wall.id } });
      return;
    }
    router.push({ pathname: "/family", params: { channelId: wall.id, promptId } });
  }

  if (loading) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="home-loading" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-foreground text-center">Could not load your home screen.</Text>
          <Button testID="home-retry" onPress={retryAll}>
            <Text>Try again</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView
        contentContainerStyle={{ paddingTop: 46, paddingHorizontal: 22, paddingBottom: 90 }}
      >
        <ScribbleBackdrop />
        <View className="w-full max-w-[760px] self-center gap-5">
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-muted font-sans text-[13px]">Home</Text>
            <Text className="font-display text-foreground text-[26px]">Nice work, {displayName}.</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Avatar
              name={displayName}
              color={currentUser?.avatarColor}
              imageUri={currentUser?.avatarImage}
              size={44}
              testID="home-avatar"
            />
            <Pressable
              testID="logout-button"
              onPress={() => void handleLogout()}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              className="bg-surface border-line h-11 w-11 items-center justify-center rounded-full border"
            >
              <Icon as={LogOut} size={18} className="text-muted" />
            </Pressable>
          </View>
        </View>

        <View className="border-line rounded-card overflow-hidden border">
          <LinearGradient
            colors={["rgba(255,159,69,0.14)", "rgba(255,61,154,0.14)"]}
            className="gap-3 p-5"
          >
            <View className="flex-row items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-white/40">
                <Icon as={Flame} size={28} color="#FF9F45" />
              </View>
              <View>
                <Text className="font-display text-foreground text-[30px]">
                  {formatDayCount(displayedStreak)}
                </Text>
                <Text className="text-muted font-sans text-sm">
                  Current streak · best is <Text testID="home-best-streak">{bestStreak}</Text>
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="flex-row gap-3">
          <View className="bg-surface border-line rounded-card flex-1 gap-1 border p-4">
            <Text testID="home-drawings-count" className="font-display text-foreground text-[26px]">
              {drawingsCount}
            </Text>
            <Text className="text-muted font-sans text-xs">drawings made</Text>
          </View>
          <View className="bg-surface border-line rounded-card flex-1 gap-1 border p-4">
            <Text className="font-display text-foreground text-[26px]">{doneThisWeek}/7</Text>
            <Text className="text-muted font-sans text-xs">drawn this week</Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-foreground text-lg">This week</Text>
            <Text testID="home-week-strip" className="text-muted font-sans text-xs">
              {doneThisWeek} of {weekEntries.length} drawn
            </Text>
          </View>
          <View className="flex-row justify-between">
            {weekEntries.map((entry, index) => {
              const isDone = entry.done;
              const isToday = index === todayIndex;
              const label = weekdayLetter(entry.date);
              return (
                <View key={entry.date} className="items-center gap-1">
                  <View
                    className={
                      isDone
                        ? "bg-accent/15 h-[30px] w-[30px] items-center justify-center rounded-full"
                        : isToday
                          ? "border-accent h-[30px] w-[30px] items-center justify-center rounded-full border-2"
                          : "bg-surface border-line h-[30px] w-[30px] items-center justify-center rounded-full border"
                    }
                  >
                    {isDone && <Icon as={Check} size={14} className="text-accent" />}
                  </View>
                  <Text className="text-muted font-sans text-[11px]">{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {(badges ?? []).length > 0 && (
          <View className="gap-3">
            <Text className="font-display text-foreground text-lg">Milestones</Text>
            <View className="flex-row gap-3">
              {badges.map((badge) => (
                <View
                  key={badge.day}
                  testID={`milestone-badge-${badge.day}`}
                  accessibilityLabel={`${badge.day}-day badge ${badge.earned ? "earned" : "locked"}`}
                  className={
                    badge.earned
                      ? "bg-surface border-accent rounded-card flex-1 items-center gap-1 border p-3"
                      : "bg-surface border-line rounded-card flex-1 items-center gap-1 border p-3 opacity-40"
                  }
                >
                  <Icon
                    as={Award}
                    size={22}
                    color={badge.earned ? "#FF9F45" : undefined}
                    className={badge.earned ? undefined : "text-muted"}
                  />
                  <Text className="text-foreground font-sans text-xs font-semibold">
                    {badge.day}-day
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="gap-3">
          <Text className="font-display text-foreground text-lg">Your walls</Text>

          {walls.map((wall) => {
            const isChallenge = wall.kind === "challenge";
            const isArchive = isArchiveChannel(wall.id);
            const wallIcon = isChallenge ? Swords : isArchive ? NotebookPen : Users;
            const wallIconColor = isChallenge ? "#FF9F45" : isArchive ? "#2FD3C6" : "#6C7BFF";
            return (
              <Pressable
                key={wall.id}
                testID={`wall-card-${wall.id}`}
                onPress={() => handleWallPress(wall)}
                className="bg-surface border-line rounded-card flex-row items-center gap-3 border p-4"
              >
                <View
                  className={
                    isChallenge
                      ? "h-12 w-12 items-center justify-center rounded-[14px] bg-[#FF9F45]/15"
                      : isArchive
                        ? "h-12 w-12 items-center justify-center rounded-[14px] bg-[#2FD3C6]/15"
                        : "h-12 w-12 items-center justify-center rounded-[14px] bg-[#6C7BFF]/15"
                  }
                >
                  <Icon as={wallIcon} size={22} color={wallIconColor} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-foreground font-sans text-base font-semibold">
                    {wall.name}
                  </Text>
                  <Text className="text-muted font-sans text-xs">{wallSubtitle(wall)}</Text>
                </View>
                <Icon as={ChevronRight} size={18} className="text-muted" />
              </Pressable>
            );
          })}

          <Pressable
            testID="wall-card-create-new"
            onPress={() => router.push("/create-wall")}
            className="border-line rounded-card flex-row items-center gap-3 border border-dashed p-4"
          >
            <View className="bg-surface h-12 w-12 items-center justify-center rounded-[14px]">
              <Icon as={Plus} size={22} className="text-muted" />
            </View>
            <Text className="text-muted font-sans text-base font-semibold">Create new</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>

      <View className="absolute inset-x-4 bottom-4 items-center">
        <View className="w-full max-w-[760px] self-center">
          <BottomNav
            active="home"
            onHome={() => {}}
            onDraw={() => router.push("/")}
            onYou={() => router.push("/settings")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
