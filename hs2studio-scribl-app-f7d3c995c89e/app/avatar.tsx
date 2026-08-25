import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawPad } from "@/components/canvas/DrawPad";
import { ScreenHeader } from "@/components/nav/ScreenHeader";
import { ScribbleBackdrop } from "@/components/theme/ScribbleBackdrop";
import { squareAvatarDataUri } from "@/src/lib/image";
import { goBack } from "@/src/lib/nav";
import { useAuthStore } from "@/src/stores/useAuthStore";

/**
 * Draw-your-own-avatar screen. Reuses the shared DrawPad canvas with a circle
 * guide showing what fits, exports the drawing, center-crops + downscales it to
 * a small square (squareAvatarDataUri), saves it to the user's profile
 * (avatarImage), and returns to Settings. The <Avatar> component then renders
 * it clipped to a circle everywhere avatars appear.
 */
export default function AvatarScreen(): React.JSX.Element {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [saving, setSaving] = useState(false);

  async function handleDone(imageDataUri: string): Promise<void> {
    setSaving(true);
    try {
      const avatarImage = await squareAvatarDataUri(imageDataUri, 256);
      const ok = await updateProfile({ avatarImage });
      if (ok) goBack("/settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScribbleBackdrop />
      <ScreenHeader onBack={() => goBack("/settings")} label="YOUR AVATAR" />
      <View className="w-full max-w-[760px] self-center flex-1">
        <DrawPad
          onDone={(imageDataUri) => void handleDone(imageDataUri)}
          busy={saving}
          busyLabel="Saving..."
          doneLabel="Save avatar"
          doneTestID="avatar-save"
          showCircleGuide
        />
      </View>
    </SafeAreaView>
  );
}
