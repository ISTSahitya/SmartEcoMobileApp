import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import APP_CONFIG from '../config/appConfig';

/**
 * Compares two semver version strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
const compareVersions = (a, b) => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
};

/**
 * Determines the update type based on version data from the backend.
 *
 * @param {object} versionData - { latestVersion, minSupportedVersion, storeUrl, releaseNotes, isMaintenanceMode }
 * @returns {Promise<{ type: 'force' | 'soft' | 'maintenance' | 'none', data: object }>}
 */
export const checkVersion = async (versionData) => {
  const currentVersion = DeviceInfo.getVersion();

  // Cache the response for offline fallback
  try {
    await AsyncStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_CACHED_RESPONSE,
      JSON.stringify(versionData),
    );
  } catch (e) {
    // Caching is best-effort
  }

  // Maintenance mode check
  if (versionData.isMaintenanceMode) {
    return { type: 'maintenance', data: versionData };
  }

  // Force update: current version is below minimum supported
  if (compareVersions(currentVersion, versionData.minSupportedVersion) < 0) {
    return { type: 'force', data: versionData };
  }

  // Soft update: current version is below latest
  if (compareVersions(currentVersion, versionData.latestVersion) < 0) {
    // Check if user skipped this specific version
    const skippedVersion = await AsyncStorage.getItem(
      APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_SKIP_VERSION,
    );
    if (skippedVersion === versionData.latestVersion) {
      return { type: 'none', data: versionData };
    }
    // Clear stale skip if a newer version is available
    if (skippedVersion && skippedVersion !== versionData.latestVersion) {
      await AsyncStorage.removeItem(APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_SKIP_VERSION);
    }

    // Check if user dismissed within cooldown period
    const lastDismissed = await AsyncStorage.getItem(
      APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_LAST_DISMISSED,
    );
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10);
      if (elapsed < APP_CONFIG.SOFT_UPDATE_COOLDOWN_MS) {
        return { type: 'none', data: versionData };
      }
    }

    return { type: 'soft', data: versionData };
  }

  // Up to date
  return { type: 'none', data: versionData };
};

/**
 * Marks the soft update as dismissed (24h cooldown).
 */
export const dismissSoftUpdate = async () => {
  await AsyncStorage.setItem(
    APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_LAST_DISMISSED,
    Date.now().toString(),
  );
};

/**
 * Marks a specific version as skipped (won't prompt again for this version).
 */
export const skipVersion = async (version) => {
  await AsyncStorage.setItem(
    APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_SKIP_VERSION,
    version,
  );
};

/**
 * Gets cached version data for offline fallback.
 */
export const getCachedVersionData = async () => {
  try {
    const cached = await AsyncStorage.getItem(
      APP_CONFIG.STORAGE_KEYS.VERSION_CHECK_CACHED_RESPONSE,
    );
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
};

