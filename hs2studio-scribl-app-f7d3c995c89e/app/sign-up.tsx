import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mail, User as UserIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { User } from "@scribl/shared/index";
import { Image, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuthStore } from "@/src/stores/useAuthStore";

type AuthMode = "signup" | "login";

/**
 * Auth screen (stubbed auth, no passwords). Two modes:
 * - "signup": signUp(email, displayName) creates the account.
 * - "login": login(email, displayName) validates an existing account by BOTH
 *   email and name (case-insensitive, trimmed). A wrong email OR a wrong name
 *   is a miss; both must match the stored user to sign in.
 * On a login miss the store reports "No account matches that email and name."
 * and the screen offers to switch to sign-up. The existing-user switcher
 * (local switchUser, no server call) stays available in sign-up mode.
 */
export default function SignUpScreen(): React.JSX.Element {
  const router = useRouter();
  const { signUp, login, listUsers, switchUser, loading, error } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listUsers().then((result) => {
      if (!cancelled) setUsers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [listUsers]);

  function switchMode(next: AuthMode): void {
    if (next === mode) return;
    // Clear any stale error when switching between sign-up and log-in.
    useAuthStore.setState({ error: null });
    setMode(next);
  }

  const isLogin = mode === "login";
  // Both modes need email AND name: sign-up creates them, log-in matches both.
  const canSubmit = Boolean(email.trim() && displayName.trim());

  async function handleCreate(): Promise<void> {
    if (!email.trim() || !displayName.trim()) return;
    await signUp(email.trim(), displayName.trim());
    if (useAuthStore.getState().currentUser) {
      router.replace("/splash");
    }
  }

  async function handleLogin(): Promise<void> {
    if (!email.trim() || !displayName.trim()) return;
    await login(email.trim(), displayName.trim());
    if (useAuthStore.getState().currentUser) {
      router.replace("/splash");
    }
  }

  async function handleSwitch(user: User): Promise<void> {
    await switchUser(user);
    router.replace("/splash");
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <View className="w-full max-w-[760px] self-center flex-1 items-center justify-center px-6 py-4">
        <View className="items-center gap-6">
          <View testID="signup-brand" className="items-center gap-3">
            <Image
              source={require("../assets/images/android-icon-foreground.png")}
              accessibilityLabel="scribl app icon"
              resizeMode="contain"
              style={{
                width: 88,
                height: 88,
                // Compensates for the asset's internal transparent padding
                // (the S-mark occupies ~55% of the frame), so it doesn't
                // read as detached from the wordmark below it.
                marginBottom: -10,
              }}
            />
            <View className="items-center gap-1">
              <View className="flex-row items-start">
                <Text className="font-display text-foreground text-[30px] leading-[32px]">
                  scribl
                </Text>
                <Text className="text-muted mt-1 text-[11px]">®</Text>
              </View>
              <LinearGradient
                colors={["#FF9F45", "#FF3D9A", "#6C7BFF", "#2FD3C6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 96, height: 5, borderRadius: 3 }}
              />
            </View>
          </View>

          <View className="items-center gap-3">
            <Text className="font-display text-foreground text-center text-[33px] leading-[38px]">
              One prompt.{"\n"}One drawing.{"\n"}Every day.
            </Text>
            <Text className="text-muted max-w-[420px] text-center text-[15px]">
              The prompt writes itself. The art is all you. No public feed, no strangers — just
              your people.
            </Text>
          </View>

          <View className="w-full max-w-[360px] items-center gap-6">
          <View className="bg-background border-line w-full flex-row rounded-[14px] border p-1">
            <Pressable
              testID="auth-mode-signup"
              onPress={() => switchMode("signup")}
              className={`flex-1 items-center rounded-[10px] py-2 ${isLogin ? "" : "bg-surface"}`}
            >
              <Text
                className={`font-sans text-sm font-semibold ${isLogin ? "text-muted" : "text-foreground"}`}
              >
                Sign up
              </Text>
            </Pressable>
            <Pressable
              testID="auth-mode-login"
              onPress={() => switchMode("login")}
              className={`flex-1 items-center rounded-[10px] py-2 ${isLogin ? "bg-surface" : ""}`}
            >
              <Text
                className={`font-sans text-sm font-semibold ${isLogin ? "text-foreground" : "text-muted"}`}
              >
                Log in
              </Text>
            </Pressable>
          </View>

          <View className="w-full gap-3">
            <View className="bg-surface border-line w-full flex-row items-center gap-3 rounded-[14px] border p-4">
              <Icon as={Mail} className="text-muted" size={18} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                className="text-foreground flex-1 font-sans"
                testID="auth-email"
              />
            </View>
            <View className="bg-surface border-line w-full flex-row items-center gap-3 rounded-[14px] border p-4">
              <Icon as={UserIcon} className="text-muted" size={18} />
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                className="text-foreground flex-1 font-sans"
                testID="auth-display-name"
              />
            </View>
            {isLogin && (
              <Text className="text-muted text-xs">
                We check both your email and your name to sign you in.
              </Text>
            )}
          </View>

          {error && (
            <View className="gap-2">
              <Text className="text-sm text-red-500" testID="auth-error">
                {error}
              </Text>
              {isLogin && (
                <Pressable testID="auth-offer-signup" onPress={() => switchMode("signup")}>
                  <Text className="text-foreground font-sans text-sm font-semibold underline">
                    No account? Create one
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {!isLogin && users.length > 0 && (
            <View className="gap-2">
              <Text className="text-muted text-xs font-extrabold uppercase tracking-widest">
                Or switch to an existing scribbler
              </Text>
              <View className="gap-2">
                {users.map((user) => (
                  <Pressable
                    key={user.id}
                    testID={`switch-user-${user.id}`}
                    onPress={() => void handleSwitch(user)}
                    className="bg-surface border-line flex-row items-center justify-between rounded-[14px] border p-3"
                  >
                    <Text className="text-foreground font-sans text-sm font-semibold">
                      {user.displayName}
                    </Text>
                    <Text className="text-muted font-sans text-xs">{user.email}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Button
            className="w-full"
            testID="auth-submit"
            disabled={loading || !canSubmit}
            onPress={() => void (isLogin ? handleLogin() : handleCreate())}
          >
            <Text>{isLogin ? "Log in" : "Create account"}</Text>
          </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
