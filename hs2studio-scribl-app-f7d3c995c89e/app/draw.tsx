import { useRouter } from "expo-router";
import { ChevronLeft, Clock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawPad } from "@/components/canvas/DrawPad";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ENTRY_CANVAS_FRAME_CLASSNAME } from "@/src/lib/canvasFrame";
import { goBack } from "@/src/lib/nav";
import { useDraftStore } from "@/src/stores/useDraftStore";
import { usePromptStore } from "@/src/stores/usePromptStore";

/**
 * Draw screen — the shared DrawPad canvas for today's prompt. This screen only
 * exports the drawing and stashes it as a draft; it does NOT submit.
 * Submission (with caption + voice transcript + chosen channels) happens
 * later, in app/choose-channels.tsx, after the user writes their caption
 * on app/write.tsx. Submit-to-unlock (AC2) is enforced server-side at that
 * final submit call.
 */
export default function DrawScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, load } = usePromptStore();
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!data) void load();
  }, [data, load]);

  useEffect(() => {
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function handleDone(imageDataUri: string): void {
    if (!data) return;

    // Stash the real drawing so the caption screen (app/write.tsx) can show
    // it instead of a static placeholder, and so the eventual submit call
    // (app/choose-channels.tsx) has the image ref. A data URI is too
    // large/unreliable to pass through router params. No channel is chosen
    // yet and nothing is submitted here — that happens after caption entry.
    useDraftStore.getState().setDraft({
      imageRef: imageDataUri,
      promptId: data.prompt.id,
    });
    router.push("/write");
  }

  const promptText = data?.prompt.text ?? "Loading today's prompt...";

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <View className="flex-row items-center justify-between gap-2 px-[18px] pb-3">
        <Pressable
          onPress={() => goBack("/")}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-[38px] w-[38px] items-center justify-center rounded-full bg-surface border-line border"
        >
          <Icon as={ChevronLeft} className="text-foreground" size={19} />
        </Pressable>

        <View className="flex-1 items-center overflow-hidden">
          <Text className="text-muted text-[11px] font-extrabold uppercase tracking-widest">
            Prompt
          </Text>
          <Text
            numberOfLines={1}
            className="text-foreground text-[13.5px] font-bold"
          >
            {promptText}
          </Text>
        </View>

        <View className="flex-row items-center gap-[5px] rounded-full bg-surface border-line border px-[11px] py-[7px]">
          <Icon as={Clock} className="text-accent" size={13} />
          <Text className="text-muted text-xs font-extrabold">{formatElapsed(elapsedSec)}</Text>
        </View>
      </View>

      <View testID="entry-canvas-frame" className={ENTRY_CANVAS_FRAME_CLASSNAME}>
        <DrawPad onDone={handleDone} showPreview />
      </View>
    </SafeAreaView>
  );
}
