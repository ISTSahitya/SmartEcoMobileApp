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

const APP_CONFIG = {
  // AsyncStorage keys for version check
  STORAGE_KEYS: {
    VERSION_CHECK_LAST_DISMISSED: 'VERSION_CHECK_LAST_DISMISSED',
    VERSION_CHECK_SKIP_VERSION: 'VERSION_CHECK_SKIP_VERSION',
    VERSION_CHECK_CACHED_RESPONSE: 'VERSION_CHECK_CACHED_RESPONSE',
  },

  // Soft update cooldown: don't re-prompt within this duration (milliseconds)
  SOFT_UPDATE_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Minimum interval between version checks on app foreground (milliseconds)
  FOREGROUND_CHECK_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};

export default APP_CONFIG;
