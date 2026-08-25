import { useRouter } from "expo-router";
import { LayoutGrid, Pencil, Sun, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useOnboardingStore } from "@/src/stores/useOnboardingStore";

interface TutorialPanel {
  t: string;
  b: string;
  c: string;
  icon: LucideIcon;
}

const PANELS: TutorialPanel[] = [
  {
    t: "A fresh prompt daily",
    b: "Everyone gets the same playful prompt each morning. Draw your take before midnight — no do-overs.",
    c: "#FF9F45",
    icon: Sun,
  },
  {
    t: "Draw, don't type",
    b: "Fingers only. A handful of colors, one honest brush. The wonky drawings are the whole point.",
    c: "#FF3D9A",
    icon: Pencil,
  },
  {
    t: "Unlock the wall",
    b: "Submit yours to reveal everyone else's. Then watch your family's beautiful chaos roll in.",
    c: "#6C7BFF",
    icon: LayoutGrid,
  },
];

/**
 * Tutorial / onboarding stepper (S-011). Static three-panel walkthrough;
 * skip or finishing the last panel both call completeOnboarding() and
 * replace to /splash.
 */
export default function TutorialScreen(): React.JSX.Element {
  const router = useRouter();
  const [tut, setTut] = useState<number>(0);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const isLast = tut === PANELS.length - 1;
  const panel = PANELS[tut];

  const finish = (): void => {
    void completeOnboarding();
    router.replace("/splash");
  };

  const handleNext = (): void => {
    if (isLast) {
      finish();
      return;
    }
    setTut((prev) => prev + 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <View className="w-full max-w-[760px] self-center flex-row justify-end px-6 py-4">
        <Pressable onPress={finish} accessibilityRole="button" testID="tutorial-skip">
          <Text className="text-muted text-sm">Skip</Text>
        </Pressable>
      </View>

      <View className="w-full max-w-[760px] self-center flex-1 items-center justify-center gap-6 px-6">
        <View
          className="bg-surface border-line items-center justify-center rounded-[40px] border"
          style={{ width: 164, height: 164 }}
        >
          <Icon as={panel.icon} size={76} color={panel.c} />
        </View>
        <View className="items-center gap-3">
          <Text className="font-display text-foreground text-center text-[27px]">{panel.t}</Text>
          <Text className="text-muted text-center text-[15.5px]" style={{ maxWidth: 280 }}>
            {panel.b}
          </Text>
        </View>
      </View>

      <View className="w-full max-w-[760px] self-center items-center gap-6 px-6 pb-6">
        <View className="flex-row items-center gap-2">
          {PANELS.map((p, i) => (
            <View
              key={p.t}
              className={
                i === tut
                  ? "bg-foreground h-2 w-6 rounded-full"
                  : "border-line h-2 w-2 rounded-full border"
              }
            />
          ))}
        </View>
        <Button className="w-full" testID="tutorial-next" onPress={handleNext}>
          <Text>{isLast ? "Start drawing" : "Next"}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
