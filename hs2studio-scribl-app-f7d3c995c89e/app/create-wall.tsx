import { router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { dataClient } from "@/src/data";
import { parseEmails } from "@/src/lib/emails";
import { goBack } from "@/src/lib/nav";
import { useWallsStore, type WallKind } from "@/src/stores/useWallsStore";

/** Segmented options for the wall-kind picker below. */
const WALL_KIND_OPTIONS: { kind: WallKind; label: string }[] = [
  { kind: "group", label: "Group" },
  { kind: "challenge", label: "Challenge" },
];

/**
 * Create-wall screen. Wired to useWallsStore.createWall (real dataClient
 * call) — no server membership invariants are enforced here (that stays
 * server-side, AC4). If an invite email was entered, invites that person
 * into the newly created wall via dataClient.inviteMember once the wall
 * exists (the invite endpoint requires the caller to already be a member,
 * which createWall's creator-membership grant satisfies).
 */
export default function CreateWallScreen(): React.JSX.Element {
  const createWall = useWallsStore((state) => state.createWall);
  const storeError = useWallsStore((state) => state.error);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WallKind>("group");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim()) return;
    setSubmitting(true);
    setInviteError(null);
    const ok = await createWall({
      name: name.trim(),
      kind,
      isPublic: false,
    });
    if (ok && inviteEmail.trim()) {
      const wall = useWallsStore.getState().lastCreatedWall;
      if (wall) {
        const { valid, invalid } = parseEmails(inviteEmail);
        const failures: string[] = [];
        for (const email of valid) {
          try {
            await dataClient.inviteMember(wall.id, email);
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Failed to send invite.";
            failures.push(`${email}: ${message}`);
          }
        }
        const parts: string[] = [];
        if (failures.length > 0) {
          parts.push(`Failed: ${failures.join(", ")}`);
        }
        if (invalid.length > 0) {
          parts.push(`Invalid: ${invalid.join(", ")}`);
        }
        if (parts.length > 0) {
          setInviteError(parts.join(" — "));
        }
      }
    }
    setSubmitting(false);
    if (ok) {
      router.push("/home");
    }
  }

  return (
    <SafeAreaView testID="create-wall-screen" className="bg-background flex-1">
      <ScribbleBackdrop />
      <ScreenHeader
        onBack={() => goBack("/home")}
        label="CREATE A WALL"
      />

      <View className="w-full max-w-[760px] self-center flex-1 gap-6 px-5 pt-2">
        <View className="gap-1">
          <Text className="font-display text-foreground text-2xl">Start a new wall</Text>
          <Text className="text-muted font-sans text-sm">
            Invite your people. Everyone draws the same daily prompt.
          </Text>
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Wall name
          </Text>
          <TextInput
            testID="create-wall-name"
            value={name}
            onChangeText={setName}
            placeholder="Wall name (e.g. Book club)"
            placeholderTextColor="#9CA3AF"
            className="text-foreground font-sans text-base"
          />
        </View>

        <View className="gap-2">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Wall type
          </Text>
          <View className="flex-row gap-2">
            {WALL_KIND_OPTIONS.map((option) => {
              const isSelected = option.kind === kind;
              return (
                <Pressable
                  key={option.kind}
                  testID={`create-wall-kind-${option.kind}`}
                  onPress={() => setKind(option.kind)}
                  className={
                    isSelected
                      ? "bg-accent/15 border-accent flex-1 items-center rounded-[14px] border-2 py-3"
                      : "bg-surface border-line flex-1 items-center rounded-[14px] border py-3"
                  }
                >
                  <Text className="text-foreground font-sans text-sm font-semibold">
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Invite by email (optional)
          </Text>
          <TextInput
            testID="create-wall-invite-input"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="friend@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            className="text-foreground font-sans text-base"
          />
        </View>
      </View>

      <View className="w-full max-w-[760px] self-center px-5 pb-6 gap-2">
        {storeError && (
          <Text testID="create-wall-error" className="text-sm text-red-500">
            {storeError}
          </Text>
        )}
        {inviteError && (
          <Text testID="create-wall-invite-error" className="text-sm text-red-500">
            {inviteError}
          </Text>
        )}
        <Button
          testID="create-wall-submit"
          disabled={!name.trim() || submitting}
          onPress={() => void handleCreate()}
        >
          <Text>Create wall</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
