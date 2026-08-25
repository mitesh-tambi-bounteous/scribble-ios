import "../global.css";

import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { vars } from "nativewind";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useAuthStore } from "@/src/stores/useAuthStore";
import { useThemeStore } from "@/src/stores/useThemeStore";
import { THEME_VARS } from "@/src/theme/tokens";

void SplashScreen.preventAutoHideAsync();

/**
 * Font family keys registered for the app:
 * - "Fredoka" -> Fredoka_600SemiBold (default weight for font-display)
 * - "Fredoka-Regular" / "Fredoka-Medium" / "Fredoka-Bold" -> weight variants
 * - "Manrope" -> Manrope_400Regular (default weight for font-sans)
 * - "Manrope-Medium" / "Manrope-SemiBold" / "Manrope-Bold" / "Manrope-ExtraBold"
 *   -> weight variants
 * Screens use font-display / font-sans (tailwind.config.js) for the
 * default weights; reach for the weight-suffixed keys via style={{fontFamily}}
 * for headings/buttons that need a heavier cut.
 */
const FONT_MAP = {
  Fredoka: Fredoka_600SemiBold,
  "Fredoka-Regular": Fredoka_400Regular,
  "Fredoka-Medium": Fredoka_500Medium,
  "Fredoka-Bold": Fredoka_700Bold,
  Manrope: Manrope_400Regular,
  "Manrope-Medium": Manrope_500Medium,
  "Manrope-SemiBold": Manrope_600SemiBold,
  "Manrope-Bold": Manrope_700Bold,
  "Manrope-ExtraBold": Manrope_800ExtraBold,
} as const;

/**
 * Applies the active theme's CSS vars (native) and `.theme-*` class (web)
 * around the whole app, and keeps the status bar readable against each
 * theme's background.
 */
function ThemeRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const load = useThemeStore((state) => state.load);

  useEffect(() => {
    void load();
    void useAuthStore.getState().hydrate();
  }, [load]);

  return (
    <View style={vars(THEME_VARS[theme])} className={`flex-1 theme-${theme}`}>
      <StatusBar style={theme === "notepad" || theme === "scribble" ? "dark" : "light"} />
      {children}
    </View>
  );
}

/**
 * Gates the navigator until the auth session has finished hydrating, so no
 * screen mounts (and fires its first authed data-load) before the active user
 * id is restored from storage. Without this, a hard load onto a deep route
 * (e.g. a browser refresh on /home) would send its first request with no
 * x-user-id and render a degraded empty state. ThemeRoot triggers hydrate();
 * this component just waits for it to complete.
 */
function HydratedStack(): React.JSX.Element {
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator testID="app-hydrating" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

/**
 * Root layout — single-stack navigator for the POC.
 * Keep this thin; screens own their own state via Zustand stores.
 */
export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeRoot>
        <HydratedStack />
      </ThemeRoot>
    </GestureHandlerRootView>
  );
}
