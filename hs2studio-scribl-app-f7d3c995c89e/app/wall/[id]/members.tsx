import { router, useLocalSearchParams } from "expo-router";
import type { RosterMember } from "@scribl/shared/index";
import { LogOut } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { dataClient } from "@/src/data";
import { confirmAction } from "@/src/lib/confirm";
import { parseEmails } from "@/src/lib/emails";
import { goBack } from "@/src/lib/nav";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/**
 * Member roster for a single wall/channel: displayName + email for each
 * member (read via dataClient.getChannelRoster, AC4-gated membership only,
 * no submit-to-unlock), creator-only multi-email "invite by email" row
 * (dataClient.inviteMember per address), and creator-only Remove per member.
 */
export default function WallMembersScreen(): React.JSX.Element {
  const { id: channelId } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((state) => state.currentUser?.id);

  const [members, setMembers] = useState<RosterMember[]>([]);
  const [createdBy, setCreatedBy] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const loadWalls = useWallsStore((state) => state.load);
  const canInvite = !!createdBy && currentUserId === createdBy;

  const loadMembers = useCallback(
    async (isActive: () => boolean = () => true): Promise<void> => {
      if (!channelId) return;
      setLoading(true);
      setError(null);
      try {
        const roster = await dataClient.getChannelRoster(channelId);
        if (!isActive()) return;
        setMembers(roster.members);
        setCreatedBy(roster.createdBy);
      } catch (caught) {
        if (!isActive()) return;
        const message = caught instanceof Error ? caught.message : "Failed to load members.";
        setError(message);
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [channelId],
  );

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    void Promise.resolve().then(() => loadMembers(() => !cancelled));
    return () => {
      cancelled = true;
    };
  }, [channelId, loadMembers]);

  async function handleInvite(): Promise<void> {
    if (!channelId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);

    const { valid, invalid } = parseEmails(inviteEmail);
    let addedCount = 0;
    const failures: string[] = [];
    for (const email of valid) {
      try {
        await dataClient.inviteMember(channelId, email);
        addedCount += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to send invite.";
        failures.push(`${email}: ${message}`);
      }
    }

    setInviteEmail("");
    await loadMembers();

    const parts: string[] = [`Added ${addedCount}`];
    if (failures.length > 0) {
      parts.push(`Failed: ${failures.join(", ")}`);
    }
    if (invalid.length > 0) {
      parts.push(`Invalid: ${invalid.join(", ")}`);
    }
    setInviteResult(parts.join(" — "));
    setInviting(false);
  }

  async function doLeave(): Promise<void> {
    if (!channelId) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await dataClient.leaveWall(channelId);
      await loadWalls();
      router.back();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to leave wall.";
      setLeaveError(message);
    }
    setLeaving(false);
  }

  async function handleLeave(): Promise<void> {
    // Guard against orphaning the wall: if the caller is its sole owning
    // member (createdBy) and no one else is left, leaving would make the
    // channel permanently inaccessible (the server has no ownership-transfer
    // path). Block client-side with a clear message rather than silently
    // orphaning it.
    const isSoleOwner =
      !!currentUserId && currentUserId === createdBy && members.length <= 1;
    if (isSoleOwner) {
      setLeaveError(
        "You're the only member of this wall. Add another member before leaving, or delete the wall instead.",
      );
      return;
    }
    const confirmed = await confirmAction(
      "Leave wall?",
      "You'll need to be re-invited to rejoin this wall.",
      "Leave",
    );
    if (confirmed) {
      await doLeave();
    }
  }

  async function handleRemove(member: RosterMember): Promise<void> {
    if (!channelId) return;
    const confirmed = await confirmAction(
      "Remove member?",
      "They'll need to be re-invited to rejoin.",
      "Remove",
    );
    if (!confirmed) return;
    try {
      await dataClient.removeMember(channelId, member.userId);
      await loadMembers();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to remove member.";
      setError(message);
    }
  }

  return (
    <SafeAreaView testID="wall-members-screen" className="bg-background flex-1">
      <ScreenHeader onBack={() => goBack("/settings")} label="MEMBERS" />

      {(!channelId || loading) && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="wall-members-loading" />
        </View>
      )}

      {channelId && !loading && error && (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-foreground text-center">Could not load members.</Text>
          <Button onPress={() => void loadMembers()}>
            <Text>Try again</Text>
          </Button>
        </View>
      )}

      {channelId && !loading && !error && (
        <ScrollView contentContainerClassName="gap-3 px-4 pb-10" showsVerticalScrollIndicator={false}>
          <ScribbleBackdrop />
          {members.map((member) => {
            const canRemove =
              !!createdBy && currentUserId === createdBy && member.userId !== createdBy;
            return (
              <View
                key={member.userId}
                testID={`wall-member-row-${member.userId}`}
                className="bg-surface border-line rounded-card flex-row items-center justify-between border p-4"
              >
                <View className="flex-row items-center gap-3">
                  <Avatar
                    testID={`member-avatar-${member.userId}`}
                    name={member.displayName}
                    color={member.avatarColor}
                    imageUri={member.avatarImage}
                    size={40}
                  />
                  <View className="gap-0.5">
                    <Text className="text-foreground font-sans text-base font-semibold">
                      {member.displayName}
                    </Text>
                    <Text className="text-muted font-sans text-xs">{member.email}</Text>
                  </View>
                </View>
                {canRemove && (
                  <Button
                    testID={`wall-remove-member-${member.userId}`}
                    variant="ghost"
                    onPress={() => void handleRemove(member)}
                  >
                    <Text className="font-sans text-sm font-semibold text-red-500">Remove</Text>
                  </Button>
                )}
              </View>
            );
          })}

          {canInvite && (
            <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
              <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
                Add member
              </Text>
              <TextInput
                testID="wall-add-member-input"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="friend@example.com, another@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                className="text-foreground font-sans text-base"
              />
              {inviteError && (
                <Text testID="wall-add-member-error" className="text-sm text-red-500">
                  {inviteError}
                </Text>
              )}
              {inviteResult && (
                <Text testID="wall-add-member-result" className="text-muted font-sans text-sm">
                  {inviteResult}
                </Text>
              )}
              <Button
                testID="wall-add-member-button"
                disabled={!inviteEmail.trim() || inviting}
                onPress={() => void handleInvite()}
              >
                <Text>+ Add member</Text>
              </Button>
            </View>
          )}

          {leaveError && (
            <Text testID="wall-leave-error" className="text-sm text-red-500">
              {leaveError}
            </Text>
          )}
          <Pressable
            testID="wall-leave-button"
            disabled={leaving}
            onPress={() => void handleLeave()}
            className="border-line rounded-card flex-row items-center justify-center gap-2 border p-4"
          >
            <Icon as={LogOut} size={16} className="text-red-500" />
            <Text className="font-sans text-sm font-semibold text-red-500">Leave wall</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
