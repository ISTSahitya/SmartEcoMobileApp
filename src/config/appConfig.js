/**
 * Base URL of the web app this WebView wraps.
 *
 * This branch serves the same host and basePath as SmartecoavdBlueAndroid, so
 * the value is identical there — but it stays here rather than inlined in
 * WebViewScreen so a branch that ever does point somewhere else only has to
 * change one line. Push payloads carry a PATH, never a full URL, and the
 * native side prefixes this, so one notification works on both builds.
 */
export const WEB_BASE_URL = 'https://app.smarteco.ai/SmartecoAvd';

/** Path prefix the web app is served under, stripped when normalising links. */
export const WEB_BASE_PATH = '/SmartecoAvd';

/** Hostname accepted by the Universal Link handler. */
export const WEB_HOST = 'app.smarteco.ai';

/** Shared dashboard URL prefix — opened in the external browser, not the WebView. */
export const SHARED_DASHBOARD_URL = 'https://kiosk.smarteco.ai/SmartecoAvd/shared/';

/** Developer documentation URL prefix — opened in the external browser, not the WebView. */
export const DEVELOPER_DOCS_URL = 'https://dev.smarteco.ai/SmartecoAvd/developers';

/* -------------------- app update -------------------- */

/** Returns the latest published app version and whether the update is soft or hard. */
export const APP_VERSION_API_URL =
  'https://app.smarteco.ai/SmartecoAvdapi/api/v1/app-versions/latest/ios';

/** Opened by "Update Now" when the API response carries no storeUrl. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6787081703';

/**
 * Minimum gap between version API calls when the app returns to the
 * foreground. The launch check always runs; this only stops every quick app
 * switch from hitting the API.
 */
export const FOREGROUND_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** After "Later" on a soft update, don't prompt again for that version for this long. Hard updates ignore it. */
export const SOFT_UPDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/** AsyncStorage key holding { version, updateType, dismissedAt } for the last soft update dismissed. */
export const SOFT_UPDATE_DISMISSED_KEY = 'SOFT_UPDATE_DISMISSED';
