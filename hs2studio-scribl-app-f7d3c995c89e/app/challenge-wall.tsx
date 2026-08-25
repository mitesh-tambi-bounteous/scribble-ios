import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { useChallengesStore } from "@/src/stores/useChallengesStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/** Formats a per-drawing timer as "<n> min draw" (whole minutes) or "<n>s draw". */
function formatDrawTime(drawSeconds: number): string {
  if (drawSeconds % 60 === 0) {
    const minutes = drawSeconds / 60;
    return `${minutes} min draw`;
  }
  return `${drawSeconds}s draw`;
}

/**
 * Challenge wall screen: lists a challenge-kind channel's challenges. Mirrors
 * the challenges block previously on app/family.tsx, now first-class here so
 * group walls no longer carry challenge UI.
 */
export default function ChallengeWallScreen(): React.JSX.Element {
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const { walls, load: loadWalls } = useWallsStore();
  const { challenges, loading, error, load: loadChallenges } = useChallengesStore();

  useEffect(() => {
    void loadWalls();
  }, [loadWalls]);

  useEffect(() => {
    if (channelId) {
      void loadChallenges(channelId);
    }
  }, [channelId, loadChallenges]);

  const wallName = walls.find((wall) => wall.id === channelId)?.name;

  return (
    <SafeAreaView testID="challenge-wall-screen" className="bg-background flex-1">
      <ScreenHeader onBack={() => goBack("/home")} label={wallName ?? "CHALLENGE WALL"} />

      {!channelId && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-foreground text-center">Pick a challenge wall from Home.</Text>
        </View>
      )}

      {channelId && (
        <ScrollView contentContainerClassName="px-4 pb-10" showsVerticalScrollIndicator={false}>
          <ScribbleBackdrop />
          <View className="w-full max-w-[760px] self-center gap-5">

          <View className="items-center gap-1">
            <Text className="font-display text-foreground text-[22px]">
              {wallName ?? "Challenge wall"}
            </Text>
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-foreground text-lg">Challenges</Text>
              <Pressable
                testID="new-challenge-button"
                onPress={() =>
                  router.push({ pathname: "/create-challenge", params: { channelId } })
                }
                className="bg-btn rounded-btn px-3 py-2"
              >
                <Text className="font-sans text-xs font-extrabold">New challenge</Text>
              </Pressable>
            </View>

            {loading && <ActivityIndicator testID="challenges-loading" />}

            {!loading && error && (
              <Pressable
                testID="challenges-retry"
                onPress={() => channelId && void loadChallenges(channelId)}
              >
                <Text className="text-muted font-sans text-sm">
                  Could not load challenges. Tap to retry.
                </Text>
              </Pressable>
            )}

            {!loading && !error && challenges.length === 0 && (
              <Text className="text-muted font-sans text-sm">No challenges yet.</Text>
            )}

            {!loading && !error && challenges.length > 0 && (
              <View className="gap-3">
                {challenges.map((summary) => (
                  <Pressable
                    key={summary.challenge.id}
                    testID="challenge-row"
                    onPress={() =>
                      router.push({
                        pathname: "/challenge/[id]",
                        params: { id: summary.challenge.id },
                      })
                    }
                    className="bg-surface border-line flex-row items-center justify-between rounded-[14px] border px-4 py-3"
                  >
                    <View className="gap-1">
                      <Text className="text-foreground font-sans text-sm font-semibold">
                        {summary.challenge.word}
                      </Text>
                      <Text className="text-muted font-sans text-xs">
                        {formatDrawTime(summary.challenge.drawSeconds)}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-muted font-sans text-xs uppercase">{summary.state}</Text>
                      <Text className="text-muted font-sans text-xs">
                        {summary.submittedCount}/{summary.participantCount}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
