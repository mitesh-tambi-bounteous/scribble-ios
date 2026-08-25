import { router } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawPad } from "@/components/canvas/DrawPad";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { ENTRY_CANVAS_FRAME_CLASSNAME } from "@/src/lib/canvasFrame";
import { goBack } from "@/src/lib/nav";
import { useCreateChallengeDraftStore } from "@/src/stores/useCreateChallengeDraftStore";

/**
 * Dedicated background-draw screen for challenge creation, pushed from
 * app/create-challenge.tsx. Wraps DrawPad in the SAME
 * "w-full max-w-[760px] self-center flex-1" container used by
 * app/draw.tsx and the entry-draw canvas in app/challenge/[id].tsx, so
 * this canvas's onLayout dp size — and therefore the exported
 * background bitmap — matches the entry canvas exactly. That parity is
 * what stops the background from being stretched/compressed when it's
 * later composited behind the entry canvas.
 */
export default function CreateChallengeBackgroundScreen(): React.JSX.Element {
  const setBackgroundRef = useCreateChallengeDraftStore((state) => state.setBackgroundRef);
  // Background drawing always uses the full brush/color toolset regardless
  // of the challenge's selected toolset. The toolset restriction applies
  // only to participants drawing the actual challenge entry
  // (app/challenge/[id].tsx), not to the creator's background art.

  function handleDone(imageDataUri: string): void {
    setBackgroundRef(imageDataUri);
    router.back();
  }

  return (
    <SafeAreaView testID="create-challenge-background-screen" className="bg-background flex-1">
      <ScribbleBackdrop />
      <ScreenHeader onBack={() => goBack("/create-challenge")} label="DRAW BACKGROUND" />
      <View testID="entry-canvas-frame" className={ENTRY_CANVAS_FRAME_CLASSNAME}>
        <DrawPad onDone={handleDone} doneLabel="Save background" />
      </View>
    </SafeAreaView>
  );
}
