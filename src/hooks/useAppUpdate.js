import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { AppState, BackHandler, Linking, Platform } from 'react-native';
import {
  APP_VERSION_API_URL,
  PLAY_STORE_URL,
  FOREGROUND_CHECK_INTERVAL_MS,
  SOFT_UPDATE_COOLDOWN_MS,
  SOFT_UPDATE_DISMISSED_KEY,
} from '../config/appConfig';

/** True while the user's "Later" on this exact version and update type is still within the cooldown. */
const isSoftUpdateCoolingDown = async (latestVersion, latestUpdateType) => {
  try {
    const stored = await AsyncStorage.getItem(SOFT_UPDATE_DISMISSED_KEY);
    if (!stored) return false;
    const { version, updateType, dismissedAt } = JSON.parse(stored);
    return (
      version === latestVersion &&
      updateType === latestUpdateType &&
      Date.now() - dismissedAt < SOFT_UPDATE_COOLDOWN_MS
    );
  } catch (e) {
    return false;
  }
};

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

/** API sends update_type 'hard' | 'soft'; anything other than 'hard' is treated as soft. */
const normalizeUpdateType = value =>
  String(value ?? '').trim().toLowerCase() === 'hard' ? 'hard' : 'soft';

const useAppUpdate = () => {
  const [showAppUpdateModal, setShowAppUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const lastCheckTime = useRef(0);

  const checkForUpdate = useCallback(async () => {
    lastCheckTime.current = Date.now();
    try {
      const response = await fetch(APP_VERSION_API_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        console.log('[App Update] Version API failed:', response.status);
        return;
      }

      const json = await response.json();
      const versionData = json?.data ?? json;
      console.log('[App Update] Version API response:', versionData);

      const currentVersion = DeviceInfo.getVersion();
      const latestVersion = String(
        versionData?.latestVersion ?? versionData?.version ?? '',
      ).trim();

      if (!latestVersion) {
        console.log('[App Update] No latest version in API response');
        return;
      }

      if (compareVersions(currentVersion, latestVersion) >= 0) {
        setShowAppUpdateModal(false);
        return;
      }

      const updateType = normalizeUpdateType(versionData?.update_type);
      if (updateType === 'soft' && (await isSoftUpdateCoolingDown(latestVersion, updateType))) {
        console.log('[App Update] Soft update in cooldown, not prompting');
        return;
      }

      setUpdateInfo({
        currentVersion,
        latestVersion,
        updateType,
        storeUrl: versionData?.storeUrl || PLAY_STORE_URL,
      });
      setShowAppUpdateModal(true);
    } catch (e) {
      console.log('[App Update] Version check failed:', e);
    }
  }, []);

  // Check on launch, then again whenever the app returns to the foreground.
  useEffect(() => {
    checkForUpdate();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        nextAppState === 'active' &&
        Date.now() - lastCheckTime.current >= FOREGROUND_CHECK_INTERVAL_MS
      ) {
        checkForUpdate();
      }
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  /** "Later" on a soft update. */
  const dismissAppUpdate = useCallback(() => {
    setShowAppUpdateModal(false);
    if (!updateInfo?.latestVersion) return;
    AsyncStorage.setItem(
      SOFT_UPDATE_DISMISSED_KEY,
      JSON.stringify({
        version: updateInfo.latestVersion,
        updateType: updateInfo.updateType,
        dismissedAt: Date.now(),
      }),
    ).catch(e => console.log('[App Update] Could not save dismissal:', e));
  }, [updateInfo]);

  /** Back button on a hard update: the app is unusable, so leave it. */
  const exitApp = useCallback(() => {
    if (Platform.OS === 'android') BackHandler.exitApp();
  }, []);

  const openAppStore = useCallback(async () => {
    if (!updateInfo?.storeUrl) {
      console.log('[App Update] No storeUrl available');
      return;
    }
    try {
      await Linking.openURL(updateInfo.storeUrl);
    } catch (e) {
      console.log('[App Update] Could not open Google Play:', e);
    }
  }, [updateInfo]);

  return {
    updateInfo,
    showAppUpdateModal,
    dismissAppUpdate,
    exitApp,
    openAppStore,
  };
};

export default useAppUpdate;
