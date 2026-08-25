import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/src/stores/useThemeStore";
import type { ThemeName } from "@/src/theme/tokens";
import * as React from "react";
import { Pressable, View } from "react-native";

const OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "scribble", label: "scribl" },
  { value: "ink", label: "Ink" },
  { value: "studio", label: "Studio" },
  { value: "notepad", label: "Notepad" },
];

/** Compact, horizontally-scrollable segmented control for the 4 themes. */
export function ThemeSwitcher(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <View className="bg-surface border-line w-full flex-row rounded-card border p-1">
      {OPTIONS.map((option) => {
        const isActive = option.value === theme;
        return (
          <Pressable
            key={option.value}
            onPress={() => void setTheme(option.value)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${option.label} theme`}
            className={cn(
              "flex-1 items-center justify-center rounded-card py-3.5",
              isActive ? "bg-foreground" : "bg-transparent",
            )}
          >
            <Text
              className={cn(
                "font-sans text-sm font-bold",
                isActive ? "text-background" : "text-muted",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
