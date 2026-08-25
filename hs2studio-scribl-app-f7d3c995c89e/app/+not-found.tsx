import { Stack, useRouter } from "expo-router";
import { View } from "react-native";

import { Doodle } from "@/components/art/Doodle";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/** Fallback screen for unmatched routes, on-brand with the rest of the app. */
export default function NotFoundScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="bg-background w-full max-w-[760px] self-center flex-1 items-center justify-center gap-5 px-8">
        <View style={{ width: 64, height: 64 }}>
          <Doodle kind="ghost" color="#6C7BFF" />
        </View>
        <Text className="font-display text-foreground text-center text-[26px]">
          This screen doesn&apos;t exist.
        </Text>
        <Text className="text-muted text-center text-[15px]">
          Looks like this page wandered off the page. Let&apos;s get you back to today&apos;s
          prompt.
        </Text>
        <Button testID="not-found-home" onPress={() => router.replace("/")}>
          <Text>Back to Today</Text>
        </Button>
      </View>
    </>
  );
}
