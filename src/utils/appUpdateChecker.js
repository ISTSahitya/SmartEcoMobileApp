import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export const compareVersions = (currentVersion = '0.0.0', latestVersion = '0.0.0') => {
  const normalizeVersion = (version = '0.0.0') => {
    const sanitized = String(version).trim().replace(/^v/i, '');
    const parts = sanitized
      .split(/[.-]/)
      .filter(Boolean)
      .map((part) => Number.parseInt(part, 10) || 0);

    return parts.length > 0 ? parts : [0];
  };

  const currentParts = normalizeVersion(currentVersion);
  const latestParts = normalizeVersion(latestVersion);
  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentPart = currentParts[index] || 0;
    const latestPart = latestParts[index] || 0;

    if (currentPart < latestPart) {
      return true;
    }

    if (currentPart > latestPart) {
      return false;
    }
  }

  return false;
};

export const checkForAppUpdate = async () => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const currentVersion = DeviceInfo.getVersion();
    const bundleId = DeviceInfo.getBundleId();
    console.log('[App Update] Current version:', currentVersion);
    
    if (!currentVersion || !bundleId) {
        return null;
    }
    
    const response = await fetch(
        `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}`,
    );
    
    if (!response || !response.ok) {
        return null;
    }
    
    const payload = await response.json();
    const result = Array.isArray(payload?.results) ? payload.results[0] : null;

    if (!result?.version || !result?.trackViewUrl) {
        return null;
    }
    
    const latestVersion = result.version;
    console.log('[App Update] Latest version:', latestVersion);
    const updateAvailable = compareVersions(currentVersion, latestVersion);
    console.log('[App Update] Update available:', updateAvailable);
    
    return {
      updateAvailable,
      currentVersion,
      latestVersion,
      storeUrl: result.trackViewUrl,
    };
  } catch (error) {
    return null;
  }
};

export default checkForAppUpdate;
