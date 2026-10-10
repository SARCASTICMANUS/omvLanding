import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirm for destructive actions.
 *
 * `Alert.alert` is a no-op on react-native-web — its implementation is literally
 * `class Alert { static alert() {} }` — so on web the dialog never appears and
 * the callback passed to the confirm button never runs. Anything behind an
 * Alert-based confirm (ending a journey, deleting a record) is therefore simply
 * inert in a browser, with no error to hint why.
 *
 * On native this is exactly `Alert.alert`. On web it uses `window.confirm`,
 * which the browser implements natively.
 *
 * @param {{title: string, message?: string, confirmLabel?: string,
 *          cancelLabel?: string}} options
 * @returns {Promise<boolean>} whether the user confirmed.
 */
/**
 * Informational dialog — "this worked" or "this failed", no choice to make.
 *
 * `confirmAction` covers the yes/no case; this covers the notice case, which is
 * the other half of what `Alert.alert` is used for across the app. On web it
 * uses `window.alert`, which is the browser's blocking notice dialog, so the
 * message is actually seen rather than silently dropped.
 *
 * @param {{title?: string, message?: string}} options
 * @returns {Promise<void>}
 */
export function notifyAction({ title = "", message = "" } = {}) {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.alert !== "function") {
      return Promise.resolve();
    }
    const body = title && message ? `${title}\n\n${message}` : title || message;
    window.alert(body);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [{ text: "OK", onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() }
    );
  });
}

export function confirmAction({
  title,
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
} = {}) {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return Promise.resolve(false);
    }
    const body = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(body));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      // Dismissed without choosing (Android back / tap outside) counts as cancel.
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export default confirmAction;