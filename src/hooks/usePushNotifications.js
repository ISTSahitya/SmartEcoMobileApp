/**
 * Wires FCM into the screen with the smallest possible footprint in
 * `WebViewScreen.js` — which matters because that file is rewritten on the iOS
 * branch and every line added to it there has to be re-applied by hand.
 *
 * The screen supplies two callbacks and gets three handlers back:
 *
 *   onDeepLink(path)        — a notification was tapped; navigate the WebView
 *   onTokenRefresh(info)    — FCM rotated the token; forward it to the web app
 *
 * Everything else (permissions, channel, foreground banner, cold/warm start)
 * is handled here.
 */

import { useCallback, useEffect, useRef } from 'react';
import notifee, { EventType } from '@notifee/react-native';
// Modular API — @react-native-firebase v23 removed the namespaced `messaging()`
// default export. See the note at the top of ../services/pushNotifications.
import {
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
} from '@react-native-firebase/messaging';

import {
  deleteToken,
  deviceMeta,
  displayForeground,
  ensureChannel,
  fcm,
  getPermissionStatus,
  openNotificationSettings,
  requestPermissionAndToken,
} from '../services/pushNotifications';

/** Pull the target path out of a message's data payload, if there is one. */
function pathFromMessage(message) {
  const path = message?.data?.deep_link_path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}

export default function usePushNotifications({ onDeepLink, onTokenRefresh }) {
  // Held in refs so the effect below can stay mounted for the app's lifetime
  // rather than tearing down and re-subscribing every time the screen
  // re-renders with a new closure.
  const deepLinkRef = useRef(onDeepLink);
  const tokenRefreshRef = useRef(onTokenRefresh);
  deepLinkRef.current = onDeepLink;
  tokenRefreshRef.current = onTokenRefresh;

  useEffect(() => {
    ensureChannel();

    const messaging = fcm();

    // ── Foreground ──────────────────────────────────────────────────────
    // FCM shows nothing here; notifee draws the banner.
    const unsubMessage = onMessage(messaging, async remoteMessage => {
      await displayForeground(remoteMessage);
    });

    // ── Warm start ──────────────────────────────────────────────────────
    // App was backgrounded and the user tapped the OS tray item.
    const unsubOpened = onNotificationOpenedApp(messaging, remoteMessage => {
      const path = pathFromMessage(remoteMessage);
      if (path) deepLinkRef.current?.(path);
    });

    // ── Cold start ──────────────────────────────────────────────────────
    // App was killed. Resolves with the message that launched it, or null.
    // The screen holds the path until the WebView is actually ready — see the
    // pendingDeepLink guard there.
    getInitialNotification(messaging)
      .then(remoteMessage => {
        const path = pathFromMessage(remoteMessage);
        if (path) deepLinkRef.current?.(path);
      })
      .catch(e => console.log('[Push] getInitialNotification failed:', e?.message));

    // ── Tap on a banner we drew ourselves ───────────────────────────────
    // These do NOT go through onNotificationOpenedApp — that only covers FCM's
    // own tray items. Forgetting this is why a foreground banner tap appears to
    // do nothing.
    const unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      const path = pathFromMessage(detail?.notification);
      if (path) deepLinkRef.current?.(path);
    });

    // ── Token rotation ──────────────────────────────────────────────────
    // FCM mints a new token on reinstall, restore and clear-data.
    const unsubRefresh = onTokenRefresh(messaging, token => {
      tokenRefreshRef.current?.({ token, ...deviceMeta() });
    });

    return () => {
      unsubMessage();
      unsubOpened();
      unsubNotifee();
      unsubRefresh();
    };
  }, []);

  /** Web asked to register: prompt if needed, then hand back the token. */
  const register = useCallback(async () => {
    try {
      const { permission, token } = await requestPermissionAndToken();
      return {
        action: 'PUSH_REGISTER_RESULT',
        success: !!token,
        token,
        permission,
        ...deviceMeta(),
      };
    } catch (e) {
      return {
        action: 'PUSH_REGISTER_RESULT',
        success: false,
        permission: 'denied',
        error: e?.message || 'Push registration failed',
        ...deviceMeta(),
      };
    }
  }, []);

  /** Web asked to deregister (logout). */
  const unregister = useCallback(async () => {
    await deleteToken();
    return { action: 'PUSH_UNREGISTER_RESULT', success: true };
  }, []);

  /** Web asked for the current OS permission state, without prompting. */
  const permissionStatus = useCallback(async () => {
    const status = await getPermissionStatus();
    return { action: 'PUSH_PERMISSION_STATUS_RESULT', ...status };
  }, []);

  return { register, unregister, permissionStatus, openNotificationSettings };
}
