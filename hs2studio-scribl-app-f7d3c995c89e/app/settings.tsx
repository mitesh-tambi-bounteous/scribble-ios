import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ThemeSwitcher } from "@/components/nav/ThemeSwitcher";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { goBack } from "@/src/lib/nav";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ChevronRight, LogOut, Pencil } from "lucide-react-native";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useWallsStore } from "@/src/stores/useWallsStore";

/**
 * Settings screen: edit profile (display name, email) via
 * useAuthStore.updateProfile, draw a custom avatar via the canvas
 * (/avatar), plus a read-only list of the user's walls that deep-links
 * into each wall's member roster.
 */
export default function SettingsScreen(): React.JSX.Element {
  const currentUser = useAuthStore((state) => state.currentUser);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const authError = useAuthStore((state) => state.error);
  const { walls, load: loadWalls } = useWallsStore();

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (walls.length === 0) {
      loadWalls();
    }
  }, [walls.length, loadWalls]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaved(false);
    const ok = await updateProfile({
      displayName: displayName.trim(),
      email: email.trim(),
    });
    setSaving(false);
    setSaved(ok);
  }

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    router.replace("/sign-up");
  }

  return (
    <SafeAreaView testID="settings-screen" className="bg-background flex-1">
      <ScreenHeader onBack={() => goBack("/home")} label="SETTINGS" />

      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <ScribbleBackdrop />
        <View className="w-full max-w-[760px] self-center gap-6">
        <View className="items-center gap-3">
          <Avatar
            testID="settings-avatar"
            name={displayName}
            color={currentUser?.avatarColor}
            imageUri={currentUser?.avatarImage}
            size={72}
          />

          <Pressable
            testID="settings-change-avatar"
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            onPress={() => router.push("/avatar")}
            className="bg-surface border-line flex-row items-center gap-2 rounded-full border px-4 py-2"
          >
            <Icon as={Pencil} size={15} className="text-foreground" />
            <Text className="text-foreground font-sans text-sm font-semibold">Change avatar</Text>
          </Pressable>
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Display name
          </Text>
          <TextInput
            testID="settings-name-input"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            className="text-foreground font-sans text-base"
          />
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Email
          </Text>
          <TextInput
            testID="settings-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            className="text-foreground font-sans text-base"
          />
        </View>

        <View className="bg-surface border-line gap-2 rounded-[14px] border p-4">
          <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
            Password
          </Text>
          <TextInput
            testID="settings-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="text-foreground font-sans text-base"
          />
          <Text className="text-muted font-sans text-[11px]">
            Not wired up in this POC.
          </Text>
        </View>

        {authError && (
          <Text testID="settings-error" className="text-sm text-red-500">
            {authError}
          </Text>
        )}
        {saved && (
          <Text testID="settings-saved" className="text-accent text-sm font-sans">
            Saved.
          </Text>
        )}

        <Button
          testID="settings-save"
          disabled={!displayName.trim() || !email.trim() || saving}
          onPress={() => void handleSave()}
        >
          <Text>Save</Text>
        </Button>

        <View className="gap-3">
          <Text className="font-display text-foreground text-lg">Theme</Text>
          <ThemeSwitcher />
        </View>

        <View className="gap-3">
          <Text className="font-display text-foreground text-lg">Your walls</Text>
          {walls.map((wall) => (
            <Pressable
              key={wall.id}
              testID={`settings-wall-${wall.id}`}
              onPress={() =>
                router.push({ pathname: "/wall/[id]/members", params: { id: wall.id } })
              }
              className="bg-surface border-line rounded-card flex-row items-center justify-between border p-4"
            >
              <Text className="text-foreground font-sans text-base font-semibold">
                {wall.name}
              </Text>
              <Icon as={ChevronRight} size={18} className="text-muted" />
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="settings-logout"
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={() => void handleLogout()}
          disabled={loggingOut}
          className="bg-surface border-line flex-row items-center justify-center gap-2 rounded-[14px] border p-4"
        >
          <Icon as={LogOut} size={16} className="text-foreground" />
          <Text className="text-foreground font-sans text-base font-semibold">
            {loggingOut ? "Logging out..." : "Log out"}
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
