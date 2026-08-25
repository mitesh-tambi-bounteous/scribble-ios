import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";

export interface ScreenHeaderProps {
  onBack?: () => void;
  label: string;
  right?: React.ReactNode;
}

/**
 * Shared top bar: circular back button (left), uppercase muted label
 * (center), and an optional right-side node (or a spacer to keep the
 * label visually centered).
 */
export function ScreenHeader({ onBack, label, right }: ScreenHeaderProps): React.JSX.Element {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-[38px] w-[38px] items-center justify-center rounded-full bg-surface border-line border"
        >
          <Icon as={ChevronLeft} className="text-foreground" size={20} />
        </Pressable>
      ) : (
        <View className="h-[38px] w-[38px]" />
      )}

      <Text className="text-muted font-sans text-xs font-extrabold uppercase tracking-widest">
        {label}
      </Text>

      {right ?? <View className="h-[38px] w-[38px]" />}
    </View>
  );
}
