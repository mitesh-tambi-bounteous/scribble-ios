import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawingImage } from "@/components/DrawingImage";
import { StyleGlyph } from "@/components/canvas/StyleGlyph";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { useChallengesStore } from "@/src/stores/useChallengesStore";
import { useCreateChallengeDraftStore } from "@/src/stores/useCreateChallengeDraftStore";
import { BRUSH_STYLE_IDS, PALETTE, type BrushStyle } from "@scribl/shared/tools";

/** Per-drawing timer presets, in seconds: 1 / 2 / 5 minutes. Default 2 min. */
const DRAW_SECONDS_PRESETS = [60, 120, 300] as const;

/**
 * Create-challenge screen. Wired to useChallengesStore.create (real
 * dataClient call). On success routes to the new challenge's detail
 * screen; on failure shows an inline error and stays put.
 *
 * Form fields live in useCreateChallengeDraftStore rather than local
 * state, so they survive the push to app/create-challenge-background.tsx
 * and back.
 */
export default function CreateChallengeScreen(): React.JSX.Element {
  const create = useChallengesStore((state) => state.create);
  const params = useLocalSearchParams<{ channelId?: string }>();
  const channelId = params.channelId ?? "";
  const word = useCreateChallengeDraftStore((state) => state.word);
  const setWord = useCreateChallengeDraftStore((state) => state.setWord);
  const drawSeconds = useCreateChallengeDraftStore((state) => state.drawSeconds);
  const setDrawSeconds = useCreateChallengeDraftStore((state) => state.setDrawSeconds);
  const selectedBrushes = useCreateChallengeDraftStore((state) => state.selectedBrushes);
  const setSelectedBrushes = useCreateChallengeDraftStore((state) => state.setSelectedBrushes);
  const selectedColors = useCreateChallengeDraftStore((state) => state.selectedColors);
  const setSelectedColors = useCreateChallengeDraftStore((state) => state.setSelectedColors);
  const backgroundRef = useCreateChallengeDraftStore((state) => state.backgroundRef);
  const setBackgroundRef = useCreateChallengeDraftStore((state) => state.setBackgroundRef);
  const resetDraft = useCreateChallengeDraftStore((state) => state.reset);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  function toggleBrush(style: BrushStyle): void {
    setSelectedBrushes(
      selectedBrushes.includes(style)
        ? selectedBrushes.filter((entry) => entry !== style)
        : [...selectedBrushes, style],
    );
  }

  function toggleColor(color: string): void {
    setSelectedColors(
      selectedColors.includes(color)
        ? selectedColors.filter((entry) => entry !== color)
        : [...selectedColors, color],
    );
  }

  async function handleCreate(): Promise<void> {
    const trimmedWord = word.trim();
    if (!trimmedWord || !channelId || selectedBrushes.length === 0 || selectedColors.length === 0) return;
    setSubmitting(true);
    setInlineError(null);
    try {
      const challenge = await create(channelId, {
        word: trimmedWord,
        drawSeconds,
        toolset: { brushes: selectedBrushes, colors: selectedColors },
        backgroundRef,
      });
      resetDraft();
      router.push(`/challenge/${challenge.id}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to create challenge.";
      setInlineError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    !word.trim() || submitting || selectedBrushes.length === 0 || selectedColors.length === 0;

  return (
    <SafeAreaView testID="create-challenge-screen" className="bg-background flex-1">
      <ScribbleBackdrop />
      <ScreenHeader onBack={() => goBack("/home")} label="NEW CHALLENGE" />

      <ScrollView contentContainerClassName="px-5 pt-2 pb-6" showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[760px] self-center gap-6">
        <View className="gap-1">
          <Text className="font-display text-foreground text-2xl">Start a challenge</Text>
          <Text className="text-muted font-sans text-sm">
            Pick a word. Everyone draws it blind, then reveals together.
          </Text>
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Word
          </Text>
          <TextInput
            testID="challenge-word-input"
            value={word}
            onChangeText={setWord}
            placeholder="Word (e.g. Dragon)"
            placeholderTextColor="#9CA3AF"
            className="text-foreground font-sans text-base"
          />
        </View>

        <View className="gap-2">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Draw time
          </Text>
          <View className="flex-row gap-2">
            {DRAW_SECONDS_PRESETS.map((seconds) => (
              <Pressable
                key={seconds}
                testID={`challenge-duration-${seconds}`}
                onPress={() => setDrawSeconds(seconds)}
                className={
                  drawSeconds === seconds
                    ? "bg-accent/15 border-accent flex-1 items-center rounded-[14px] border-2 p-3"
                    : "bg-surface border-line flex-1 items-center rounded-[14px] border p-3"
                }
              >
                <Text className="text-foreground font-sans text-sm font-semibold">
                  {seconds / 60} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
              Tools
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                testID="tools-select-all"
                onPress={() => {
                  setSelectedBrushes([...BRUSH_STYLE_IDS]);
                  setSelectedColors([...PALETTE]);
                }}
              >
                <Text className="text-accent font-sans text-xs font-bold">Select all</Text>
              </Pressable>
              <Pressable
                testID="tools-select-none"
                onPress={() => {
                  setSelectedBrushes([]);
                  setSelectedColors([]);
                }}
              >
                <Text className="text-accent font-sans text-xs font-bold">Select none</Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {BRUSH_STYLE_IDS.map((style) => {
              const selected = selectedBrushes.includes(style);
              return (
                <Pressable
                  key={style}
                  testID={`tool-brush-${style}`}
                  onPress={() => toggleBrush(style)}
                  accessibilityRole="button"
                  accessibilityLabel={`${style} brush`}
                  accessibilityState={{ selected }}
                  className={
                    selected
                      ? "bg-accent/15 border-accent h-10 w-10 items-center justify-center rounded-full border-2"
                      : "bg-surface border-line h-10 w-10 items-center justify-center rounded-full border"
                  }
                >
                  {/* Both pill backgrounds here are light tints (bg-surface / bg-accent/15),
                      unlike DrawPad's solid-dark selected circle, so always use the
                      dark-icon (inactive) glyph variant for contrast. */}
                  <StyleGlyph style={style} active={false} />
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {PALETTE.map((swatch, index) => {
              const selected = selectedColors.includes(swatch);
              return (
                <Pressable
                  key={swatch}
                  testID={`tool-color-${index}`}
                  onPress={() => toggleColor(swatch)}
                  accessibilityState={{ selected }}
                  style={{ backgroundColor: swatch }}
                  className={`h-[30px] w-[30px] rounded-full ${
                    selected ? "border-[3px] border-foreground scale-110" : "opacity-30"
                  }`}
                />
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Background
          </Text>

          {!backgroundRef && (
            <Pressable
              testID="create-background-button"
              onPress={() => router.push("/create-challenge-background")}
              className="bg-surface border-line items-center rounded-[14px] border p-3"
            >
              <Text className="text-foreground font-sans text-sm font-semibold">Draw a background</Text>
            </Pressable>
          )}

          {backgroundRef && (
            <View className="flex-row items-center gap-3">
              <View style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden" }}>
                <DrawingImage
                  testID="background-preview"
                  imageRef={backgroundRef}
                  fallback={<Text className="text-muted font-sans text-xs">No background</Text>}
                />
              </View>
              <Pressable testID="background-remove" onPress={() => setBackgroundRef(undefined)}>
                <Text className="text-accent font-sans text-xs font-bold">Remove</Text>
              </Pressable>
            </View>
          )}
        </View>
        </View>
      </ScrollView>

      <View className="w-full max-w-[760px] self-center px-5 pb-6 gap-2">
        {inlineError && (
          <Text testID="create-challenge-error" className="text-sm text-red-500">
            {inlineError}
          </Text>
        )}
        <Button
          testID="create-challenge-submit"
          disabled={submitDisabled}
          onPress={() => void handleCreate()}
        >
          <Text>Create challenge</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
