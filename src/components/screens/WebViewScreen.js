import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PermissionsAndroid,
  BackHandler,
  Alert,
  Linking,
  Platform,
  StatusBar,
  View,
  Text,
  NativeModules,
  AppState,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WifiManager from 'react-native-wifi-reborn';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import RNPrint from 'react-native-print';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import NetInfo from "@react-native-community/netinfo";
import useVersionCheck from '../../hooks/useVersionCheck';
import UpdateModal from '../UpdateModal';
//import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const DEVICE_CONFIG_URL = 'http://192.168.4.1/wifi';
const DEVICE_CONFIG_TIMEOUT_MS = 45000;
const WEB_APP_URL = 'https://atlas.smartgeoapps.com/smartecodev/';
// const WEB_APP_URL = 'https://app.smarteco.ai/smartecoiaq/';
const { DeviceConfigModule, WifiConnectModule } = NativeModules;

const injectedAutoZoomFix = `
  (function () {
    var style = document.createElement('style');
    style.textContent = 'input, select, textarea { font-size: max(16px, 1em) !important; }';
    document.head.appendChild(style);
    true;
  })();
`;

const logDeviceSetup = (step, details = {}) => {
  console.log('[DeviceSetup]', step, details);
};

const normalizeSsid = ssid => (
  typeof ssid === 'string' ? ssid.trim().replace(/^"+|"+$/g, '') : ''
);

const isDeviceWifiSsid = ssid => {
  const normalizedSsid = normalizeSsid(ssid).toLowerCase();
  return normalizedSsid.startsWith('iaq_') || normalizedSsid.startsWith('iam_');
};

const extractDeviceIdFromDeviceSsid = ssid => {
  const normalizedSsid = normalizeSsid(ssid);
  const separatorIndex = normalizedSsid.indexOf('_');
  return separatorIndex >= 0 ? normalizedSsid.slice(separatorIndex + 1) : '';
};

// The device may broadcast either the bare "IAQ_" network or the
// serial-suffixed "IAQ_{serialNumber}" network. Whichever one is requested
// first, return the other variant so it can be tried as a fallback.
const getFallbackIaqSsid = (ssid, serialNumber) => {
  if (!serialNumber) return null;

  const normalizedSsid = normalizeSsid(ssid).toLowerCase();
  const serialSuffixedSsid = `IAQ_${serialNumber}`;

  if (normalizedSsid === 'iaq_') {
    return serialSuffixedSsid;
  }
  if (normalizedSsid === normalizeSsid(serialSuffixedSsid).toLowerCase()) {
    return 'IAQ_';
  }
  return null;
};
const ONBOARDING_BASE_URI = `file://${DeviceConfigModule?.bundlePath ?? ''}/onboarding/index.html`;

const WebViewScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState([]);
  const [currentUrl, setCurrentUrl] = useState(null);
  const pendingIosDeviceConfigRef = useRef(null);
  const pendingIosWifiCheckRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const checkWifiConnectionRef = useRef(null);
  const provisionAttemptRef = useRef(0);
  const pendingOAuthMessageRef = useRef(null);

  const logProvisionStep = (step, details = {}) => {
    logDeviceSetup(step, {
      attempt: provisionAttemptRef.current,
      ...details,
    });
  };

  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const {
    modalVisible,
    updateType,
    updateData,
    handleVersionData,
    dismiss,
    skipVersion,
  } = useVersionCheck();
  const lastVersionData = useRef(null);

  const splashOnly = route.params?.splashOnly ?? false;

  const splashSource = {
    uri: splashOnly ? `${ONBOARDING_BASE_URI}?splashOnly=true` : ONBOARDING_BASE_URI,
  };

  // When the HTML splash sends ONBOARDING_DONE, fade it out
  const handleSplashMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ONBOARDING_DONE') {
        if (!splashOnly) {
          await AsyncStorage.setItem('ONBOARDING_DONE', 'true');
        }
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setShowSplash(false));
      }
    } catch (_) {}
  }, [splashOnly, splashOpacity]);

  // Re-check version when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && lastVersionData.current) {
        handleVersionData(lastVersionData.current);
      }
    });
    return () => subscription.remove();
  }, [handleVersionData]);

  const ensureProvisionAttempt = reason => {
    if (!provisionAttemptRef.current) {
      provisionAttemptRef.current = Date.now();
      logProvisionStep('provision_attempt_started', { reason });
    }
    return provisionAttemptRef.current;
  };

  /* deeplink setup for oauth login */
  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      try {
        console.log('Deep link received:', url);

        const parsedUrl = new URL(url);
        const token = parsedUrl.searchParams.get('token');
        const error = parsedUrl.searchParams.get('error');
        const state = parsedUrl.searchParams.get('state');
        const code = parsedUrl.searchParams.get('code');

        if (error) {
          sendToWeb({ type: 'OAUTH_ERROR', error });
          return;
        }

        if (token || code) {
          sendToWeb({
            type: 'OAUTH_SUCCESS',
            access_token: token || undefined,
            code: code || undefined,
            state: state || undefined,
          });
        }
      } catch (e) {
        console.log('Deep link parse error:', e);
        sendToWeb({ type: 'OAUTH_ERROR', error: 'Internal server error' });
      }
    };
    const urlSubscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      urlSubscription.remove();
    };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (history.length > 1) {
          const prevUrl = history[history.length - 2];
          // first goBack()
          webviewRef.current.goBack();

          // 🔥 check after slight delay if URL is same
          setTimeout(() => {
            if (currentUrl === prevUrl) {
              // If same URL → still same page → goBack() again
              webviewRef.current.goBack();
            }
          }, 200);

          return true;
        }
        return false; // allow app exit
      },
    );

    return () => backHandler.remove();
  }, [canGoBack]);

  const webviewRef = useRef(null);
  const checkAndAskLocation = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    // 1. Request location permission
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(
        'Permission Required',
        'Please allow Location Permission to scan WiFi networks.',
        [{ text: 'OK' }],
      );
      return false;
    }

    // 2. Ask user to enable location using system popup
    try {
      await LocationServicesDialogBox.checkLocationServicesIsEnabled({
        message:
          '<h3>Turn On Location</h3>WiFi scanning requires Location to be enabled.',
        ok: 'Turn On',
        cancel: 'Cancel',
        enableHighAccuracy: false,
        showDialog: true,
        openLocationServices: true,
      });
      return true; // Location enabled now
    } catch (error) {
      // User pressed cancel
      Alert.alert(
        'Enable Location',
        'Location is required to scan WiFi.\nOpen settings?',
        `${error}`,
        [
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return false;
    }
  };

  // iOS forbids listing nearby Wi-Fi networks (no public API), so we only
  // return the currently connected SSID on iOS.
  const requestWifiScan = async () => {
    try {
      if (Platform.OS === 'ios') {
        let currentSSID = null;
        try {
          currentSSID = await WifiManager.getCurrentWifiSSID();
        } catch (_) {}
        sendToWeb({
          action: 'WIFI_SCAN_RESULT',
          success: false,
          platform: 'ios',
          networks: currentSSID
            ? [{ SSID: currentSSID, BSSID: '', encrypted: false, level: 0 }]
            : [],
          error: 'iOS does not allow scanning nearby Wi-Fi networks. Please switch networks from Settings.',
        });
        return;
      }

      const ready = await checkAndAskLocation();
      if (!ready) {
        sendToWeb({
          action: 'WIFI_SCAN_RESULT',
          success: false,
          platform: 'android',
          networks: [],
          error: 'Location permission/services required to scan Wi-Fi.',
        });
        return;
      }

      const raw = await WifiManager.loadWifiList();
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : [];

      const seen = new Set();
      console.log(list);
      const networks = list
        .filter((n) => n && n.SSID && !seen.has(n.SSID) && seen.add(n.SSID))
        .map((n) => ({
          SSID: n.SSID,
          BSSID: n.BSSID || '',
          encrypted: typeof n.capabilities === 'string'
            ? /WPA|WEP|PSK|EAP/i.test(n.capabilities)
            : false,
          level: typeof n.level === 'number' ? n.level : -100,
          timestamp: n.timestamp,
          frequency: n.frequency
        }));

        console.log(networks);

      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        success: true,
        platform: 'android',
        networks,
      });
    } catch (e) {
      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        success: false,
        platform: Platform.OS,
        networks: [],
        error: e instanceof Error ? e.message : 'Wi-Fi scan failed. Please try again.',
      });
    }
  };

  const onWebMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (
        message.action === 'OPEN_WIFI_SETTINGS' ||
        message.action === 'OPEN_WIFI_SETTINGS_FOR_NO_INTERNET' ||
        message.action === 'SEND_WIFI_CREDENTIALS' ||
        message.action === 'SEND_WIFI_DETAILS_TO_DEVICE' ||
        message.action === 'SCAN_WIFI' ||
        message.action === 'GET_SYSTEM_STATUS' ||
        message.action === 'CONNECT_WIFI' ||
        message.action === 'RELEASE_WIFI_BINDING'
      ) {
        logProvisionStep('web_message_received', {
          action: message.action,
          hasPayload: Boolean(message.payload || message.config || message.wifiConfig),
          ssid: message.payload?.ssid || message.ssid,
          deviceid: message.payload?.deviceid || message.deviceid,
        });
      }

      switch (message.action) {
        case 'SCAN_WIFI':
          requestWifiScan();
          break;

        case 'GET_CONNECTED_WIFI':
          getConnectedWifiDetails();
          break;

        case 'GET_SYSTEM_STATUS':
          const interval = setInterval(async () => {
            const systemStatus = await getSystemStatus();
            if (systemStatus.success && systemStatus.locationPermission && !systemStatus.mobileData)
            {
              clearInterval(interval);
            }
          }, 3000);
          break;

        case 'CONNECT_WIFI':
          if (message.ssid) {
            const { ssid, password, serialNumber} = message;

            connectToWifi(ssid, password, serialNumber);
          } else {
            sendToWeb({
              action: 'WIFI_CONNECT_RESULT',
              success: false,
              error: 'SSID and password required',
            });
          }
          break;

        case 'OPEN_APP_SETTINGS':
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
          break;

        case 'OPEN_WIFI_SETTINGS':
          provisionAttemptRef.current = Date.now();
          logProvisionStep('provision_attempt_started', {
            reason: 'OPEN_WIFI_SETTINGS',
            platform: Platform.OS,
          });
          if (Platform.OS === 'ios') {
            const pendingPayload = message.payload || message.config || message.wifiConfig || (
              message.ssid && message.password ? message : null
            );
            if (pendingPayload?.ssid && pendingPayload?.password) {
              pendingIosDeviceConfigRef.current = pendingPayload;
              logProvisionStep('ios_stored_payload_before_wifi_settings', {
                ssid: pendingPayload.ssid,
                deviceid: pendingPayload.deviceid,
                offsetsCount: Array.isArray(pendingPayload.offsets) ? pendingPayload.offsets.length : undefined,
              });
            }
            pendingIosWifiCheckRef.current = true;
          }

          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIFI_SETTINGS');

            setTimeout(() => {
              checkWifiConnection();
            }, 6000);
          } else {
            Alert.alert('Enable Wi-Fi', 'Please enable Wi-Fi from Settings', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  logProvisionStep('ios_open_wifi_settings_requested');
                  Linking.openURL('App-Prefs:WIFI').catch(() => {
                    logProvisionStep('ios_open_wifi_settings_fallback_to_app_settings');
                    Linking.openSettings();
                  });
                },
              },
            ]);
          }

          break;

        case 'OPEN_WIFI_SETTINGS_FOR_NO_INTERNET':
          ensureProvisionAttempt('OPEN_WIFI_SETTINGS_FOR_NO_INTERNET');
          logProvisionStep('open_wifi_settings_for_no_internet', { platform: Platform.OS });
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(error => {
              logProvisionStep('android_open_wifi_settings_failed', { error: error?.toString?.() });
            });
          } else {
            Linking.openURL('App-Prefs:WIFI').catch(error => {
              logProvisionStep('ios_open_wifi_settings_for_no_internet_failed', { error: error?.toString?.() });
              Linking.openSettings();
            });
          }
          break;

        case 'GET_IS_IOS':
          let isIOS = false;
          if (Platform.OS === 'ios') {
            isIOS = true;
          }
          sendToWeb({
            action: 'IS_IOS',
            isIOS,
          });

          break;

        case 'SEND_WIFI_CREDENTIALS':
          ensureProvisionAttempt('SEND_WIFI_CREDENTIALS');
          sendWifiCredentials(message.payload);
          break;

        case 'SEND_WIFI_DETAILS_TO_DEVICE':
          ensureProvisionAttempt('SEND_WIFI_DETAILS_TO_DEVICE');
          sendWifiCredentials(message.payload || message);
          break;

        case 'DOWNLOAD_FILE': {
          const filePayload = message.payload || message;
          handleDownloadFile({
            fileName: filePayload.fileName,
            mimeType: filePayload.mimeType,
            data: filePayload.data,
          });
          break;
        }

        case 'PRINT_FILE': {
          const printPayload = message.payload || message;
          handlePrintFile({
            fileName: printPayload.fileName,
            mimeType: printPayload.mimeType,
            data: printPayload.data,
          });
          break;
        }

        case 'SHARE': {
          const sharePayload = message.payload || message;
          handleShare({
            url: sharePayload.url,
            title: sharePayload.title,
            text: sharePayload.text,
            fileName: sharePayload.fileName,
            mimeType: sharePayload.mimeType,
            data: sharePayload.data,
          });
          break;
        }

        case 'WEB_NETWORK_LOG':
          logProvisionStep('web_network_log', message.data || {});
          break;

        case 'RELEASE_WIFI_BINDING': {
          const { ssid, password } = message;
          releaseWifiBinding({ ssid, password });
          break;
        }

        case 'DOWNLOAD_FILE': {
          // Web sends either a flat message or one nested under `payload`.
          const filePayload = message.payload || message;
          handleDownloadFile({
            fileName: filePayload.fileName,
            mimeType: filePayload.mimeType,
            data: filePayload.data,
          });
          break;
        }

        case 'PRINT_FILE': {
          const printPayload = message.payload || message;
          handlePrintFile({
            fileName: printPayload.fileName,
            mimeType: printPayload.mimeType,
            data: printPayload.data,
          });
          break;
        }

        case 'SHARE': {
          const sharePayload = message.payload || message;
          handleShare({
            url: sharePayload.url,
            title: sharePayload.title,
            text: sharePayload.text,
            fileName: sharePayload.fileName,
            mimeType: sharePayload.mimeType,
            data: sharePayload.data,
          });
          break;
        }

        default:
          console.log('Unknown action:', message.action);
      }
    } catch (err) {
      console.log('Bad message from web:', err);
    }
  };

  const checkWifiConnection = async () => {
    const connectedSSID = (await getCurrentWifiInfo()).ssid;
    const normalizedSSID = normalizeSsid(connectedSSID);
    const androidDeviceWifi = connectedSSID != null && (
      connectedSSID.startsWith("IAQ_") ||
      connectedSSID.startsWith("iaq_") ||
      connectedSSID.startsWith("Iaq_")
    );
    const iosDeviceWifi = isDeviceWifiSsid(connectedSSID);
    const isDeviceWifi = Platform.OS === 'android' ? androidDeviceWifi : iosDeviceWifi;
    logProvisionStep('check_wifi_connection', {
      platform: Platform.OS,
      ssid: connectedSSID,
      normalizedSSID,
      hasPendingIosPayload: Boolean(pendingIosDeviceConfigRef.current),
      isDeviceWifi,
    });

    if (isDeviceWifi || (Platform.OS === 'ios' && !normalizedSSID && pendingIosDeviceConfigRef.current)) {
      sendToWeb({
        action: 'DEVICE_WIFI_CONNECTED',
        currentWifi: {
          ssid: normalizedSSID || connectedSSID || "Unknown"
        },
        success: true
      })

      if (Platform.OS === 'ios' && pendingIosDeviceConfigRef.current) {
        const payload = pendingIosDeviceConfigRef.current;
        pendingIosDeviceConfigRef.current = null;
        logProvisionStep('ios_auto_send_after_device_wifi_connected', {
          ssid: payload.ssid,
          deviceid: payload.deviceid,
        });
        await sendWifiCredentials(payload);
      }
    } else {
      sendToWeb({
        action: 'DEVICE_WIFI_CONNECTED',
        currentWifi: {
          ssid: 'No wifi connected',
        },
        success: false,
        error: 'Connection failed. Please try again...',
      });
    }
  };
  checkWifiConnectionRef.current = checkWifiConnection;

  const sendToWeb = data => {
    const isOAuthMessage = data?.type === 'OAUTH_SUCCESS' || data?.type === 'OAUTH_ERROR';

    if (
      data?.action === 'DEVICE_WIFI_CONNECTED' ||
      data?.action === 'SEND_WIFI_CREDENTIALS_RESULT' ||
      data?.action === 'DEVICE_CONFIG_RESULT' ||
      data?.action === 'WIFI_CONNECT_RESULT'
    ) {
      logProvisionStep('send_to_web', {
        action: data.action,
        success: data.success,
        status: data.status,
        message: data.message,
        error: data.error,
      });
    }

    const message = JSON.stringify(data);
    webviewRef.current?.postMessage(message);

    if (isOAuthMessage) {
      pendingOAuthMessageRef.current = data;
      console.log('[OAuth]', 'message_sent_to_webview', {
        type: data.type,
        hasCode: Boolean(data.code),
        hasToken: Boolean(data.access_token),
        error: data.error,
      });

      const injectOAuthMessage = delayMs => {
        const script = `
          (function () {
            var message = ${JSON.stringify(message)};
            var parsed = null;
            try {
              parsed = JSON.parse(message);
            } catch (error) {}

            try {
              window.__SMART_ECO_OAUTH_RESULT__ = parsed || message;
            } catch (error) {}

            try {
              window.localStorage.setItem('SMART_ECO_OAUTH_RESULT', message);
              window.localStorage.setItem('oauth_result', message);
            } catch (error) {}

            try {
              window.dispatchEvent(new MessageEvent('message', { data: message }));
            } catch (error) {}

            try {
              document.dispatchEvent(new MessageEvent('message', { data: message }));
            } catch (error) {}

            try {
              window.dispatchEvent(new CustomEvent('OAUTH_SUCCESS', { detail: parsed || message }));
            } catch (error) {}

            try {
              window.dispatchEvent(new CustomEvent('SMART_ECO_OAUTH_RESULT', { detail: parsed || message }));
            } catch (error) {}

            true;
          })();
        `;
        webviewRef.current?.injectJavaScript(script);
        console.log('[OAuth]', 'message_injected_to_webview', { delayMs, type: data.type });
      };

      injectOAuthMessage(0);

      setTimeout(() => {
        webviewRef.current?.postMessage(message);
        console.log('[OAuth]', 'message_retry_to_webview', { delayMs: 500, type: data.type });
        injectOAuthMessage(500);
      }, 500);

      setTimeout(() => {
        webviewRef.current?.postMessage(message);
        console.log('[OAuth]', 'message_retry_to_webview', { delayMs: 1500, type: data.type });
        injectOAuthMessage(1500);
      }, 1500);
    }
  };

  // Get current connected wifi details
  const getCurrentWifiInfo = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      logProvisionStep('wifi_ssid_read_success', {
        platform: Platform.OS,
        ssid,
        normalizedSSID: normalizeSsid(ssid),
      });
      // Note: For security reasons, Android 10+ doesn't allow apps to retrieve WiFi passwords
      // Only system apps or rooted devices can access this
      return {
        ssid: ssid,
        password: null, // Cannot retrieve password on modern Android
        note: 'Password retrieval not available on Android 10+',
      };
    } catch (e) {
      logProvisionStep('wifi_ssid_read_failed', {
        platform: Platform.OS,
        error: e?.toString?.(),
      });
      return {
        ssid: null,
        password: null,
        error: e.toString(),
      };
    }
  };

  const getConnectedWifiDetails = async () => {
    try {
      // Now scan connected WiFi
      const connectedSSID = await WifiManager.getCurrentWifiSSID();
      if (connectedSSID) {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: true,
          currentWifi: {
            ssid: connectedSSID,
          },
        });
      } else {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          currentWifi: {
            ssid: 'No wifi connected',
          },
          success: false,
          error: 'Connection failed. Please try again...',
        });
      }
    } catch (e) {
      sendToWeb({
        action: 'WIFI_CONNECT_RESULT',
        success: false,
        error: 'Connection timeout. Please try again...',
      });
    }
  };

  const getMobileDataStatus = async () => {
    try {
      const state = await NetInfo.fetch();
      const isMobileDataEnabled = state.type === 'cellular' && state.isConnected === true;
      return { isMobileDataEnabled };
    } catch (e) {
      console.log('Error while getting mobile data status');
      return { isMobileDataEnabled: false, error: e.toString() };
    }
  };

  const checkLocationPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted;
    }

    // iOS fallback (no RNPermissions)
    if (Platform.OS === 'ios') {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
};

  const getSystemStatus = async () => {
    try {
      const locationPermission = await checkLocationPermission();
      const mobileDataStatus = await getMobileDataStatus();

      sendToWeb({
        action: 'SYSTEM_STATUS',
        data: {
          locationPermission,
          mobileData: mobileDataStatus.isMobileDataEnabled,
        },
      });
      return {
        success: true,
        locationPermission,
        mobileData: mobileDataStatus.isMobileDataEnabled,
      };
    } catch (e) {
      sendToWeb({
        action: 'SYSTEM_STATUS',
        error: e.toString(),
      });
      return {
        success: false
      }
    }
  };

  const connectToWifi = async (ssid, password, serialNumber) => {
    try {
      if (Platform.OS === 'ios') {
        if (!WifiConnectModule?.connectToNetwork) {
          sendToWeb({
            action: 'WIFI_CONNECT_RESULT',
            success: false,
            error: 'WifiConnectModule not available',
          });
          return;
        }

        const attemptIosConnection = targetSsid => new Promise(async (resolve, reject) => {
          // If we're already on the target network, skip re-applying the
          // hotspot config — re-joining a network we're already associated
          // with can briefly drop the connection and cause the poll below
          // to falsely report failure (triggering an unnecessary fallback).
          const alreadyConnectedSSID = (await getCurrentWifiInfo()).ssid;
          if (normalizeSsid(alreadyConnectedSSID).toLowerCase() === normalizeSsid(targetSsid).toLowerCase()) {
            logProvisionStep('ios_wifi_already_connected', { targetSsid, connectedSSID: alreadyConnectedSSID });
            resolve({ success: true, connectedSSID: alreadyConnectedSSID });
            return;
          }

          try {
            // NEHotspotConfiguration with joinOnce=YES: temporarily joins the network
            // for this session only — not saved to device WiFi settings.
            // iOS will show a system confirmation dialog to the user.
            await WifiConnectModule.connectToNetwork(targetSsid, password);
          } catch (e) {
            reject(e);
            return;
          }

          // iOS wifi switching can take longer than a single check allows.
          // Poll the current SSID until it matches the target or we time out.
          const MAX_CHECKS = 6;
          const CHECK_INTERVAL_MS = 1500;
          let checkCount = 0;
          const pollForConnection = async () => {
            checkCount++;
            const connectedSSID = (await getCurrentWifiInfo()).ssid;
            const success = normalizeSsid(connectedSSID).toLowerCase() === normalizeSsid(targetSsid).toLowerCase();
            logProvisionStep('ios_wifi_connect_poll', {
              checkCount,
              connectedSSID,
              targetSsid,
              success,
            });
            if (success || checkCount >= MAX_CHECKS) {
              resolve({ success, connectedSSID });
            } else {
              setTimeout(pollForConnection, CHECK_INTERVAL_MS);
            }
          };
          setTimeout(pollForConnection, 2000);
        });

        // The device may broadcast either a bare "IAQ_" network or
        // "IAQ_{serialNumber}". Only fall back to the other variant if the
        // requested ssid fails to connect.
        const fallbackSsid = getFallbackIaqSsid(ssid, serialNumber);

        let { success, connectedSSID } = await attemptIosConnection(ssid);

        if (!success && fallbackSsid) {
          logProvisionStep('ios_wifi_connect_fallback_attempt', { originalSsid: ssid, fallbackSsid });
          ({ success, connectedSSID } = await attemptIosConnection(fallbackSsid));
        }

        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success,
          currentWifi: { ssid: success ? connectedSSID : ssid },
          message: success ? `Connected to ${connectedSSID}` : 'Connection failed or timed out',
        });
      } else {
        const locationReady = await checkAndAskLocation();
        if (!locationReady) {
          sendToWeb({
            action: 'WIFI_CONNECT_RESULT',
            success: false,
            error: 'Location permission required',
          });
          return;
        }
        await WifiManager.connectToProtectedSSID(ssid, password, false, false);
        setTimeout(async () => {
          const connectedSSID = await WifiManager.getCurrentWifiSSID();
          const success = connectedSSID === ssid;
          sendToWeb({
            action: 'WIFI_CONNECT_RESULT',
            success,
            currentWifi: { ssid: connectedSSID, password, note: 'Wifi details' },
            message: success ? `Connected to ${ssid}` : 'Connection failed or timed out',
          });
        }, 3000);
      }
    } catch (e) {
      sendToWeb({
        action: 'WIFI_CONNECT_RESULT',
        success: false,
        error: e.toString(),
      });
    }
  };

  const releaseWifiBinding = async ({ ssid, password } = {}) => {
    logProvisionStep('release_wifi_binding_received', { ssid });

    if (WifiConnectModule?.connectToHomeNetwork && ssid && password) {
      try {
        logProvisionStep('ios_reconnecting_to_home_wifi', { ssid });
        await WifiConnectModule.connectToHomeNetwork(ssid, password);

        // NEHotspotConfiguration fires the callback before the wifi switch
        // completes — poll for up to 10s to confirm actual connection.
        let connected = false;
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const currentSsid = await WifiManager.getCurrentWifiSSID().catch(() => null);
          if (currentSsid && currentSsid === ssid) {
            connected = true;
            break;
          }
        }
        logProvisionStep('ios_reconnected_to_home_wifi', { ssid, verified: connected });
      } catch (e) {
        logProvisionStep('ios_reconnect_to_home_wifi_failed', { error: e?.toString?.() });
      }
    } else {
      // No home wifi credentials — remove the device hotspot config so iOS
      // disconnects from the device network immediately.
      try {
        const currentSsid = await WifiManager.getCurrentWifiSSID();
        if (currentSsid) {
          await WifiConnectModule.disconnectFromNetwork(currentSsid);
          logProvisionStep('ios_disconnected_device_wifi', { ssid: currentSsid });
        }
      } catch (e) {
        logProvisionStep('ios_disconnect_device_wifi_failed', { error: e?.toString?.() });
      }
    }

    sendToWeb({ action: 'WIFI_BINDING_RELEASED' });

  };

  const sendWifiCredentials = async (payload) => {
    ensureProvisionAttempt('sendWifiCredentials');
    const MAX_ATTEMPTS = 3;
    const REQUEST_TIMEOUT = 30000;
    const RETRY_DELAY_MS = 10000;
    const endpoint = DEVICE_CONFIG_URL;

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const getStatusMessage = (status) => {
      if (status >= 200 && status < 300) return 'Device accepted Wi-Fi details';
      if (status === 400) return 'Invalid request. Please check the Wi-Fi details.';
      if (status === 401) return 'Authentication failed. Please verify device credentials.';
      if (status === 404) return 'Device endpoint not found. Please check the device URL.';
      if (status === 500) return 'Device internal error. Please try again.';
      if (status >= 400 && status < 500) return `Client error (${status}). Please check your request.`;
      if (status >= 500) return `Server error (${status}). Device encountered an error.`;
      return `Unexpected status code: ${status}`;
    };

    const sendResult = data => {
      sendToWeb({
        action: 'SEND_WIFI_CREDENTIALS_RESULT',
        ...data,
      });
      sendToWeb({
        action: 'DEVICE_CONFIG_RESULT',
        ...data,
      });
    };

    const logPayloadSnapshot = (step, payloadSnapshot) => {
      logProvisionStep(step, {
        endpoint,
        payload: payloadSnapshot,
        payloadJson: JSON.stringify(payloadSnapshot),
      });
    };

    const buildIosDevicePayload = rawPayload => {
      const devicePayload = {
        ssid: rawPayload?.ssid,
        password: rawPayload?.password,
        deviceid: rawPayload?.deviceid,
        devicePassword: rawPayload?.devicePassword || '',
        offsets: Array.isArray(rawPayload?.offsets) ? rawPayload.offsets : [],
        serverUrl: rawPayload?.serverUrl || 'https://app.smarteco.ai/smartecoiaq/',
        gateWayKey: rawPayload?.gateWayKey || '',
        enablebms: Boolean(rawPayload?.enablebms),
      };

      return devicePayload;
    };

    const devicePayload = Platform.OS === 'ios' ? buildIosDevicePayload(payload) : payload;

    if (!devicePayload?.ssid || !devicePayload?.password) {
      sendResult({
        success: false,
        message: 'Regular Wi-Fi SSID and password are required before sending settings to the device.',
        error: 'Missing ssid or password',
      });
      return;
    }

    if (Platform.OS === 'ios') {
        const connectedDeviceSsid = (await getCurrentWifiInfo()).ssid;
        const connectedDeviceId = extractDeviceIdFromDeviceSsid(connectedDeviceSsid);
        const scannerDeviceId = devicePayload.deviceid || '';
        const scannerMatchesConnectedSsid = Boolean(
          connectedDeviceId &&
          scannerDeviceId &&
          connectedDeviceId.toLowerCase() === scannerDeviceId.toLowerCase()
        );

        logProvisionStep('ios_native_send_wifi_credentials_start', {
          endpoint,
          ssid: devicePayload.ssid,
          deviceid: devicePayload.deviceid,
          hasPassword: Boolean(devicePayload.password),
          offsetsCount: Array.isArray(devicePayload.offsets) ? devicePayload.offsets.length : undefined,
          payloadKeys: Object.keys(devicePayload),
        });
        logProvisionStep('ios_device_config_correlation', {
          connectedDeviceSsid,
          connectedDeviceId,
          scannerDeviceId,
          scannerMatchesConnectedSsid,
        });
        logPayloadSnapshot('ios_native_send_wifi_credentials_payload', devicePayload);

        if (!DeviceConfigModule?.send) {
          sendResult({ success: false, error: 'DeviceConfigModule is not available' });
          return;
        }

        try {
          const result = await DeviceConfigModule.send(endpoint, devicePayload, DEVICE_CONFIG_TIMEOUT_MS);
          
          const statusCode = Number(result?.status || 0);

          let responseBody;
          try {
            responseBody = JSON.parse(result?.response || '');
            console.log(responseBody, "Response from device wifi");
          } catch (parseError) {
            responseBody = undefined;
          }

          // The device API always responds with HTTP 200, even when it couldn't
          // reach the internet. Compare strictly against false so a missing field
          // (older firmware) doesn't get mistaken for a failure.
          const internetUnavailable = responseBody?.internetAvailable === false;
          const success = statusCode >= 200 && statusCode < 300 && !internetUnavailable;

          if (!success) {
            await releaseWifiBinding();
          }

          logProvisionStep('ios_native_send_wifi_credentials_result', {
            status: statusCode,
            success,
            internetAvailable: responseBody?.internetAvailable,
            responseLength: result?.response?.length || 0,
            response: result?.response || '',
            requestBody: result?.requestBody,
          });

          sendResult({
            success,
            status: statusCode,
            response: result?.response,
            requestPayload: devicePayload,
            requestBody: result?.requestBody || JSON.stringify(devicePayload),
            message: internetUnavailable
              ? 'Internet is not available. Please check the WiFi details and try again.'
              : getStatusMessage(statusCode),
            error: success ? undefined : (internetUnavailable ? 'Internet not available' : `HTTP ${statusCode}`),
          });
        } catch (e) {
          const errMsg = e?.message?.toLowerCase() || '';
          // -1005 means the device dropped the connection after accepting credentials —
          // this is the expected iOS success path (device resets to join home wifi).
          const deviceAccepted = errMsg.includes('network connection was lost') ||
                                 errMsg.includes('connection was lost');
          logProvisionStep('ios_native_send_wifi_credentials_error', {
            error: e?.toString?.(),
            deviceAccepted,
          });
          if (deviceAccepted) {
            sendResult({
              success: true,
              status: 200,
              message: 'Device accepted Wi-Fi details',
              requestBody: JSON.stringify(devicePayload),
            });
          } else {
            await releaseWifiBinding();
            sendResult({
              success: false,
              error: e?.message || e?.toString?.() || 'Unknown error',
              message: 'Failed to send Wi-Fi credentials to the device.',
            });
          }
        }
      return;
    }

    let routedToWifi = false;
    try {
      await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
      routedToWifi = true;
      await delay(1500);

      let attempt = 1;
      while (attempt <= MAX_ATTEMPTS) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

        try {
          logProvisionStep('android_send_wifi_credentials_attempt', {
            endpoint,
            attempt,
            maxAttempts: MAX_ATTEMPTS,
          });
          logPayloadSnapshot('android_send_wifi_credentials_payload', payload);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal,
          });
          clearTimeout(timeoutId);

          const statusCode = response.status;
          if (response.ok) {
            sendResult({
              success: true,
              status: statusCode,
              requestPayload: payload,
              requestBody: JSON.stringify(payload),
              message: getStatusMessage(statusCode),
            });
            return;
          }

          if (statusCode >= 400 && statusCode < 500) {
            sendResult({
              success: false,
              status: statusCode,
              requestPayload: payload,
              requestBody: JSON.stringify(payload),
              message: getStatusMessage(statusCode),
              error: `HTTP ${statusCode}`,
            });
            return;
          }

          throw new Error(`HTTP ${statusCode}`);
        } catch (error) {
          clearTimeout(timeoutId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isTimeout = error instanceof Error && (
            error.name === 'AbortError' || error.message.includes('aborted')
          );
          const isNetworkError = error instanceof Error && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('Network request failed') ||
            error.message.includes('NetworkError')
          );

          logProvisionStep('android_send_wifi_credentials_attempt_failed', {
            attempt,
            maxAttempts: MAX_ATTEMPTS,
            error: errorMessage,
          });

          if (attempt >= MAX_ATTEMPTS) {
            let msg = 'Failed to connect to device. Please check the connection and try again.';
            if (isTimeout) {
              msg = 'Device did not respond within the timeout period. Please check the connection.';
            } else if (isNetworkError) {
              msg = 'Unable to connect to device. Please ensure the phone is still connected to the device Wi-Fi.';
            }
            sendResult({
              success: false,
              message: msg,
              error: errorMessage || 'Unknown error',
              requestPayload: payload,
              requestBody: JSON.stringify(payload),
            });
            return;
          }

          attempt += 1;
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      sendResult({
        success: false,
        message: errorMessage || 'Unable to send Wi-Fi details',
        error: errorMessage || 'Unknown error',
        requestPayload: payload,
        requestBody: JSON.stringify(payload),
      });
    } finally {
      if (routedToWifi) {
        try {
          await WifiManager.forceWifiUsageWithOptions(false, { noInternet: true });
        } catch (releaseErr) {
          logProvisionStep('android_release_force_wifi_failed', {
            error: releaseErr?.toString?.(),
          });
        }
      }
    }
  };

  const stripBase64Prefix = data => {
    if (typeof data !== 'string') return '';
    const marker = 'base64,';
    const idx = data.indexOf(marker);
    return idx !== -1 ? data.slice(idx + marker.length) : data;
  };

  // Writes the base64 payload to DocumentDir and opens a system document
  // preview so the user can "Save to Files" or share it onward. iOS only —
  // Android is handled in the separate android branch.
  const handleDownloadFile = async ({ fileName, data }) => {
    if (Platform.OS !== 'ios') return;

    const safeName = (fileName && String(fileName).trim()) || `download_${Date.now()}`;
    const base64 = stripBase64Prefix(data);

    if (!base64) {
      sendToWeb({
        action: 'DOWNLOAD_FILE_RESULT',
        success: false,
        fileName: safeName,
        error: 'No file data received.',
      });
      return;
    }

    try {
      const tempPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${safeName}`;
      await ReactNativeBlobUtil.fs.writeFile(tempPath, base64, 'base64');
      await ReactNativeBlobUtil.ios.previewDocument(tempPath);
      sendToWeb({
        action: 'DOWNLOAD_FILE_RESULT',
        success: true,
        fileName: safeName,
        message: `${safeName} is ready to save.`,
      });
    } catch (e) {
      console.log('DOWNLOAD_FILE error:', e);
      sendToWeb({
        action: 'DOWNLOAD_FILE_RESULT',
        success: false,
        fileName: safeName,
        error: e instanceof Error ? e.message : 'Failed to save file.',
      });
    }
  };

  const handlePrintFile = async ({ fileName, mimeType, data }) => {
    if (Platform.OS !== 'ios') return;

    const type = mimeType || 'application/octet-stream';
    const base64 = stripBase64Prefix(data);

    if (!base64) {
      sendToWeb({
        action: 'PRINT_FILE_RESULT',
        success: false,
        fileName,
        error: 'No file data received.',
      });
      return;
    }

    let tempPath = null;
    try {
      if (type.startsWith('image/')) {
        const html =
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<style>@page{margin:0}html,body{height:100%;margin:0}' +
          '.wrap{display:flex;align-items:center;justify-content:center;height:100%}' +
          'img{max-width:100%;max-height:100%}</style></head>' +
          `<body><div class="wrap"><img src="data:${type};base64,${base64}"/></div></body></html>`;
        await RNPrint.print({ html });
      } else {
        const safeName = (fileName && String(fileName).trim()) || `print_${Date.now()}`;
        tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName}`;
        await ReactNativeBlobUtil.fs.writeFile(tempPath, base64, 'base64');
        await RNPrint.print({ filePath: tempPath });
      }
      sendToWeb({ action: 'PRINT_FILE_RESULT', success: true, fileName });
    } catch (e) {
      console.log('PRINT_FILE error:', e);
      const msg = (e && e.message ? e.message : '').toLowerCase();
      const cancelled = msg.includes('cancel') || msg.includes('did not');
      sendToWeb({
        action: 'PRINT_FILE_RESULT',
        success: false,
        fileName,
        error: cancelled ? 'Print cancelled.' : e instanceof Error ? e.message : 'Failed to print.',
      });
    } finally {
      if (tempPath) ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
    }
  };

  // Opens the native share sheet. When `data` is present the base64 payload
  // is written to a temp file and shared; otherwise just the url/text is shared.
  // Works on both iOS and Android via react-native-share.
  const handleShare = async ({ url, title, text, fileName, mimeType, data }) => {
    if (Platform.OS !== 'ios') return;

    const base64 = stripBase64Prefix(data);
    let tempPath = null;

    try {
      const options = {};
      if (title) options.title = title;

      const shareMessage = [text, url].filter(Boolean).join('\n');
      if (shareMessage) options.message = shareMessage;

      if (base64) {
        const type = mimeType || 'application/octet-stream';
        const safeName = (fileName && String(fileName).trim()) || `share_${Date.now()}`;
        tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName}`;
        await ReactNativeBlobUtil.fs.writeFile(tempPath, base64, 'base64');
        options.url = `file://${tempPath}`;
        options.type = type;
        options.filename = safeName;
      } else if (url) {
        options.url = url;
      }

      if (!options.url && !options.message) {
        sendToWeb({ action: 'SHARE_RESULT', success: false, error: 'Nothing to share.' });
        return;
      }

      await Share.open(options);
      sendToWeb({ action: 'SHARE_RESULT', success: true });
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      const cancelled = msg.includes('cancel') || msg.includes('dismiss') || msg.includes('user did not share');
      sendToWeb({
        action: 'SHARE_RESULT',
        success: false,
        error: cancelled ? 'Share cancelled.' : e instanceof Error ? e.message : 'Failed to share.',
      });
    } finally {
      if (tempPath) ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
    }
  };

  const injectedDeviceConfigBridge = `
    (function () {
      if (window.__smartEcoDeviceConfigBridgeInstalled) {
        true;
      } else {
        window.__smartEcoDeviceConfigBridgeInstalled = true;
        var pendingNativeDeviceRequests = {};
        var originalFetch = window.fetch;
        var OriginalXHR = window.XMLHttpRequest;

        function postNative(message) {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
          } catch (error) {}
        }

        function isDeviceConfigUrl(url) {
          return typeof url === 'string' && url.indexOf('http://192.168.4.1/wifi') === 0;
        }

        function parseBody(body) {
          if (!body) {
            return {};
          }
          if (typeof body === 'string') {
            try {
              return JSON.parse(body);
            } catch (error) {
              return {};
            }
          }
          if (typeof body === 'object') {
            return body;
          }
          return {};
        }

        function getFetchUrl(input) {
          if (typeof input === 'string') {
            return input;
          }
          if (input && typeof input.url === 'string') {
            return input.url;
          }
          return '';
        }

        function makeNativeResponse(text, status) {
          var responseStatus = status || 200;
          var responseText = text || '';
          return {
            ok: responseStatus >= 200 && responseStatus < 300,
            status: responseStatus,
            statusText: responseStatus >= 200 && responseStatus < 300 ? 'OK' : 'Error',
            text: function () { return Promise.resolve(responseText); },
            json: function () {
              try {
                return Promise.resolve(JSON.parse(responseText || '{}'));
              } catch (error) {
                return Promise.resolve({});
              }
            },
            clone: function () { return makeNativeResponse(responseText, responseStatus); },
            headers: { get: function () { return 'text/plain'; } }
          };
        }

        window.addEventListener('message', function (event) {
          var data = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (error) {}
          }
          if (!data || (data.action !== 'DEVICE_CONFIG_RESULT' && data.action !== 'SEND_WIFI_CREDENTIALS_RESULT')) {
            return;
          }

          var pending = pendingNativeDeviceRequests[data.requestId || data.id || 'default'];
          if (!pending) {
            pending = pendingNativeDeviceRequests.default;
          }
          if (!pending) {
            return;
          }
          delete pendingNativeDeviceRequests[data.requestId || data.id || 'default'];
          delete pendingNativeDeviceRequests.default;

          if (data.success) {
            pending.resolve(makeNativeResponse(data.response || data.message || '', data.status || 200));
          } else {
            pending.reject(new TypeError(data.error || data.message || 'Failed to send Wi-Fi details to device'));
          }
        });

        if (typeof originalFetch === 'function') {
          window.fetch = function (input, init) {
            var url = getFetchUrl(input);
            if (!isDeviceConfigUrl(url)) {
              return originalFetch.apply(this, arguments);
            }
            var body = init && init.body;
            if (!body && input && input._bodyInit) {
              body = input._bodyInit;
            }
            var payload = parseBody(body);
            var requestId = 'device-config-' + Date.now() + '-' + Math.random().toString(16).slice(2);

            postNative({
              action: 'WEB_NETWORK_LOG',
              data: {
                type: 'native_device_config_fetch_intercepted',
                requestId: requestId,
                ssid: payload && payload.ssid,
                deviceid: payload && payload.deviceid
              }
            });

            return new Promise(function (resolve, reject) {
              pendingNativeDeviceRequests[requestId] = { resolve: resolve, reject: reject };
              pendingNativeDeviceRequests.default = { resolve: resolve, reject: reject };
              postNative({
                action: 'SEND_WIFI_CREDENTIALS',
                requestId: requestId,
                payload: payload
              });
            });
          };
        }

        if (typeof OriginalXHR === 'function') {
          window.XMLHttpRequest = function () {
            var xhr = new OriginalXHR();
            var open = xhr.open;
            var send = xhr.send;
            var url = '';

            xhr.open = function () {
              url = arguments[1] || '';
              return open.apply(xhr, arguments);
            };

            xhr.send = function (body) {
              if (!isDeviceConfigUrl(url)) {
                return send.apply(xhr, arguments);
              }

              var payload = parseBody(body);
              var requestId = 'device-config-xhr-' + Date.now() + '-' + Math.random().toString(16).slice(2);
              postNative({
                action: 'WEB_NETWORK_LOG',
                data: {
                  type: 'native_device_config_xhr_intercepted',
                  requestId: requestId,
                  ssid: payload && payload.ssid,
                  deviceid: payload && payload.deviceid
                }
              });

              pendingNativeDeviceRequests[requestId] = {
                resolve: function (response) {
                  response.text().then(function (text) {
                    Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                    Object.defineProperty(xhr, 'status', { value: response.status || 200, configurable: true });
                    Object.defineProperty(xhr, 'responseText', { value: text || '', configurable: true });
                    Object.defineProperty(xhr, 'response', { value: text || '', configurable: true });
                    if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
                    if (typeof xhr.onload === 'function') xhr.onload();
                  });
                },
                reject: function (error) {
                  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                  Object.defineProperty(xhr, 'status', { value: 0, configurable: true });
                  if (typeof xhr.onerror === 'function') xhr.onerror(error);
                }
              };
              pendingNativeDeviceRequests.default = pendingNativeDeviceRequests[requestId];
              postNative({
                action: 'SEND_WIFI_CREDENTIALS',
                requestId: requestId,
                payload: payload
              });
            };
            return xhr;
          };
        }
        true;
      }
    })();
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <WebView
        ref={webviewRef}
        mixedContentMode="always"
        onMessage={onWebMessage}
        injectedJavaScriptBeforeContentLoaded={injectedDeviceConfigBridge}
        injectedJavaScript={injectedAutoZoomFix}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        onLoadEnd={() => {
          setIsLoading(false);
          if (pendingOAuthMessageRef.current) {
            const oauthMessage = pendingOAuthMessageRef.current;
            const message = JSON.stringify(oauthMessage);
            console.log('[OAuth]', 'message_flushed_after_load', {
              type: oauthMessage.type,
              hasCode: Boolean(oauthMessage.code),
              hasToken: Boolean(oauthMessage.access_token),
              error: oauthMessage.error,
            });
            webviewRef.current?.postMessage(message);
            webviewRef.current?.injectJavaScript(`
              (function () {
                var message = ${JSON.stringify(message)};
                var parsed = null;
                try {
                  parsed = JSON.parse(message);
                } catch (error) {}
                try {
                  window.__SMART_ECO_OAUTH_RESULT__ = parsed || message;
                  window.localStorage.setItem('SMART_ECO_OAUTH_RESULT', message);
                  window.localStorage.setItem('oauth_result', message);
                  window.dispatchEvent(new MessageEvent('message', { data: message }));
                  document.dispatchEvent(new MessageEvent('message', { data: message }));
                  window.dispatchEvent(new CustomEvent('OAUTH_SUCCESS', { detail: parsed || message }));
                  window.dispatchEvent(new CustomEvent('SMART_ECO_OAUTH_RESULT', { detail: parsed || message }));
                } catch (error) {}
                true;
              })();
            `);
          }
        }}
        onNavigationStateChange={navState => {
          const url = navState.url;
          setCurrentUrl(url);
          setHistory(prev => {
            if (prev[prev.length - 1] !== url) {
              return [...prev, url];
            }
            return prev;
          });
        }}
       
        // onError={(e) => {
        //   console.log("WEBVIEW ERROR", e.nativeEvent);
        // }}
        // onHttpError={(e) => {
        //   console.log("HTTP ERROR", e.nativeEvent);
        // }}
        
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0F796B" />
          <Text style={styles.loadingText}>Loading SmartEco...</Text>
        </View>
      )}
      {showSplash && (
        <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]}>
          <WebView
            source={splashSource}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowingReadAccessToURL={`file://${DeviceConfigModule?.bundlePath ?? ''}/onboarding/`}
            onMessage={handleSplashMessage}
            originWhitelist={['*']}
          />
        </Animated.View>
      )}
      <UpdateModal
        visible={modalVisible}
        type={updateType}
        data={updateData}
        onDismiss={dismiss}
        onSkipVersion={skipVersion}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0F796B',
    fontWeight: '500',
  },
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: '#fff',
  },
});

export default WebViewScreen;
