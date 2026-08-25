import type { ChannelMember } from "@scribl/shared/index";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Check, Heart, Lock, Pencil } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Doodle } from "@/components/art/Doodle";
import { EnhancedToggleImage } from "@/components/EnhancedToggleImage";
import { PaperSurface } from "@/components/art/PaperSurface";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { tileColor } from "@/lib/tileColor";
import { isArchiveChannel } from "@/src/lib/channels";
import { goBack } from "@/src/lib/nav";
import { dataClient } from "@/src/data";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import { useDraftStore } from "@/src/stores/useDraftStore";
import { useFamilyStore, type ChannelDayMeta } from "@/src/stores/useFamilyStore";
import { useWallStore } from "@/src/stores/useWallStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/** Stable FlatList viewability config (module-scoped so identity never changes). */
const DAY_FEED_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10 };

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Short local date label, e.g. "Jul 21", for a "YYYY-MM-DD" (or full ISO) string. */
function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${MONTH_ABBREVIATIONS[month - 1] ?? ""} ${day}`;
}

/** Chip/heading label for a prompt-day, given calendar days since today. */
function dayHeadingLabel(daysAgo: number, isoDate: string): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return formatShortDate(isoDate);
}

/** Calendar-day difference between two "YYYY-MM-DD" (or full ISO) date strings. */
function daysBetween(todayIsoDate: string, isoDate: string): number {
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(todayIsoDate);
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!todayMatch || !dayMatch) {
    return 0;
  }
  const today = Date.UTC(Number(todayMatch[1]), Number(todayMatch[2]) - 1, Number(todayMatch[3]));
  const day = Date.UTC(Number(dayMatch[1]), Number(dayMatch[2]) - 1, Number(dayMatch[3]));
  return Math.round((today - day) / 86_400_000);
}

interface ReflectionInputProps {
  promptId: string;
  channelId: string;
  onSubmitted: () => void;
}

/**
 * Locked-past-day reflection caption: lets the current user jot "what they
 * wish they'd drawn" and submit it as a text-only response (no image) via
 * the same POST /submit path the draw flow uses. On success, re-runs
 * loadDays so the day unlocks and the grid appears — the server invariant
 * (AC2) still gates visibility, this is just the text-only submit call.
 */
function ReflectionInput({ promptId, channelId, onSubmitted }: ReflectionInputProps): React.JSX.Element {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await dataClient.submit({ promptId, channelIds: [channelId], text: trimmed });
      setText("");
      onSubmitted();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save your reflection.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View testID="family-reflection">
      <PaperSurface className="gap-2 rounded-[18px] p-4">
        <Text className="text-foreground font-sans text-sm font-semibold">
          You didn&apos;t draw this day.
        </Text>
        <Text className="text-muted font-sans text-xs">What do you wish you&apos;d drawn?</Text>
        <TextInput
          testID="family-reflection-input"
          value={text}
          onChangeText={setText}
          placeholder="Write a quick reflection..."
          multiline
          className="border-line bg-surface text-foreground rounded-[12px] border px-3 py-2 font-sans text-sm"
        />
        {error ? <Text className="font-sans text-xs text-red-500">{error}</Text> : null}
        <Pressable
          testID="family-reflection-submit"
          onPress={() => void handleSubmit()}
          disabled={submitting || !text.trim()}
          className="bg-accent items-center justify-center rounded-full py-2 disabled:opacity-50"
        >
          {submitting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="font-sans text-sm font-semibold text-white">Save reflection</Text>
          )}
        </Pressable>
      </PaperSurface>
    </View>
  );
}

interface DaySectionProps {
  testID: string;
  heading: string;
  subheading: string | undefined;
  members: ChannelMember[];
  locked: boolean;
  promptId: string;
  channelId: string;
  currentUserId: string | undefined;
  isToday: boolean;
  onReflectionSubmitted: () => void;
}

/**
 * One prompt-day's section of the family wall: heading + member-tile grid.
 * Locked days show a CTA (today) or a reflection caption input (past day)
 * instead of the grid - submit-to-unlock stays server-enforced (AC2), this
 * only renders what the store already relayed as `locked`.
 */
function DaySection({
  testID,
  heading,
  subheading,
  members,
  locked,
  promptId,
  channelId,
  currentUserId,
  isToday,
  onReflectionSubmitted,
}: DaySectionProps): React.JSX.Element {
  return (
    <View testID={testID} className="w-full max-w-[760px] self-center gap-3 px-4 pb-5">
      <View className="gap-1">
        <Text className="font-display text-foreground text-lg">{heading}</Text>
        {subheading ? <Text className="text-muted font-sans text-sm">{subheading}</Text> : null}
      </View>

      {locked && isToday && (
        <Pressable
          testID="family-cta-tile"
          onPress={() => {
            useDraftStore.getState().clearDraft();
            router.push("/draw");
          }}
          className="border-accent w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed py-8"
        >
          <Icon as={Pencil} size={22} className="text-accent" />
          <Text className="text-foreground font-sans text-sm font-semibold">
            Draw for this wall to unlock it
          </Text>
        </Pressable>
      )}

      {locked && !isToday && (
        <ReflectionInput promptId={promptId} channelId={channelId} onSubmitted={onReflectionSubmitted} />
      )}

      {!locked && (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {members.map((member) => {
            const [color] = tileColor(member.userId);
            const isYou = member.userId === currentUserId;
            const response = member.response;

            // (a) Response present (own OR other): view-only tile. Tapping
            // your own tile views it too - never routes into the create flow.
            if (response) {
              return (
                <Pressable
                  key={member.userId}
                  testID="family-member-tile"
                  onPress={() =>
                    router.push({
                      pathname: "/response/[id]",
                      params: { id: response.id, channelId, promptId },
                    })
                  }
                  className={
                    isYou
                      ? "border-accent relative aspect-square w-[48%] overflow-hidden rounded-[18px] border-2"
                      : "border-line relative aspect-square w-[48%] overflow-hidden rounded-[18px] border"
                  }
                >
                  <PaperSurface className="flex-1 items-center justify-center p-4">
                    <EnhancedToggleImage
                      imageRef={response.imageRef}
                      enhancedImageRef={response.enhancedImageRef}
                      enhancementStatus={response.enhancementStatus}
                      variant="tile"
                      testID={`response-image-${response.id}`}
                      fallback={
                        <View style={{ width: 44, height: 44 }}>
                          <Doodle kind="crayon" color={color} />
                        </View>
                      }
                    />
                  </PaperSurface>
                  {isYou && (
                    <Pressable
                      testID="family-edit-tile"
                      accessibilityRole="button"
                      accessibilityLabel="Edit your drawing"
                      onPress={() =>
                        router.push({
                          pathname: "/response/[id]",
                          params: { id: response.id, channelId, promptId },
                        })
                      }
                      className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-surface/90 border-line border"
                    >
                      <Icon as={Pencil} size={14} className="text-accent" />
                    </Pressable>
                  )}
                  <View className="bg-surface gap-1 px-3 py-2">
                    {response.text ? (
                      <Text
                        numberOfLines={1}
                        testID={`family-member-caption-${member.userId}`}
                        className="text-foreground font-sans text-[11px]"
                      >
                        {response.text}
                      </Text>
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5">
                        <Avatar name={member.displayName} color={member.avatarColor} imageUri={member.avatarImage} size={20} />
                        <Text className="text-foreground font-sans text-xs font-semibold">
                          {isYou ? "You" : member.displayName}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Icon as={Heart} size={13} className="text-muted" />
                        <Text className="text-muted font-sans text-xs">
                          {response.reactions.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }

            // (c) No response + it's you: "Draw for this wall" CTA. Clear any
            // stale draft, then start a fresh drawing (never /write).
            if (isYou) {
              return (
                <Pressable
                  key={member.userId}
                  testID="family-cta-tile"
                  onPress={() => {
                    useDraftStore.getState().clearDraft();
                    router.push("/draw");
                  }}
                  className="border-accent aspect-square w-[48%] items-center justify-center gap-2 rounded-[18px] border-2 border-dashed"
                >
                  <Icon as={Pencil} size={22} className="text-accent" />
                  <Text className="text-foreground font-sans text-sm font-semibold">
                    Draw for this wall
                  </Text>
                </Pressable>
              );
            }

            // (b) No response + not you: "hasn't drawn yet" placeholder (no-op).
            return (
              <View
                key={member.userId}
                testID="family-placeholder-tile"
                className="border-line bg-surface aspect-square w-[48%] items-center justify-center gap-1 rounded-[18px] border border-dashed"
              >
                <Avatar name={member.displayName} color={member.avatarColor} imageUri={member.avatarImage} size={28} />
                <Icon as={Lock} size={16} className="text-muted" />
                <Text className="text-foreground font-sans text-sm font-semibold">
                  {member.displayName}
                </Text>
                <Text className="text-muted font-sans text-xs">hasn&apos;t drawn</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * Family (group channel) wall. Members + today's drawn status come from
 * useFamilyStore (dataClient.getChannelMembers), which relays the server's
 * submit-to-unlock invariant (AC2) as `locked` - never gated locally. Day
 * discovery comes from dataClient.listChannelDays (AC4-gated metadata only,
 * no peer content) - never from client-side prompt-probing.
 */
export default function FamilyScreen(): React.JSX.Element {
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const isArchive = Boolean(channelId && isArchiveChannel(channelId));
  const { data: promptData, load: loadPrompt, promptsByDate, loadPromptByDate } = usePromptStore();
  const { byDay, loadDays, daysByChannel, daysLoading, daysError, loadChannelDays } = useFamilyStore();
  const channelDays = channelId ? byDay[channelId] ?? {} : {};
  const { walls, load: loadWalls } = useWallsStore();
  const { archiveResponses, archiveLoading, loadArchive } = useWallStore();
  const currentUserId = useAuthStore((state) => state.currentUser?.id);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    void loadWalls();
  }, [loadWalls]);

  const promptId = promptData?.prompt.id;
  const todayIsoDate = promptData?.prompt.date;
  const rawDays = channelId ? daysByChannel?.[channelId] ?? [] : [];
  // A fresh wall has no responses yet, so listChannelDays (which only
  // reports days that already have at least one response) returns nothing
  // for today - leaving no section to render the "Draw for this wall" CTA.
  // Prepend a client-side stub for today (0 responses) whenever the
  // canonical today's date/promptId is missing from the server's list, so
  // the CTA always renders; the grid/lock state itself still comes from the
  // server via loadDays/byDay (AC2 stays server-enforced).
  const hasToday = promptId ? rawDays.some((day) => day.promptId === promptId) : true;
  const days =
    promptId && todayIsoDate && !hasToday
      ? [{ promptId, isoDate: todayIsoDate, responseCount: 0 }, ...rawDays]
      : rawDays;

  // Fetches the day list (metadata only: promptId/isoDate/responseCount) for
  // ANY channel, archive included - it's AC4-gated membership metadata only
  // (no peer content), so it's cheap and safe here. The archive is day-less
  // in its UI, but its day list is the only way to discover every prompt it
  // has ever drawn for (see recentPromptIds below).
  useEffect(() => {
    if (channelId) {
      void loadChannelDays(channelId);
    }
  }, [channelId, loadChannelDays]);

  // Personal-archive gallery needs EVERY prompt the archive has ever drawn
  // for (unlimited, day-less draws) - not just today/yesterday. Always
  // include today's promptId even if the server's day list hasn't reported
  // it yet (fresh archive, 0 responses so far).
  const archivePromptIds = Array.from(
    new Set([promptId, ...rawDays.map((day) => day.promptId)].filter((id): id is string => typeof id === "string")),
  );
  // archivePromptIds is derived fresh each render; the joined key keeps the
  // effect dep lists below stable across renders.
  const archivePromptIdsKey = archivePromptIds.join(",");

  useEffect(() => {
    if (channelId && isArchive) {
      void loadArchive(channelId, archivePromptIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isArchive, loadArchive, archivePromptIdsKey]);

  // Today's day must be loaded eagerly (not lazily) - the header pill and the
  // first section depend on it, and it may not be reported as "visible" by
  // FlatList before the first paint.
  useEffect(() => {
    if (channelId && !isArchive && promptId && !byDay[channelId]?.[promptId]) {
      void loadDays(channelId, [promptId]);
    }
  }, [channelId, isArchive, promptId, byDay, loadDays]);

  // Re-fetches on focus so returning from a submit (e.g. /draw -> back, or
  // hopping from one wall's draw flow to another) shows the just-submitted
  // drawing instead of the pre-submit cached grid. loadChannelDays/loadDays
  // merge into the store, so re-running them on every focus is safe (per-
  // channel scoped, see useFamilyStore) and cheap (metadata + one day).
  useFocusEffect(
    useCallback(() => {
      if (!channelId) {
        return;
      }
      if (isArchive) {
        void loadChannelDays(channelId);
        void loadArchive(channelId, archivePromptIds);
        return;
      }
      void loadChannelDays(channelId);
      if (promptId) {
        void loadDays(channelId, [promptId]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, isArchive, promptId, archivePromptIdsKey])
  );

  const channelName = walls.find((wall) => wall.id === channelId)?.name;
  const todayDayState = promptId ? channelDays[promptId] : undefined;
  const todayLocked = todayDayState?.locked ?? false;

  // rawDays (not `days`, which may carry a client-only synthetic "today"
  // stub) is the true signal for "server day-list fetch is in flight/empty".
  const loading = isArchive ? archiveLoading : daysLoading && rawDays.length === 0;

  /**
   * Lazily loads a day's member grid + prompt text as it nears the viewport.
   * Skips a re-fetch when the day is already present or in flight (loading,
   * locked, or already has members) - `loadDays` merges into `byDay`, so it
   * is safe but wasteful to call twice for the same settled day.
   */
  const ensureDayLoaded = useCallback(
    (day: ChannelDayMeta) => {
      if (!channelId) {
        return;
      }
      const existing = useFamilyStore.getState().byDay[channelId]?.[day.promptId];
      const alreadySettled =
        existing && (existing.loading || existing.locked || existing.members.length > 0 || existing.error !== null);
      if (!alreadySettled) {
        void loadDays(channelId, [day.promptId]);
      }
      void loadPromptByDate(day.isoDate);
    },
    [channelId, loadDays, loadPromptByDate]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const token of viewableItems) {
        const day = token.item as ChannelDayMeta | undefined;
        if (day) {
          ensureDayLoaded(day);
        }
      }
    },
    [ensureDayLoaded]
  );

  const renderDay = useCallback(
    ({ item }: { item: ChannelDayMeta }) => {
      if (!channelId || !todayIsoDate) {
        return null;
      }
      const daysAgo = daysBetween(todayIsoDate, item.isoDate);
      const heading = dayHeadingLabel(daysAgo, item.isoDate);
      const isToday = item.promptId === promptId;
      const promptText = isToday ? promptData?.prompt.text : promptsByDate[item.isoDate]?.text;
      const dayState = channelId ? byDay[channelId]?.[item.promptId] : undefined;
      const locked = dayState?.locked ?? false;
      const members = dayState?.members ?? [];

      return (
        <DaySection
          testID={`family-day-section-${item.promptId}`}
          heading={heading}
          subheading={promptText}
          members={members}
          locked={locked}
          promptId={item.promptId}
          channelId={channelId}
          currentUserId={currentUserId}
          isToday={isToday}
          onReflectionSubmitted={() => void loadDays(channelId, [item.promptId])}
        />
      );
    },
    [channelId, todayIsoDate, promptId, promptData, promptsByDate, byDay, currentUserId, loadDays]
  );

  return (
    <SafeAreaView testID="family-screen" className="bg-background flex-1">
      <ScreenHeader
        onBack={() => goBack("/home")}
        label={isArchive ? "PERSONAL ARCHIVE" : "FAMILY WALL"}
      />

      {!channelId && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-foreground text-center">
            Pick a family wall from Home.
          </Text>
        </View>
      )}

      {channelId && loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="family-loading" />
        </View>
      )}

      {channelId && !loading && !isArchive && daysError && rawDays.length === 0 && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-foreground text-center">Could not load the family wall.</Text>
          <Button onPress={() => channelId && void loadChannelDays(channelId)}>
            <Text>Try again</Text>
          </Button>
        </View>
      )}

      {channelId && !loading && isArchive && (
        <ScrollView
          testID="family-archive-gallery"
          contentContainerClassName="gap-5 px-4 pb-10"
          showsVerticalScrollIndicator={false}
        >
          <ScribbleBackdrop />
          <View className="w-full max-w-[760px] self-center gap-5">
          <View className="items-center gap-1">
            <Text className="font-display text-foreground text-[22px]">
              {channelName ?? "Personal Archive"}
            </Text>
            <Text className="text-muted font-sans text-sm">
              Just you — draw as much as you like.
            </Text>
            {archiveResponses.length > 0 ? (
              <Text className="text-muted font-sans text-xs">
                {archiveResponses.length} doodle{archiveResponses.length === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>

          <Pressable
            testID="family-cta-tile"
            onPress={() => {
              useDraftStore.getState().clearDraft();
              router.push("/draw");
            }}
            className="border-accent w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed py-8"
          >
            <Icon as={Pencil} size={22} className="text-accent" />
            <Text className="text-foreground font-sans text-sm font-semibold">Draw</Text>
          </Pressable>

          {archiveResponses.length === 0 && (
            <View testID="family-archive-empty" className="items-center gap-3 py-6">
              <View style={{ width: 56, height: 56 }}>
                <Doodle kind="crayon" color="#2FD3C6" />
              </View>
              <Text className="text-muted text-center font-sans text-sm">
                Your archive is empty. Doodles you draw here are just for you.
              </Text>
            </View>
          )}

          <View className="flex-row flex-wrap justify-between gap-y-3">
            {archiveResponses.map((response) => {
              const [color] = tileColor(response.authorId);
              return (
                <Pressable
                  key={response.id}
                  testID="family-archive-tile"
                  onPress={() =>
                    router.push({
                      pathname: "/response/[id]",
                      params: { id: response.id, channelId, promptId: response.promptId },
                    })
                  }
                  className="border-line aspect-square w-[48%] overflow-hidden rounded-[18px] border"
                >
                  <PaperSurface className="flex-1 items-center justify-center p-4">
                    <EnhancedToggleImage
                      imageRef={response.imageRef}
                      enhancedImageRef={response.enhancedImageRef}
                      enhancementStatus={response.enhancementStatus}
                      variant="tile"
                      testID={`response-image-${response.id}`}
                      fallback={
                        <View style={{ width: 44, height: 44 }}>
                          <Doodle kind="crayon" color={color} />
                        </View>
                      }
                    />
                  </PaperSurface>
                  <View className="bg-surface gap-1 px-3 py-2">
                    {response.text ? (
                      <Text
                        numberOfLines={1}
                        testID={`family-archive-caption-${response.id}`}
                        className="text-foreground font-sans text-[11px]"
                      >
                        {response.text}
                      </Text>
                    ) : null}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-muted font-sans text-xs">
                        {formatShortDate(response.createdAt)}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Icon as={Heart} size={13} className="text-muted" />
                        <Text className="text-muted font-sans text-xs">
                          {response.reactions.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          </View>
        </ScrollView>
      )}

      {channelId && !loading && !isArchive && !daysError && (
        <FlatList
          testID="family-day-feed"
          data={days}
          keyExtractor={(day) => day.promptId}
          renderItem={renderDay}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={DAY_FEED_VIEWABILITY_CONFIG}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View className="w-full max-w-[760px] self-center items-center gap-4 px-4 pb-4">
              <ScribbleBackdrop />
              {!todayLocked && (
                <View
                  className="flex-row items-center gap-2 rounded-full border px-4 py-2"
                  style={{ backgroundColor: "rgba(47,211,198,0.14)", borderColor: "#2FD3C6" }}
                >
                  <Icon as={Check} size={16} color="#2FD3C6" />
                  <Text className="font-sans text-sm font-semibold" style={{ color: "#2FD3C6" }}>
                    Unlocked! You drew today.
                  </Text>
                </View>
              )}

              <View className="items-center gap-1">
                <Text className="font-display text-foreground text-[22px]">
                  {channelName ?? "This channel"}
                </Text>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
