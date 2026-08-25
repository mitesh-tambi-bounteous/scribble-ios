import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomNav } from "@/components/nav/BottomNav";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * Splash screen (S-009): minimal brand-only landing, matching the 2026-07-22
 * design mockup — the app icon over the scribl wordmark (with the rainbow
 * underline) and a tagline, on the scribble sketchbook backdrop. No prompt,
 * streak, or countdown state lives here; those belong to their own screens.
 */
export default function SplashScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <View className="flex-1 items-center justify-center px-8">
        <View testID="splash-brand" className="w-full max-w-[760px] items-center gap-6">
          <Image
            source={require("../assets/images/android-icon-foreground.png")}
            accessibilityLabel="scribl app icon"
            resizeMode="contain"
            style={{
              width: 170,
              height: 170,
              // Compensates for the asset's internal transparent padding
              // (the S-mark occupies ~55% of the frame), so it doesn't
              // read as detached from the wordmark below it.
              marginBottom: -18,
            }}
          />

          <View className="items-center gap-3">
            <View className="items-center gap-3">
              <View className="flex-row items-start">
                <Text className="font-display text-foreground text-[46px] leading-[48px]">
                  scribl
                </Text>
                <Text className="text-muted mt-1 text-[15px]">®</Text>
              </View>
              <LinearGradient
                colors={["#FF9F45", "#FF3D9A", "#6C7BFF", "#2FD3C6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 150, height: 6, borderRadius: 3 }}
              />
            </View>

            <Text className="text-muted text-center text-[15px]" style={{ maxWidth: 280 }}>
              One prompt. One doodle. A little more human, together.
            </Text>
          </View>
        </View>
      </View>

      <View className="w-full max-w-[760px] self-center px-5 pb-3">
        <Button className="w-full" testID="splash-start" onPress={() => router.replace("/")}>
          <Text>Let&apos;s start drawing</Text>
        </Button>
      </View>

      <View className="w-full max-w-[760px] self-center px-4 pb-4">
        <BottomNav
          onHome={() => router.replace("/home")}
          onDraw={() => router.replace("/")}
          onYou={() => router.replace("/settings")}
        />
      </View>
    </SafeAreaView>
  );
}
