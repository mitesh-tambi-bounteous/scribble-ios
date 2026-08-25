import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, Link2, MessageCircle, MoreHorizontal } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Doodle } from "@/components/art/Doodle";
import { EnhancedToggleImage } from "@/components/EnhancedToggleImage";
import { PaperSurface } from "@/components/art/PaperSurface";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { goBack } from "@/src/lib/nav";
import { formatShareDate } from "@/src/lib/promptClock";
import { usePromptStore } from "@/src/stores/usePromptStore";

/** Documented fallback when there is neither a browser origin (native) nor
 * EXPO_PUBLIC_WEB_BASE_URL configured. Not a real hosted endpoint. */
const FALLBACK_WEB_ORIGIN = "https://scribl.app";

/**
 * Builds the share URL's origin: the running web app's own origin when
 * running on web, else the configured web deployment's base URL, else the
 * documented fallback. Never invents a separate hosted permalink endpoint.
 */
function resolveWebOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_WEB_BASE_URL ?? FALLBACK_WEB_ORIGIN;
}

/**
 * Share screen (S-018). Reachable ONLY from the Response detail screen per
 * the nav-flow spec; do not add other entry points or links here.
 */
export default function ShareScreen(): React.JSX.Element {
  const router = useRouter();
  const { id, authorName, text, imageRef, createdAt, enhancedImageRef: rawEnhancedImageRef, enhancementStatus: rawEnhancementStatus } = useLocalSearchParams<{
    id: string;
    authorName: string;
    text: string;
    imageRef?: string;
    createdAt?: string;
    enhancedImageRef?: string;
    enhancementStatus?: string;
  }>();

  // Normalize empty strings to undefined
  const enhancedImageRef = rawEnhancedImageRef && rawEnhancedImageRef !== "" ? rawEnhancedImageRef : undefined;
  const enhancementStatus = rawEnhancementStatus && rawEnhancementStatus !== "" && (rawEnhancementStatus === "pending" || rawEnhancementStatus === "ready" || rawEnhancementStatus === "failed") ? rawEnhancementStatus as "pending" | "ready" | "failed" : undefined;

  const { data: promptData, load: loadPrompt } = usePromptStore();
  const [copyConfirmation, setCopyConfirmation] = useState(false);

  useEffect(() => {
    if (!promptData) void loadPrompt();
  }, [promptData, loadPrompt]);

  const title = "Scribl response";
  const message = `${authorName}'s response: ${text}`;
  const url = `${resolveWebOrigin()}/response/${id}`;
  const caption = text || "";
  const promptText = promptData?.prompt.text ?? "";
  const dateBadge = createdAt ? formatShareDate(createdAt) : "";

  /**
   * Primary share dispatch. KEEP: native Share.share, web navigator.share,
   * and the web clipboard fallback. Preserved verbatim from the prior
   * implementation — tests/share-screen.test.tsx asserts this exact
   * behavior via the "Share" target tile.
   */
  const handleShare = async (): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: message, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopyConfirmation(true);
      }
      return;
    }

    await Share.share({ message, url });
  };

  /** Copy-link target: reuses the same web clipboard path as the fallback. */
  const handleCopyLink = async (): Promise<void> => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopyConfirmation(true);
      return;
    }
    await handleShare();
  };

  const shareTargets: {
    key: string;
    label: string;
    icon: typeof MessageCircle;
    color: string;
    onPress: () => void;
  }[] = [
    { key: "share", label: "Share", icon: MessageCircle, color: "#2FD3C6", onPress: () => void handleShare() },
    {
      key: "instagram",
      label: "Instagram",
      icon: Camera,
      color: "#FF3D9A",
      onPress: () => {
        /* stub: Instagram share target not wired for POC */
      },
    },
    { key: "copy-link", label: "Copy link", icon: Link2, color: "#6C7BFF", onPress: () => void handleCopyLink() },
    {
      key: "more",
      label: "More",
      icon: MoreHorizontal,
      color: "#9B6CFF",
      onPress: () => {
        /* stub: additional share targets not wired for POC */
      },
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader onBack={() => goBack("/home")} label="SHARE" />

      <View className="w-full max-w-[760px] self-center flex-1 gap-6 px-4 pt-2">
        <View className="rounded-[26px] border border-line bg-surface2 p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-display text-lg font-extrabold text-foreground">scribl</Text>
            <Text className="text-muted text-xs">{dateBadge}</Text>
          </View>

          <PaperSurface className="aspect-square w-full">
            <View className="flex-1 items-center justify-center p-8">
              <EnhancedToggleImage
                imageRef={imageRef}
                enhancedImageRef={enhancedImageRef}
                enhancementStatus={enhancementStatus}
                variant="tile"
                testID="share-image"
                fallback={<Doodle kind="crayon" color="#E4572E" strokeWidth={5} />}
              />
            </View>
          </PaperSurface>

          <Text className="mt-4 text-[17px] text-foreground">{caption}</Text>
          {promptText.length > 0 && (
            <Text className="text-muted mt-1 text-xs">Prompt: {promptText}</Text>
          )}
        </View>

        <View className="flex-row justify-between">
          {shareTargets.map((target) => (
            <Pressable
              key={target.key}
              accessibilityRole="button"
              onPress={target.onPress}
              className="items-center gap-2"
            >
              <View
                className="h-[52px] w-[52px] items-center justify-center rounded-[16px] border border-line bg-surface"
              >
                <Icon as={target.icon} size={22} color={target.color} />
              </View>
              <Text className="text-muted text-[11px]">{target.label}</Text>
            </Pressable>
          ))}
        </View>

        {copyConfirmation && (
          <Text className="text-muted text-center text-sm">Link copied</Text>
        )}

        <Button className="mt-auto mb-4" onPress={() => router.push("/home")}>
          <Text>Done</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
