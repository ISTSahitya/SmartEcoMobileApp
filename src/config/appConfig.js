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
