import { Highlighter, Pencil } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { BrushStyle } from "@/components/canvas/DrawingCanvas";

/** A little glyph that previews what each stylized brush draws. */
export function StyleGlyph({
  style,
  active,
}: {
  style: BrushStyle;
  active: boolean;
}): React.JSX.Element {
  const on = active ? "bg-background" : "bg-foreground";
  const iconColor = active ? "text-background" : "text-foreground";
  if (style === "basic") {
    return <Icon as={Pencil} className={iconColor} size={16} />;
  }
  if (style === "fork") {
    return (
      <View className="flex-row items-end gap-[2px]">
        {[0, 1, 2].map((i) => (
          <View key={i} className={`h-4 w-[2.5px] rounded-full ${on}`} />
        ))}
      </View>
    );
  }
  if (style === "dotted") {
    return (
      <View className="flex-row items-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <View key={i} className={`h-1.5 w-1.5 rounded-full ${on}`} />
        ))}
      </View>
    );
  }
  // neon: highlighter/marker glyph
  return <Icon as={Highlighter} className={iconColor} size={16} />;
}
