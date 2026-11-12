/**
 * Base URL of the web app this WebView wraps.
 *
 * The ONE value that legitimately differs between the Android and iOS
 * branches (iOS points at atlas.smartgeoapps.com). Push payloads therefore
 * carry a PATH, never a full URL, and the native side prefixes this — so the
 * same notification works on both builds. Keep it here, not inlined in
 * WebViewScreen, so porting a feature across branches never drags the wrong
 * host with it.
 */
export const WEB_BASE_URL = 'https://app.smarteco.ai/SmartecoAvd';

/** Path prefix the web app is served under, stripped when normalising links. */
export const WEB_BASE_PATH = '/SmartecoAvd';

/** Hostname accepted by the App Link handler. */
export const WEB_HOST = 'app.smarteco.ai';

/* -------------------- app update -------------------- */

/** Returns the latest published app version and whether the update is soft or hard. */
export const APP_VERSION_API_URL =
  'https://app.smarteco.ai/SmartecoAvdapi/api/v1/app-versions/latest/android';

/** Opened by "Update Now" when the API response carries no storeUrl. */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.smartecoenterprise.app';

/**
 * Minimum gap between version API calls when the app returns to the
 * foreground. The launch check always runs; this only stops every quick app
 * switch from hitting the API.
 */
export const FOREGROUND_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** After "Later" on a soft update, don't prompt again for that version for this long. Hard updates ignore it. */
export const SOFT_UPDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/** AsyncStorage key holding { version, dismissedAt } for the last soft update dismissed. */
export const SOFT_UPDATE_DISMISSED_KEY = 'SOFT_UPDATE_DISMISSED';
