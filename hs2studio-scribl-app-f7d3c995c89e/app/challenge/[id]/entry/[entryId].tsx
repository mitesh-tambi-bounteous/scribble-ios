import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawingImage } from "@/components/DrawingImage";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getActiveUserId } from "@/src/data/active-user";
import { goBack } from "@/src/lib/nav";
import { useChallengeStore } from "@/src/stores/useChallengeStore";

const STARS: readonly number[] = [1, 2, 3, 4, 5];

interface StarRatingProps {
  entryId: string;
  myStars?: number;
  disabled: boolean;
  onRate: (entryId: string, stars: number) => void;
}

/** A 1..5 star rating control for a single entry; disabled on the caller's own entry. */
function StarRating({ entryId, myStars, disabled, onRate }: StarRatingProps): React.JSX.Element {
  return (
    <View
      testID={`rate-entry-${entryId}`}
      accessibilityState={{ disabled }}
      className="flex-row items-center gap-2"
    >
      {STARS.map((value) => {
        const filled = (myStars ?? 0) >= value;
        return (
          <Pressable
            key={value}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${value} stars`}
            onPress={() => onRate(entryId, value)}
          >
            <Icon
              as={Star}
              size={28}
              className={filled ? undefined : "text-muted"}
              color={filled ? "#FFD84D" : undefined}
              fill={filled ? "#FFD84D" : "none"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Full-screen viewer for a single challenge entry (Bug B). Reached by
 * tapping a tile on the challenge results grid (app/challenge/[id].tsx).
 *
 * Layout is photo-viewer style, not a card: the drawing region is `flex-1`
 * and edge-to-edge (no page padding, no card surface, no aspect-square cap)
 * so it fills all space between the header and a compact bottom bar. The
 * drawing keeps its own aspect ratio via `resizeMode="contain"` inside that
 * flex-1 box (letterboxing on bg-background is expected, not a bug).
 *
 * Rating lives in the bottom bar, not on the grid tile: the viewer can only
 * rate the OTHER participant's entry (never their own — same
 * submit-to-unlock / ownership rule the grid enforced before).
 */
export default function ChallengeEntryScreen(): React.JSX.Element {
  const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const { detail, loading, error, locked, load, rate } = useChallengeStore();

  const reload = useCallback(() => {
    if (id) void load(id);
  }, [id, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(reload);

  const [rating, setRating] = useState(false);

  const entry = useMemo(
    () => detail?.entries.find((candidate) => candidate.id === entryId),
    [detail, entryId],
  );

  const isOwnEntry = !!entry && entry.userId === getActiveUserId();

  async function handleRate(targetEntryId: string, stars: number): Promise<void> {
    if (!id || rating) return;
    setRating(true);
    try {
      await rate(id, targetEntryId, stars);
    } finally {
      setRating(false);
    }
  }

  return (
    <SafeAreaView testID="challenge-entry-screen" className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader
        onBack={() => goBack(id ? { pathname: "/challenge/[id]", params: { id } } : "/home")}
        label="Entry"
      />

      {loading && !detail && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="challenge-entry-loading" />
        </View>
      )}

      {!loading && locked && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">
            You did not enter this challenge, so the reveal is hidden.
          </Text>
        </View>
      )}

      {!loading && !locked && error && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">{error}</Text>
        </View>
      )}

      {!loading && !locked && !error && !entry && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">Entry not found.</Text>
        </View>
      )}

      {!loading && !locked && !error && entry && (
        <View className="flex-1">
          <View className="relative flex-1">
            <DrawingImage
              testID="entry-drawing-image"
              imageRef={entry.imageRef}
              fallback={
                <View className="flex-1 items-center justify-center">
                  <Text className="text-muted font-sans text-xs">No drawing</Text>
                </View>
              }
            />
          </View>

          <View className="gap-2 px-4 pb-2 pt-3">
            <Text className="font-display text-base font-semibold text-foreground">
              {entry.authorName}
            </Text>
            <Text className="text-muted text-xs font-semibold">
              {isOwnEntry ? "Stars received" : "Your rating"}
            </Text>
            <StarRating
              entryId={entry.id}
              myStars={isOwnEntry ? Math.round(entry.averageStars) : entry.myStars}
              disabled={isOwnEntry || rating}
              onRate={(targetEntryId, stars) => void handleRate(targetEntryId, stars)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
