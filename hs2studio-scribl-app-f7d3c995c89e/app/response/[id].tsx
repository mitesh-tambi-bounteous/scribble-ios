import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart, Smile, Sparkles, Star, Upload } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Doodle } from "@/components/art/Doodle";
import { PaperSurface } from "@/components/art/PaperSurface";
import { EnhancedToggleImage } from "@/components/EnhancedToggleImage";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AI_ENABLED } from "@/src/config/features";
import { goBack } from "@/src/lib/nav";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useResponseDetailStore } from "@/src/stores/useResponseDetailStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/** Formats an ISO timestamp as a short local time, e.g. "8:12 AM". */
function formatTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const CAPTION_MAX_LENGTH = 80;
const BACKGROUND_PROMPT_MAX_LENGTH = 200;

interface ReactionChip {
  key: string;
  icon: typeof Heart;
  count: number;
  active?: boolean;
}

/**
 * Response detail screen (S-017). Fetches the real response detail via the
 * data client seam (getResponse, which reuses the AC2/AC4-gated channel-wall
 * read) and honors the server's submit-to-unlock / channel-membership
 * invariants by rendering the `locked` state — never gating locally.
 */
export default function ResponseDetailScreen(): React.JSX.Element {
  const router = useRouter();
  const { id, channelId, promptId } = useLocalSearchParams<{
    id: string;
    channelId: string;
    promptId: string;
  }>();
  const {
    data,
    loading,
    error,
    locked,
    load,
    addReaction,
    startEnhancementPolling,
    updateResponse,
    regenerate,
  } = useResponseDetailStore();
  const { walls, load: loadWalls } = useWallsStore();
  const currentUserId = useAuthStore((state) => state.currentUser?.id);
  // Original/enhanced toggle is lifted here so the pill can sit above the image
  // frame (top-right) rather than overlaying the art.
  const [showOriginal, setShowOriginal] = useState(false);
  // Global AI kill-switch: gate the lifted toggle pill, background-prompt
  // field, and regenerate button when AI is disabled.
  const canToggle = AI_ENABLED && data?.enhancementStatus === "ready" && !!data?.enhancedImageRef;

  const isOwner = !!currentUserId && !!data?.authorId && currentUserId === data.authorId;
  const [editCaption, setEditCaption] = useState<string>("");
  const [editBackgroundPrompt, setEditBackgroundPrompt] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Tracks which response id the edit fields were last seeded from, so
  // in-flight edits aren't clobbered by the background enhancement poll's
  // silent reloads (only re-seed when navigating to a different response).
  const [seededResponseId, setSeededResponseId] = useState<string | undefined>(undefined);

  // Seeds the edit fields from the loaded response - adjusts state during
  // render (React's recommended pattern) rather than in an effect, since it
  // only needs to run when `data.id` changes, not on every render.
  if (data && data.id !== seededResponseId) {
    setSeededResponseId(data.id);
    setEditCaption(data.text ?? "");
    setEditBackgroundPrompt(data.backgroundPrompt ?? "");
  }

  const REACTION_EMOJI: Record<string, string> = { heart: "❤️", smile: "😂", star: "🎉" };
  const REACTION_SETS: Record<string, readonly string[]> = {
    heart: ["❤️", "👍"],
    smile: ["😂", "😊"],
    star: ["🎉", "⭐"],
  };

  useEffect(() => {
    if (channelId && promptId && id) void load(channelId, promptId, id);
  }, [channelId, promptId, id, load]);

  useEffect(() => {
    void loadWalls();
  }, [loadWalls]);

  // Bounded polling while the enhancement is still pending; cleared on
  // unmount, terminal state, or param change (mirrors challenge/[id].tsx).
  // Skipped entirely when AI is off so stale "pending" data (persisted before
  // the flag was flipped) can't trigger indefinite background polls.
  useEffect(() => {
    if (!AI_ENABLED) return;
    if (!channelId || !promptId || !id) return;
    if (data?.enhancementStatus !== "pending") return;
    return startEnhancementPolling(channelId, promptId, id);
  }, [channelId, promptId, id, data?.enhancementStatus, startEnhancementPolling]);

  const channelName = walls.find((wall) => wall.id === channelId)?.name;
  const channelLabel = data
    ? `${channelName ?? "Channel"} · ${formatTime(data.createdAt)}`.trim()
    : "";

  const reactions = useMemo<ReactionChip[]>(() => {
    const allReactions = data?.reactions ?? [];
    const countFor = (set: readonly string[]): number =>
      allReactions.filter((r) => set.includes(r.emoji)).length;
    const activeFor = (set: readonly string[]): boolean =>
      allReactions.some((r) => r.userId === currentUserId && set.includes(r.emoji));
    return [
      { key: "heart", icon: Heart, set: REACTION_SETS.heart ?? [] },
      { key: "smile", icon: Smile, set: REACTION_SETS.smile ?? [] },
      { key: "star", icon: Star, set: REACTION_SETS.star ?? [] },
    ].map(({ key, icon, set }) => ({
      key,
      icon,
      count: countFor(set),
      active: activeFor(set),
    }));
  }, [data, currentUserId]);

  const authorName = data?.authorName ?? "";
  const caption = data?.text ?? "";

  async function handleSave(): Promise<void> {
    if (!channelId || !promptId || !id || saving) return;
    setSaving(true);
    setSaved(false);
    setEditError(null);
    try {
      await updateResponse(channelId, promptId, id, {
        text: editCaption,
        backgroundPrompt: editBackgroundPrompt,
      });
      setSaved(true);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate(): Promise<void> {
    if (!channelId || !promptId || !id || regenerating) return;
    setRegenerating(true);
    setEditError(null);
    try {
      await regenerate(channelId, promptId, id, {
        text: editCaption,
        backgroundPrompt: editBackgroundPrompt,
      });
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Failed to regenerate.");
    } finally {
      setRegenerating(false);
    }
  }

  const toggleReaction = (key: string): void => {
    if (!channelId || !promptId || !id) return;
    const emoji = REACTION_EMOJI[key];
    if (!emoji) return;
    // addReaction writes the server-echoed response straight into `data`
    // (useWallStore.react's in-place pattern); a follow-up non-silent load()
    // would flip loading:true and flash the full-screen spinner.
    void addReaction(channelId, promptId, id, emoji);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader
        onBack={() => goBack("/home")}
        label="RESPONSE"
        right={
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/share",
                params: {
                  id,
                  authorName: data?.authorName ?? "",
                  text: data?.text ?? "",
                  imageRef: data?.imageRef ?? "",
                  createdAt: data?.createdAt ?? "",
                  enhancedImageRef: data?.enhancedImageRef ?? "",
                  enhancementStatus: data?.enhancementStatus ?? "",
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Share"
            className="h-[38px] w-[38px] items-center justify-center rounded-full bg-surface border-line border"
          >
            <Icon as={Upload} className="text-foreground" size={18} />
          </Pressable>
        }
      />

      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="response-loading" />
        </View>
      )}

      {!loading && locked && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">
            Submit today&apos;s drawing to unlock the wall.
          </Text>
        </View>
      )}

      {!loading && !locked && error && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-foreground">Could not load this response.</Text>
          <Button
            onPress={() => channelId && promptId && id && void load(channelId, promptId, id)}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      )}

      {!loading && !locked && !error && (
        <View className="flex-1 gap-4 px-4 pt-2">
          <View className="flex-row items-center gap-3">
            <Avatar
              name={authorName || "?"}
              color={data?.authorAvatarColor}
              imageUri={data?.authorAvatarImage}
              size={40}
            />
            <View>
              <Text testID="response-author" className="font-display text-base font-semibold text-foreground">
                {authorName}
              </Text>
              <Text className="text-muted text-xs">{channelLabel}</Text>
            </View>
          </View>

          {canToggle && (
            <View className="flex-row justify-end">
              <Pressable
                testID="enhance-toggle"
                accessibilityLabel={showOriginal ? "Show enhanced" : "Show original"}
                onPress={() => setShowOriginal((prev) => !prev)}
                className="h-8 flex-row items-center gap-1 rounded-full bg-black/60 px-3"
              >
                <Icon as={Sparkles} className="text-white" size={16} />
                <Text className="text-xs font-semibold text-white">
                  {showOriginal ? "AI" : "Original"}
                </Text>
              </Pressable>
            </View>
          )}

          <PaperSurface className="aspect-square w-full">
            <View className="flex-1 items-center justify-center p-6">
              <EnhancedToggleImage
                imageRef={data?.imageRef}
                enhancedImageRef={data?.enhancedImageRef}
                enhancementStatus={data?.enhancementStatus}
                testID="response-image"
                variant="detail"
                showOriginal={showOriginal}
                onToggleOriginal={() => setShowOriginal((prev) => !prev)}
                fallback={<Doodle kind="crayon" color="#E4572E" strokeWidth={5} />}
              />
            </View>
          </PaperSurface>

          {!isOwner && (
            <Text testID="response-caption" className="text-[17px] text-foreground">
              {caption}
            </Text>
          )}

          {isOwner && (
            <View testID="response-owner-edit" className="gap-3 rounded-[16px] bg-surface border-line border p-4">
              <View className="gap-1">
                <Text className="text-muted text-xs font-semibold">Caption</Text>
                <TextInput
                  testID="response-caption-input"
                  value={editCaption}
                  onChangeText={(value) => {
                    setEditCaption(value);
                    // New edits invalidate the "Saved" state of the button.
                    setSaved(false);
                  }}
                  maxLength={CAPTION_MAX_LENGTH}
                  multiline
                  placeholder="Add a caption..."
                  className="text-foreground text-base font-semibold"
                />
                <Text className="text-muted text-right text-xs">
                  {editCaption.length} / {CAPTION_MAX_LENGTH}
                </Text>
              </View>

              {AI_ENABLED && (
                <View className="gap-1">
                  <Text className="text-muted text-xs font-semibold">Background prompt</Text>
                  <Text className="text-muted text-xs">
                    Only you can see this — it guides the AI background.
                  </Text>
                  <TextInput
                    testID="response-background-prompt-input"
                    value={editBackgroundPrompt}
                    onChangeText={setEditBackgroundPrompt}
                    maxLength={BACKGROUND_PROMPT_MAX_LENGTH}
                    multiline
                    placeholder="Describe the background you want..."
                    className="text-foreground text-sm"
                  />
                </View>
              )}

              {editError && (
                <Text className="text-xs font-semibold text-red-500">{editError}</Text>
              )}

              <View className="flex-row items-center gap-2">
                <Button
                  testID="response-save-button"
                  onPress={() => void handleSave()}
                  disabled={saving}
                  className="flex-1"
                >
                  <Text>{saving ? "Saving..." : saved ? "Saved" : "Save"}</Text>
                </Button>
                {AI_ENABLED && (
                  <Button
                    testID="response-regenerate-button"
                    variant="secondary"
                    onPress={() => void handleRegenerate()}
                    disabled={regenerating || data?.enhancementStatus === "pending"}
                    className="flex-1 flex-row items-center justify-center gap-2"
                  >
                    <Text>Regenerate background</Text>
                  </Button>
                )}
              </View>
            </View>
          )}

          <View className="flex-row items-center gap-2">
            {reactions.map((reaction) => (
              <Pressable
                key={reaction.key}
                testID={`reaction-${reaction.key}`}
                onPress={() => toggleReaction(reaction.key)}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5"
                style={
                  reaction.active
                    ? { backgroundColor: "rgba(255,61,154,0.14)", borderColor: "#FF3D9A" }
                    : undefined
                }
              >
                <Icon
                  as={reaction.icon}
                  size={16}
                  className={reaction.active ? undefined : "text-foreground"}
                  color={reaction.active ? "#FF3D9A" : undefined}
                  fill={reaction.active && reaction.icon === Heart ? "#FF3D9A" : "none"}
                />
                {reaction.count > 0 && (
                  <Text
                    className="text-xs font-semibold"
                    style={reaction.active ? { color: "#FF3D9A" } : undefined}
                  >
                    {reaction.count}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
