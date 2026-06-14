import { Alert, Platform } from 'react-native';

// react-native's Alert is a no-op on web, so anything surfaced through it
// silently disappears in the browser. This helper keeps the familiar
// Alert.alert(title, message, buttons) signature but falls back to the
// browser's native dialogs when running on web.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  // No buttons (or a single one) → a plain notice. Still fire the button's
  // onPress so callers relying on it keep working.
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Multiple buttons → a confirm dialog. Map "OK" to the first non-cancel
  // action and "Cancel" to the cancel-styled button.
  const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');

  if (window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
