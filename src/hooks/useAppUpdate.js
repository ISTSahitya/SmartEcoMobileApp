import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import checkForAppUpdate from '../utils/appUpdateChecker';

const useAppUpdate = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showAppUpdateModal, setShowAppUpdateModal] = useState(false);

  const updateInfoRef = useRef(null);

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      return null;
    }

    try {
      const appUpdate = await checkForAppUpdate();

      console.log('[App Update] Update info:', appUpdate);

      if (!appUpdate?.updateAvailable) {
        updateInfoRef.current = null;
        setUpdateInfo(null);
        setShowAppUpdateModal(false);

        return null;
      }

      updateInfoRef.current = appUpdate;
      setUpdateInfo(appUpdate);
      setShowAppUpdateModal(true);

      return appUpdate;
    } catch (error) {
      console.log('[App Update] checkForUpdate failed:', error);

      updateInfoRef.current = null;
      setUpdateInfo(null);
      setShowAppUpdateModal(false);

      return null;
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  const dismissAppUpdate = useCallback(() => {
    console.log('[App Update] Dismissing update modal');

    setShowAppUpdateModal(false);
  }, []);

  const openAppStore = useCallback(async () => {
    // IMPORTANT:
    // Always get the latest value from the ref.
    const payload = updateInfoRef.current;

    console.log('[App Update] Opening App Store');
    console.log('[App Update] Payload:', payload);
    console.log('[App Update] Store URL:', payload?.storeUrl);

    if (!payload?.storeUrl) {
      console.log('[App Update] No storeUrl available');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(payload.storeUrl);

      console.log(
        '[App Update] Can open App Store URL:',
        supported
      );

      if (supported) {
        await Linking.openURL(payload.storeUrl);
      } else {
        console.log(
          '[App Update] Cannot open App Store URL'
        );
      }
    } catch (error) {
      console.log(
        '[App Update] Failed to open App Store:',
        error
      );
    }
  }, []);

  return {
    updateInfo,
    showAppUpdateModal,
    dismissAppUpdate,
    openAppStore,
    checkForUpdate,
  };
};

export default useAppUpdate;