import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Home, Pencil, Users } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";

export type BottomNavActive = "home" | "you";

export interface BottomNavProps {
  active?: BottomNavActive;
  onHome?: () => void;
  onDraw?: () => void;
  onYou?: () => void;
}

/** Floating pill bottom nav: Home / raised center Draw button / You. */
export function BottomNav({ active, onHome, onDraw, onYou }: BottomNavProps): React.JSX.Element {
  return (
    <View className="bg-paper border-line flex-row items-center justify-between rounded-[22px] border px-6 py-2">
      <Pressable
        testID="nav-home"
        onPress={onHome}
        accessibilityRole="button"
        accessibilityLabel="Home"
        className="items-center justify-center px-4 py-2"
      >
        <Icon as={Home} className={cn(active === "home" ? "text-foreground" : "text-muted")} size={22} />
      </Pressable>

      <Pressable
        testID="nav-draw"
        onPress={onDraw}
        accessibilityRole="button"
        accessibilityLabel="Draw"
        className="bg-btn -mt-4 h-[52px] w-[52px] items-center justify-center rounded-full"
      >
        <Icon as={Pencil} className="text-btn-foreground" size={22} />
      </Pressable>

      <Pressable
        testID="nav-you"
        onPress={onYou}
        accessibilityRole="button"
        accessibilityLabel="You"
        className="items-center justify-center px-4 py-2"
      >
        <Icon as={Users} className={cn(active === "you" ? "text-foreground" : "text-muted")} size={22} />
      </Pressable>
    </View>
  );
}
