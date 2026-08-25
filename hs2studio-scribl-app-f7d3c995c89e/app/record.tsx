import { useRouter } from "expo-router";
import { Mic, Play } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { startRecording, stopRecording } from "@/src/services/audioRecorder";

/**
 * Record screen — real audio capture on web (S-013); native capture is
 * deferred to iOS/Android bring-up. The mic button toggles start/stop; on
 * web, a successful stop yields a URI held in local state for playback.
 * Recording/upload integration to an actual submission remains out of scope
 * for this screen (see draw.tsx / write.tsx for the S-002/S-012 submit flow).
 */
export default function RecordScreen(): React.JSX.Element {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  async function handleMicPress(): Promise<void> {
    setRecordError(null);
    try {
      if (!isRecording) {
        await startRecording();
        setIsRecording(true);
        setRecordedUri(null);
      } else {
        const { uri } = await stopRecording();
        setIsRecording(false);
        setRecordedUri(uri);
      }
    } catch (caught) {
      setIsRecording(false);
      setRecordError(caught instanceof Error ? caught.message : "Recording failed.");
    }
  }

  function handlePlayback(): void {
    if (Platform.OS !== "web" || !recordedUri) return;
    new window.Audio(recordedUri).play();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader label="Record" onBack={() => goBack("/home")} />

      <View className="w-full max-w-[760px] self-center flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-foreground text-center text-2xl font-semibold">
          Record your response
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
          onPress={() => void handleMicPress()}
          className={`h-24 w-24 items-center justify-center rounded-full border-4 ${
            isRecording ? "border-red-500 bg-red-100" : "border-line bg-surface"
          }`}
        >
          <Mic color={isRecording ? "#ef4444" : "#1A1A1A"} size={36} />
        </Pressable>

        <Text className="text-muted text-center text-sm">
          {isRecording ? "Recording..." : "Tap to start recording"}
        </Text>

        {recordError && (
          <Text className="text-center text-sm text-red-500">{recordError}</Text>
        )}

        {Platform.OS === "web" && recordedUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play recording"
            onPress={handlePlayback}
            className="flex-row items-center gap-2 rounded-full border-line border bg-surface px-4 py-2"
          >
            <Play color="#1A1A1A" size={18} />
            <Text className="text-foreground text-sm">Play back</Text>
          </Pressable>
        ) : (
          <Text className="text-muted text-center text-xs">
            {Platform.OS === "web"
              ? "Web: browser MediaRecorder API"
              : "Native: expo-audio (deferred to iOS/Android bring-up)"}
          </Text>
        )}

        <View className="w-full gap-3">
          <Button onPress={() => router.push({ pathname: "/home", params: recordedUri ? { audioUri: recordedUri } : undefined })}>
            <Text>Share</Text>
          </Button>
          <Button variant="outline" onPress={() => goBack("/home")}>
            <Text>Back</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
