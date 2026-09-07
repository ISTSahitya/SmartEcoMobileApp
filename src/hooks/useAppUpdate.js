import { useState, useCallback, useRef } from 'react';
import DeviceInfo from 'react-native-device-info';
import { BackHandler, Linking, Platform } from 'react-native';

const STORE_URL =
  'https://play.google.com/store/apps/details?id=com.smartecoenterprise.app';

const compareVersions = (currentVersion, latestVersion) => {
  const currentParts = String(currentVersion).split('.').map(Number);
  const latestParts = String(latestVersion).split('.').map(Number);
  const length = Math.max(currentParts.length, latestParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] || 0;
    const latestPart = latestParts[index] || 0;
    if (currentPart < latestPart) return -1;
    if (currentPart > latestPart) return 1;
  }

  return 0;
};

const useAppUpdate = () => {
  const [showAppUpdateModal, setShowAppUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const updateInfoRef = useRef(null);

  const setAppUpdate = useCallback(update => {
    updateInfoRef.current = update;
    setUpdateInfo(update);
  }, []);

  const checkForUpdate = useCallback(versionData => {
    console.log('[App Update] Starting version check:', versionData);
    try {
      const currentVersion = DeviceInfo.getVersion();
      const latestVersion = String(
        versionData?.latestVersion ?? versionData?.version ?? '',
      ).trim();

      if (!latestVersion) {
        console.log('[App Update] No latest version received from web app');
        return null;
      }

      console.log('[App Update] Current version:', currentVersion);
      console.log('[App Update] Latest version:', latestVersion);

      if (compareVersions(currentVersion, latestVersion) >= 0) {
        setShowAppUpdateModal(false);
        return null;
      }

      const result = {
        updateAvailable: true,
        currentVersion,
        latestVersion,
        storeUrl: STORE_URL,
      };
      console.log('[App Update] Version check result:', result);
      if (!result) return null;
      setAppUpdate(result);
      setShowAppUpdateModal(true);
      return result;
    } catch (e) {
      console.log('[App Update] Version check failed:', e);
      return null;
    }
  }, [setAppUpdate]);

  const handleVersionData = useCallback(
    versionData => checkForUpdate(versionData),
    [checkForUpdate],
  );

  const dismissAppUpdate = useCallback(() => {
    setShowAppUpdateModal(false);
    if (Platform.OS !== 'android') return;
    BackHandler.exitApp();
  }, []);

  const openAppStore = useCallback(async () => {
    const payload = updateInfoRef.current || updateInfo;
    if (!payload?.storeUrl) {
      console.log('[App Update] No storeUrl available');
      return;
    }
    try {
      await Linking.openURL(payload.storeUrl);
    } catch (e) {
      console.log('[App Update] Could not open Google Play:', e);
    }
  }, [updateInfo]);

  return {
    updateInfo,
    showAppUpdateModal,
    handleVersionData,
    dismissAppUpdate,
    openAppStore,
  };
};

export default useAppUpdate;