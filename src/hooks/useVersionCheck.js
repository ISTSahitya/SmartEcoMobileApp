import { useState, useCallback, useRef } from 'react';
import { checkVersion, dismissSoftUpdate, skipVersion as skipVersionService, getCachedVersionData } from '../services/versionCheckService';
import APP_CONFIG from '../config/appConfig';

const useVersionCheck = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [updateType, setUpdateType] = useState('none');
  const [updateData, setUpdateData] = useState(null);
  const lastCheckTime = useRef(0);

  const handleVersionData = useCallback(async (versionData) => {
    // Debounce: skip if checked recently
    const now = Date.now();
    if (now - lastCheckTime.current < APP_CONFIG.FOREGROUND_CHECK_INTERVAL_MS) {
      return;
    }
    lastCheckTime.current = now;

    try {
      const data = versionData || await getCachedVersionData();
      if (!data) return;

      const result = await checkVersion(data);
      setUpdateType(result.type);
      setUpdateData(result.data);

      if (result.type !== 'none') {
        setModalVisible(true);
      }
    } catch (e) {
      console.log('Version check error:', e);
    }
  }, []);

  const dismiss = useCallback(async () => {
    await dismissSoftUpdate();
    setModalVisible(false);
    setUpdateType('none');
  }, []);

  const skipVersion = useCallback(async () => {
    if (updateData?.latestVersion) {
      await skipVersionService(updateData.latestVersion);
    }
    setModalVisible(false);
    setUpdateType('none');
  }, [updateData]);

  return {
    modalVisible,
    updateType,
    updateData,
    handleVersionData,
    dismiss,
    skipVersion,
  };
};

export default useVersionCheck;
