import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawingImage } from "@/components/DrawingImage";
import { DrawPad } from "@/components/canvas/DrawPad";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getActiveUserId } from "@/src/data/active-user";
import { ENTRY_CANVAS_FRAME_CLASSNAME } from "@/src/lib/canvasFrame";
import { goBack } from "@/src/lib/nav";
import { useChallengeStore } from "@/src/stores/useChallengeStore";

/** Bounded poll interval while a challenge is still open (AC-parity with the wall's no-push reveal). */
const OPEN_POLL_MS = 15_000;
const STARS: readonly number[] = [1, 2, 3, 4, 5];

interface StarsReadoutProps {
  entryId: string;
  stars: number;
}

/**
 * Read-only star display for the results grid tile (no rating here anymore —
 * rating happens on the full-screen entry viewer, see app/challenge/[id]/entry/[entryId].tsx).
 * `stars` is rounded to the nearest whole star for the filled count.
 */
function StarsReadout({ entryId, stars }: StarsReadoutProps): React.JSX.Element {
  const rounded = Math.round(stars);
  return (
    <View testID={`stars-entry-${entryId}`} className="flex-row items-center gap-1">
      {STARS.map((value) => {
        const filled = rounded >= value;
        return (
          <Icon
            key={value}
            as={Star}
            size={18}
            className={filled ? undefined : "text-muted"}
            color={filled ? "#FFD84D" : undefined}
            fill={filled ? "#FFD84D" : "none"}
          />
        );
      })}
    </View>
  );
}

/**
 * Challenge detail screen (Task 10): the three-state machine for a blind
 * draw-off challenge. Server-enforced invariants (submit-to-unlock, reveal
 * timing) are only ever relayed via `useChallengeStore`, never gated
 * locally.
 */
export default function ChallengeScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loading, error, locked, load, submitEntry } = useChallengeStore();
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    if (id) void load(id);
  }, [id, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(reload);

  // Bounded polling to surface the reveal without a push notification. Only
  // while the caller is WAITING (submitted, watching for others) — never while
  // they are still drawing: reveal can't happen before they submit, and a
  // (silent) refresh mid-draw would churn the canvas. Uses a background load
  // so `loading` never flips (which would unmount the canvas). Cleared on
  // unmount or once the caller navigates away. Per-viewer reveal means
  // "revealed" IS the waiting-for-others state (they submitted, watching for
  // entries to stream in) — there is no separate open+submitted state anymore.
  const revealed = detail?.state === "revealed";
  useEffect(() => {
    if (!revealed || !id) return;
    const intervalId = setInterval(() => void load(id, { background: true }), OPEN_POLL_MS);
    return () => clearInterval(intervalId);
  }, [revealed, id, load]);

  async function handleDone(imageDataUri: string): Promise<void> {
    if (!id) return;
    setSubmitting(true);
    try {
      await submitEntry(id, imageDataUri);
    } finally {
      setSubmitting(false);
    }
  }

  // While the caller is drawing, the word IS the prompt — show it in the
  // fixed-height ScreenHeader (exactly as create-challenge-background.tsx
  // shows "DRAW BACKGROUND") rather than as a Text above the canvas. A word
  // row above the canvas would steal vertical space the background-draw
  // screen doesn't, shrinking this canvas and stretching the backdrop.
  const drawingOpen = !!detail && detail.state === "open" && !detail.iSubmitted;
  const headerLabel = drawingOpen && detail ? detail.challenge.word : "Challenge";

  return (
    <SafeAreaView testID="challenge-screen" className="flex-1 bg-background">
      <ScreenHeader onBack={() => goBack("/home")} label={headerLabel} />

      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="challenge-loading" />
        </View>
      )}

      {!loading && locked && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text testID="challenge-locked" className="text-center text-foreground">
            You did not enter this challenge, so the reveal is hidden.
          </Text>
        </View>
      )}

      {!loading && !locked && error && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">{error}</Text>
          <Button onPress={reload}>
            <Text>Try again</Text>
          </Button>
        </View>
      )}

      {drawingOpen && detail && (
        // Direct child of SafeAreaView — the SAME nesting as
        // app/create-challenge-background.tsx and app/draw.tsx — so this
        // canvas's onLayout dp size matches the surface the background was
        // drawn on. The backdrop then renders 1:1 with zero stretch.
        <View testID="entry-canvas-frame" className={ENTRY_CANVAS_FRAME_CLASSNAME}>
          <DrawPad
            onDone={(imageDataUri) => void handleDone(imageDataUri)}
            busy={submitting}
            doneTestID="challenge-done"
            allowedBrushStyles={detail.challenge.toolset?.brushes}
            allowedColors={detail.challenge.toolset?.colors}
            backgroundImage={detail.challenge.backgroundRef}
            timerSeconds={detail.challenge.drawSeconds}
          />
        </View>
      )}

      {!loading && !locked && !error && detail && detail.state === "revealed" && (
        <ScrollView className="flex-1 px-4 pt-2">
          <ScribbleBackdrop />
          <View className="w-full max-w-[760px] self-center">
          <Text className="font-display mb-3 text-lg font-bold text-foreground">
            {detail.challenge.word}
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {detail.entries.map((entry) => {
              const isOwnEntry = entry.userId === getActiveUserId();
              // Own entry: show stars RECEIVED (averageStars aggregates every
              // other participant's rating of this entry — the caller never
              // rates themselves, so `myStars` is always undefined here).
              // Other entries: show the stars the caller GAVE (myStars).
              const displayStars = isOwnEntry ? entry.averageStars : (entry.myStars ?? 0);
              return (
                <Pressable
                  key={entry.id}
                  testID={`challenge-entry-tile-${entry.id}`}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/challenge/[id]/entry/[entryId]",
                      params: { id: detail.challenge.id, entryId: entry.id },
                    })
                  }
                  className="w-[47%] gap-2 rounded-2xl border border-line bg-surface p-2"
                >
                  <View className="aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-background">
                    <DrawingImage
                      imageRef={entry.imageRef}
                      fallback={<Text className="text-muted font-sans text-xs">No drawing</Text>}
                    />
                  </View>
                  <Text className="text-xs font-semibold text-foreground">{entry.authorName}</Text>
                  <StarsReadout entryId={entry.id} stars={displayStars} />
                </Pressable>
              );
            })}
          </View>

          <Text className="font-display mb-2 mt-5 text-sm font-bold text-foreground">
            Leaderboard
          </Text>
          <View className="gap-2 pb-6">
            {detail.leaderboard.map((row) => (
              <View
                key={row.entryId}
                testID={row.rank === 1 ? "challenge-winner" : undefined}
                className={`flex-row items-center justify-between rounded-xl border border-line px-3 py-2 ${
                  row.rank === 1 ? "bg-accent/15" : "bg-surface"
                }`}
              >
                <Text className="text-xs font-bold text-foreground">
                  #{row.rank} {row.authorName}
                </Text>
                <Text className="text-muted text-xs font-extrabold">
                  {row.averageStars.toFixed(1)} stars ({row.ratingCount})
                </Text>
              </View>
            ))}
          </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
