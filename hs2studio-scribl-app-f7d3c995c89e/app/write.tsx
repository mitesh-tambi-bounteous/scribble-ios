import { useRouter } from "expo-router";
import { Mic, Play, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Doodle } from "@/components/art/Doodle";
import { DrawingImage } from "@/components/DrawingImage";
import { PaperSurface } from "@/components/art/PaperSurface";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { startRecording, stopRecording } from "@/src/services/audioRecorder";
import { transcribe } from "@/src/services/transcriber";
import { useDraftStore } from "@/src/stores/useDraftStore";

const MAX_LENGTH = 80;

/**
 * Write screen — the caption step after the draw canvas. Nothing is
 * submitted here: pressing the primary button stashes the caption into
 * useDraftStore and navigates to app/choose-channels.tsx, where the real
 * submit-to-unlock call happens (AC2) once channel(s) are chosen.
 *
 * Shows the user's REAL drawing (from useDraftStore, stashed by draw.tsx)
 * large at the top so they can caption it while looking at it. Falls back
 * to a placeholder doodle if the draft is unexpectedly absent (e.g.
 * deep-linked directly to this screen).
 *
 * Voice note: captured locally (POC limitation, S-013), then sent to the
 * backend /transcribe endpoint (src/services/transcriber.ts). If the
 * caption is still empty when transcription resolves, the transcript fills
 * it in; a caption the user already typed always wins.
 */
export default function WriteScreen(): React.JSX.Element {
  const router = useRouter();
  const draftImageRef = useDraftStore((state) => state.imageRef);
  const [caption, setCaption] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // R6 draft guard: the caption step requires an active draft. Landing here
  // without one (deep link / web refresh) is structurally invalid, so bounce
  // to the canvas. Mount-only: the draft is never cleared while on this screen.
  useEffect(() => {
    if (!draftImageRef) router.replace("/draw");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMicPress(): Promise<void> {
    setRecordError(null);
    setTranscribeError(null);
    try {
      if (!isRecording) {
        // Re-record: clear the prior take so its transcript doesn't block the
        // next one from filling the (now-empty) caption box.
        if (recordedUri) {
          setCaption("");
          setRecordedUri(null);
        }
        await startRecording();
        setIsRecording(true);
        setRecordedUri(null);
      } else {
        const { uri } = await stopRecording();
        setIsRecording(false);
        setRecordedUri(uri);
        void transcribeRecording(uri);
      }
    } catch (caught) {
      setIsRecording(false);
      setRecordError(caught instanceof Error ? caught.message : "Recording failed.");
    }
  }

  async function transcribeRecording(uri: string): Promise<void> {
    setIsTranscribing(true);
    try {
      const { transcript } = await transcribe(uri);
      // Typed captions always win; voice only fills an EMPTY caption.
      setCaption((current) => (current.trim().length > 0 ? current : transcript));
    } catch (caught) {
      setTranscribeError(
        caught instanceof Error ? caught.message : "Could not transcribe your voice note.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  function handlePlayback(): void {
    if (Platform.OS !== "web" || !recordedUri) return;
    new window.Audio(recordedUri).play();
  }

  function handleSubmit(): void {
    useDraftStore.getState().setCaption(caption);
    router.push("/choose-channels");
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-between">
      <ScribbleBackdrop />
      <View className="flex-1">
        <ScreenHeader label="Add a caption" onBack={() => goBack("/draw")} />

        <PaperSurface className="border-line mx-[22px] mt-1 h-[320px] items-center justify-center border">
          <View className="h-full w-full items-center justify-center p-3">
            <DrawingImage
              imageRef={draftImageRef ?? undefined}
              testID="write-drawing-preview"
              fallback={
                <View style={{ width: 130 }}>
                  <Doodle kind="crayon" color="#FF3D9A" />
                </View>
              }
            />
          </View>
        </PaperSurface>

        <View className="mx-[22px] mt-5 rounded-[16px] bg-surface border-line border p-4">
          <TextInput
            testID="write-caption-input"
            value={caption}
            onChangeText={setCaption}
            maxLength={MAX_LENGTH}
            multiline
            placeholder="Add a caption..."
            className="text-foreground text-base font-semibold"
          />
          <View className="mt-2 flex-row items-center justify-between">
            {caption.length > 0 ? (
              <Pressable
                testID="write-caption-clear"
                onPress={() => setCaption("")}
                accessibilityRole="button"
                accessibilityLabel="Clear caption"
                className="flex-row items-center gap-1"
              >
                <Icon as={X} size={14} className="text-muted" />
                <Text className="text-muted text-xs font-semibold">Clear</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Text className="text-muted text-right text-xs">
              {caption.length} / {MAX_LENGTH}
            </Text>
          </View>
        </View>

        <View className="mx-[22px] mt-4 flex-row items-center gap-3 rounded-[16px] bg-surface border-line border px-[14px] py-3">
          <Pressable
            testID="write-mic-button"
            onPress={() => void handleMicPress()}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? "Stop recording" : "Record a voice note"}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              isRecording ? "bg-red-500" : "bg-[#FF5E5B]"
            }`}
          >
            <Icon as={Mic} color="#fff" size={18} />
          </Pressable>
          <Text className="text-muted flex-1 text-xs font-semibold">
            {isRecording
              ? "Recording..."
              : isTranscribing
                ? "Transcribing..."
                : recordedUri
                  ? "Voice note captured"
                  : "Tap to record"}
          </Text>
          {recordedUri && Platform.OS === "web" && (
            <Pressable
              testID="write-playback-button"
              onPress={handlePlayback}
              accessibilityRole="button"
              accessibilityLabel="Play recording"
              className="h-9 w-9 items-center justify-center rounded-full bg-surface border-line border"
            >
              <Icon as={Play} size={16} className="text-foreground" />
            </Pressable>
          )}
        </View>
        {recordError && (
          <Text className="mx-[22px] mt-2 text-center text-xs text-red-500">{recordError}</Text>
        )}
        {transcribeError && (
          <Text className="mx-[22px] mt-2 text-center text-xs text-red-500">{transcribeError}</Text>
        )}
      </View>

      <View className="px-[22px]">
        <Button testID="write-submit-button" onPress={handleSubmit}>
          <Text>Choose who sees this</Text>
        </Button>
        <Text className="text-muted mt-3 text-center text-[12.5px]">
          Your drawing is final once it&apos;s out there — captions you can still tweak.
        </Text>
      </View>
    </SafeAreaView>
  );
}
