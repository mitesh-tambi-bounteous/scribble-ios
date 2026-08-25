import { Alert, Platform } from "react-native";

/**
 * Cross-platform destructive-action confirm. react-native-web's Alert.alert
 * is a documented no-op (it never invokes any button's onPress), so a native
 * Alert.alert(...) confirm dialog silently never fires its action on web —
 * the button appears "non-functional" there even though the handler wiring
 * is correct. Route web through window.confirm instead; native/iOS/Android
 * keep the normal Alert.alert flow.
 */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`${title}\n\n${message}`)
        : false;
    return Promise.resolve(confirmed);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
