/**
 * All Firebase Cloud Messaging contact lives here.
 *
 * Deliberately knows nothing about the WebView — it takes no refs, posts no
 * bridge messages, and returns plain data. Two reasons:
 *
 *  1. `WebViewScreen.js` is already 1000+ lines and is a near-total rewrite on
 *     the iOS branch (`smartecoavdIOS`). Anything living in that file has to be
 *     re-applied by hand over there; anything living in a new file like this one
 *     ports across as a straight copy.
 *  2. It keeps the FCM surface testable and greppable in one place.
 *
 * Pairs with `src/hooks/usePushNotifications.js`, which is what the screen
 * actually mounts.
 *
 * ── Modular API only ────────────────────────────────────────────────────────
 *
 * @react-native-firebase v23 REMOVED the namespaced API. The old
 * `import messaging from '...'; messaging().getToken()` shape is gone — the
 * package has no default export at all on v26, so that import yields
 * `undefined` and the app dies at startup with:
 *
 *     TypeError: 0, _messaging.default is not a function (it is undefined)
 *
 * Every call below is therefore the modular form: import the free function,
 * pass the messaging instance as the first argument.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import {
  deleteToken as fcmDeleteToken,
  getMessaging,
  getToken,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * Must match `fcm_default_channel_id` in the API settings AND the
 * `default_notification_channel_id` meta-data in AndroidManifest.xml. If these
 * three drift apart Android silently posts into an auto-created
 * "Miscellaneous" channel that the user cannot configure sensibly.
 */
export const ALERT_CHANNEL_ID = 'smarteco-alerts';

/**
 * The default-app messaging instance, created on first use.
 *
 * Lazy rather than a module-level `const`: this module is imported by the
 * screen, and resolving the instance at import time would run before the
 * native Firebase app is guaranteed to be initialised.
 */
let _messaging = null;
export function fcm() {
  if (!_messaging) _messaging = getMessaging();
  return _messaging;
}

/**
 * Create the notification channel the manifest names.
 *
 * Android 8+ refuses to show a notification whose channel does not exist, and
 * the manifest meta-data only NAMES a channel — it does not create one. No-op
 * on iOS, and idempotent, so it is safe to call on every app start.
 */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: ALERT_CHANNEL_ID,
      name: 'Air quality alerts',
      // HIGH is what produces a heads-up banner rather than a silent tray entry.
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
  } catch (e) {
    console.log('[Push] createChannel failed:', e?.message);
  }
}

/**
 * Ask for notification permission and return the FCM token.
 *
 * Returns `{ permission, token }` where permission is one of
 * 'granted' | 'denied' | 'blocked'. `blocked` is reported separately from
 * `denied` because it is the state Android will not re-prompt for — the UI has
 * to send the user to the OS settings page instead of asking again.
 */
export async function requestPermissionAndToken() {
  let permission = 'granted';

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    // Android 13 made notifications a runtime permission. Below 33 it is
    // granted at install time and there is nothing to ask for.
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    permission =
      result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
  } else if (Platform.OS === 'ios') {
    // notifee rather than RNFirebase's requestPermission(), which v26 marks
    // deprecated. Same underlying UNUserNotificationCenter prompt, and it keeps
    // permission handling in one library across both platforms.
    const settings = await notifee.requestPermission();
    // AUTHORIZED and PROVISIONAL both deliver; DENIED does not.
    permission =
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
        ? 'granted'
        : 'denied';
  }

  if (permission !== 'granted') {
    return { permission, token: null };
  }

  // Required on iOS before getToken(); a no-op on Android.
  await registerDeviceForRemoteMessages(fcm());
  const token = await getToken(fcm());
  return { permission, token };
}

/** Current permission state without prompting — for the settings UI. */
export async function getPermissionStatus() {
  try {
    const settings = await notifee.getNotificationSettings();
    // notifee: 0 = DENIED, 1 = AUTHORIZED, 2 = PROVISIONAL
    const granted = settings.authorizationStatus >= 1;
    return { granted, permission: granted ? 'granted' : 'blocked' };
  } catch (e) {
    console.log('[Push] getNotificationSettings failed:', e?.message);
    return { granted: false, permission: 'denied' };
  }
}

/** Open the OS notification settings for this app. */
export async function openNotificationSettings() {
  try {
    await notifee.openNotificationSettings();
  } catch (e) {
    console.log('[Push] openNotificationSettings failed:', e?.message);
  }
}

/**
 * Drop this device's FCM token.
 *
 * Called on logout so the next person to sign in on this handset gets a freshly
 * minted token rather than inheriting this one. The server also reassigns on
 * re-registration, so this is belt and braces.
 */
export async function deleteToken() {
  try {
    await fcmDeleteToken(fcm());
  } catch (e) {
    console.log('[Push] deleteToken failed:', e?.message);
  }
}

/** Platform metadata sent alongside the token, so the API can label devices. */
export function deviceMeta() {
  return {
    platform: Platform.OS, // 'android' | 'ios' — matches the API's CHECK constraint
    appVersion: DeviceInfo.getVersion(),
    deviceModel: DeviceInfo.getModel(),
  };
}

/**
 * Draw a banner for a message that arrived while the app was foregrounded.
 *
 * FCM deliberately displays nothing in the foreground — the message handler
 * fires and that is all. Without this, a push landing while someone is looking
 * at the app is completely invisible.
 */
export async function displayForeground(remoteMessage) {
  const notification = remoteMessage?.notification;
  if (!notification) return;
  try {
    await notifee.displayNotification({
      title: notification.title,
      body: notification.body,
      data: remoteMessage.data || {},
      android: {
        channelId: ALERT_CHANNEL_ID,
        smallIcon: 'ic_notification',
        // Without a pressAction the banner is not tappable at all.
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
        // notifee already defaults to heads-up in the foreground, but iOS
        // shows NOTHING for a foreground notification unless the presentation
        // options say otherwise, so state them rather than rely on the default.
        foregroundPresentationOptions: { alert: true, badge: true, sound: true },
      },
    });
  } catch (e) {
    console.log('[Push] displayNotification failed:', e?.message);
  }
}
