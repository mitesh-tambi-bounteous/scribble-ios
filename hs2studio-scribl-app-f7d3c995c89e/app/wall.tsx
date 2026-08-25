import { router, useLocalSearchParams } from "expo-router";
import { Heart, Pencil } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Doodle } from "@/components/art/Doodle";
import { EnhancedToggleImage } from "@/components/EnhancedToggleImage";
import { PaperSurface } from "@/components/art/PaperSurface";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { goBack } from "@/src/lib/nav";
import { tileColor } from "@/lib/tileColor";
import { useDraftStore } from "@/src/stores/useDraftStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import type { ChannelResponsesResponse } from "@scribl/shared/index";
import { useWallStore } from "@/src/stores/useWallStore";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉"];

type Response = ChannelResponsesResponse["responses"][number];

/** Splits responses into two masonry columns by index parity (no CSS columns in RN). */
function splitColumns(responses: Response[]): [Response[], Response[]] {
  const left: Response[] = [];
  const right: Response[] = [];
  responses.forEach((response, index) => {
    if (index % 2 === 0) left.push(response);
    else right.push(response);
  });
  return [left, right];
}

/**
 * Wall screen — the channel feed of other members' responses for today's
 * prompt. Honors the server's submit-to-unlock (AC2) and channel membership
 * (AC4) invariants via `locked`; never substitutes a client-side gate.
 */
export default function WallScreen(): React.JSX.Element {
  const { channelId, promptId } = useLocalSearchParams<{ channelId: string; promptId: string }>();
  const { data, loading, error, locked, load, react } = useWallStore();
  const { data: promptData } = usePromptStore();

  useEffect(() => {
    if (channelId && promptId) void load(channelId, promptId);
  }, [channelId, promptId, load]);

  const responses = data?.responses ?? [];
  const [leftColumn, rightColumn] = splitColumns(responses);
  const promptText = promptData?.prompt.text ?? "Today's prompt";

  function renderTile(response: Response): React.JSX.Element {
    const [color] = tileColor(response.id);
    return (
      <Pressable
        key={response.id}
        testID="wall-tile"
        className="bg-surface border-line mb-3 overflow-hidden rounded-[18px] border"
        onPress={() =>
          router.push({
            pathname: "/response/[id]",
            params: { id: response.id, channelId, promptId },
          })
        }
      >
        <PaperSurface className="aspect-square items-center justify-center p-6">
          <EnhancedToggleImage
            imageRef={response.imageRef}
            enhancedImageRef={response.enhancedImageRef}
            enhancementStatus={response.enhancementStatus}
            variant="tile"
            testID={`response-image-${response.id}`}
            fallback={
              <View style={{ width: 56, height: 56 }}>
                <Doodle kind="crayon" color={color} />
              </View>
            }
          />
        </PaperSurface>
        <View className="gap-2 p-3">
          {response.text ? (
            <Text className="text-foreground font-sans text-[12.5px]">{response.text}</Text>
          ) : null}
          <View className="flex-row items-center justify-between">
            <Text className="text-muted font-sans text-xs">{response.authorName}</Text>
            <View className="flex-row items-center gap-1">
              <Icon as={Heart} size={14} className="text-muted" />
              <Text className="text-muted font-sans text-xs">{response.reactions.length}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {REACTION_EMOJIS.map((emoji) => {
              const count = response.reactions.filter((r) => r.emoji === emoji).length;
              return (
                <Button
                  key={emoji}
                  variant="outline"
                  size="sm"
                  className="border-line h-7 rounded-full px-2"
                  onPress={() => void react(channelId, promptId, response.id, emoji)}
                >
                  <Text className="text-foreground text-xs">
                    {emoji} {count}
                  </Text>
                </Button>
              );
            })}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScreenHeader onBack={() => goBack("/home")} label="THE WALL" />

      <View className="flex-1 px-4">
        {loading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator testID="wall-loading" />
          </View>
        )}

        {!loading && locked && (
          <View className="flex-1 items-center justify-center gap-5 px-6">
            <ScribbleBackdrop />
            <Text className="text-foreground text-center font-sans text-base">
              Submit today&apos;s drawing to unlock the wall.
            </Text>
            <Pressable
              testID="wall-locked-cta"
              onPress={() => {
                useDraftStore.getState().clearDraft();
                router.push("/draw");
              }}
              className="border-accent w-full max-w-[420px] items-center justify-center gap-2 rounded-[18px] border-2 border-dashed py-8"
            >
              <Icon as={Pencil} size={22} className="text-accent" />
              <Text className="text-foreground font-sans text-sm font-semibold">
                Draw today&apos;s prompt to unlock
              </Text>
            </Pressable>
          </View>
        )}

        {!loading && !locked && error && (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text className="text-foreground text-center">Could not load the wall.</Text>
            <Button onPress={() => channelId && promptId && void load(channelId, promptId)}>
              <Text>Try again</Text>
            </Button>
          </View>
        )}

        {!loading && !locked && !error && data && data.responses.length === 0 && (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-foreground text-center text-lg font-semibold">
              Nothing on the wall yet
            </Text>
            <Text className="text-muted text-center">
              Check back after today&apos;s prompt unlocks to see what the channel drew.
            </Text>
          </View>
        )}

        {!loading && !locked && !error && data && data.responses.length > 0 && (
          <ScrollView contentContainerClassName="gap-3 pb-6" showsVerticalScrollIndicator={false}>
            <ScribbleBackdrop />
            <View className="w-full max-w-[760px] self-center gap-3">
            <View className="bg-surface border-line mb-3 rounded-[16px] border p-4">
              <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
                Today
              </Text>
              <Text className="text-foreground font-sans mt-1 text-base">{promptText}</Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">{leftColumn.map(renderTile)}</View>
              <View className="flex-1">{rightColumn.map(renderTile)}</View>
            </View>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
