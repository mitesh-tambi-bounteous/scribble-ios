import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { dataClient } from "@/src/data";
import { goBack } from "@/src/lib/nav";
import { useDraftStore } from "@/src/stores/useDraftStore";
import { useStreakStore } from "@/src/stores/useStreakStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/**
 * Choose-channels screen — the final step of the loop, reached from
 * app/write.tsx after captioning. The user picks one or more of THEIR
 * channels (Personal Archive, Family, Friends, Co-Workers, other groups)
 * and submits here. This is where dataClient.submit()
 * actually fires (channelIds fan out server-side, Bug #4), and where the
 * streak advances (S-006). No client-side membership gating — the server
 * enforces AC2/AC4; this screen only calls the API and relays failures.
 */
export default function ChooseChannelsScreen(): React.JSX.Element {
  const router = useRouter();
  const { walls, load } = useWallsStore();
  const draft = useDraftStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // R6 draft guard: submitting requires an active draft. Mount-only, read via
  // getState() so clearing the draft on a successful submit (below) does not
  // re-trigger this and bounce the user off the wall they just unlocked.
  useEffect(() => {
    if (!useDraftStore.getState().imageRef) router.replace("/draw");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(channelId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }

  async function handleSubmit(): Promise<void> {
    if (selected.size === 0 || !draft.promptId) return;
    setSubmitting(true);
    setSubmitError(null);
    const channelIds = Array.from(selected);
    try {
      await dataClient.submit({
        promptId: draft.promptId,
        channelIds,
        imageRef: draft.imageRef ?? undefined,
        text: draft.caption ?? undefined,
      });
      // Submit-to-unlock succeeded: advance the streak (S-006).
      // Fire-and-forget — the streak is a client-side derivation and must
      // never block navigation to the unlocked wall.
      void useStreakStore.getState().recordSubmission();

      const firstChannelId = channelIds[0];
      const firstChannel = walls.find((wall) => wall.id === firstChannelId);
      useDraftStore.getState().clearDraft();

      // R5 post-submit normalization: collapse the create flow so the stack is
      // exactly [home, dest]. Back from the unlocked wall goes home, never back
      // into draw/write/choose-channels.
      const dest = {
        pathname: "/family" as const,
        params: { channelId: firstChannelId, promptId: draft.promptId },
      };
      router.dismissAll();
      router.replace("/home");
      router.push(dest);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not submit your drawing.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-between" testID="choose-channels-screen">
      <View className="w-full max-w-[760px] self-center flex-1">
        <ScreenHeader label="Share to" onBack={() => goBack("/write")} />

        <ScrollView className="mx-[22px] mt-2">
          <ScribbleBackdrop />
          {walls.length === 0 && (
            <Text className="text-muted mt-6 text-center text-sm">Loading your channels...</Text>
          )}
          {walls.map((wall) => {
            const isSelected = selected.has(wall.id);
            return (
              <Pressable
                key={wall.id}
                testID={`channel-option-${wall.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => toggle(wall.id)}
                className={`mb-3 flex-row items-center justify-between rounded-[16px] border p-4 ${
                  isSelected ? "border-accent bg-surface" : "border-line bg-surface"
                }`}
              >
                <View>
                  <Text className="text-foreground text-base font-bold">{wall.name}</Text>
                </View>
                {isSelected && <Icon as={Check} className="text-accent" size={20} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {submitError && (
          <Text className="mx-[22px] mt-2 text-center text-xs text-red-500">{submitError}</Text>
        )}
      </View>

      <View className="w-full max-w-[760px] self-center px-[22px] pb-2">
        <Button
          testID="share-submit-button"
          onPress={() => void handleSubmit()}
          disabled={selected.size === 0 || submitting}
        >
          <Text>{submitting ? "Submitting..." : "Submit & unlock the wall"}</Text>
        </Button>
        <Text className="text-muted mt-3 text-center text-[12.5px]">
          Your drawing is final once it&apos;s out there — captions you can still tweak.
        </Text>
      </View>
    </SafeAreaView>
  );
}
