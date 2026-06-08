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
import useVersionCheck from '../../hooks/useVersionCheck';
import UpdateModal from '../UpdateModal';

const { VpnModule } = NativeModules;

const ONBOARDING_BASE_URI = 'file:///android_asset/onboarding/index.html';

const WebViewScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
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
  const splashUri = splashOnly
    ? `${ONBOARDING_BASE_URI}?splashOnly=true`
    : ONBOARDING_BASE_URI;

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
  }, []);

  //
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack) {
          webviewRef.current.goBack();
          return true;
        }
        return false; // allow app exit
      },
    );

    return () => backHandler.remove();
  }, [canGoBack]);

  const webviewRef = useRef(null);
  const checkAndAskLocation = async () => {
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

  //Requesting wifi scan for getting any wifi connected
  const scanWifiNetworks = async () => {
    try {
      const locationReady = await checkAndAskLocation();
      if (!locationReady) {
        sendToWeb({
          action: 'WIFI_SCAN_RESULT',
          networks: [],
          error: 'Location permission required',
        });
        return;
      }

      const [networks, connectedSSID] = await Promise.all([
        WifiManager.loadWifiList(),
        getCurrentWifiInfo(),
      ]);
      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        networks,
        currentWifi: { ssid: connectedSSID.ssid },
      });
    } catch (e) {
      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        networks: [],
        error: e.toString(),
      });
    }
  };

  const onWebMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[WebView → Native] Received:', JSON.stringify(message));

      switch (message.action) {
        case 'APP_VERSION_INFO':
          lastVersionData.current = message.data;
          handleVersionData(message.data);
          break;

        case 'SCAN_WIFI':
          scanWifiNetworks();
          break;

        case 'GET_CONNECTED_WIFI':
          getConnectedWifiDetails();
          break;

        case 'GET_SYSTEM_STATUS':
          const interval = setInterval(async () => {
            const systemStatus = await getSystemStatus();
            if (
              systemStatus.success &&
              systemStatus.locationPermission &&
              !systemStatus.mobileData &&
              !systemStatus.isVpnOn
            ) {
              clearInterval(interval);
            }
          }, 3000);
          break;

        case 'CONNECT_WIFI':
          if (message.ssid) {
            const { ssid, password } = message;
            connectToWifi(ssid, password);
          } else {
            sendToWeb({
              action: 'WIFI_CONNECT_RESULT',
              success: false,
              error: 'SSID is required',
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
                onPress: () =>
                  Linking.sendIntent('android.settings.WIFI_SETTINGS'),
              },
            ]);
          }

          break;

        case 'OPEN_WIFI_SETTINGS_FOR_NO_INTERNET':
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIFI_SETTINGS');
          } else {
            Alert.alert('Enable Wi-Fi', 'Please enable Wi-Fi from Settings', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () =>
                  Linking.sendIntent('android.settings.WIFI_SETTINGS'),
              },
            ]);
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
          sendWifiCredentials(message.payload);
          break;

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
        case 'RELEASE_WIFI_BINDING':
          releaseNetworkBinding();
          break;

        case 'CHECK_LOCATION':
          checkAndAskLocation();
          break;

        case 'SCAN_WIFI_NETWORKS':
          scanWifiNetworks();
          break;

        default:
          console.log('Unknown action:', message.action);
      }
    } catch (err) {
      console.log('Bad message from web:', err);
    }
  };

  const checkWifiConnection = async () => {
    const connectedSSID = (await getCurrentWifiInfo()).ssid ?? "Iaq_";
    if (connectedSSID != null && (connectedSSID.startsWith("IAQ_") || connectedSSID.startsWith("iaq_") || connectedSSID.startsWith("Iaq_"))) {
      sendToWeb({
        action: 'DEVICE_WIFI_CONNECTED',
        currentWifi: {
          ssid: connectedSSID,
        },
        success: true,
      });
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

  const sendToWeb = data => {
    console.log('[Native → WebView] Sending:', JSON.stringify(data));
    webviewRef.current?.postMessage(JSON.stringify(data));
  };

  // Get current connected wifi details
  const getCurrentWifiInfo = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      // Note: For security reasons, Android 10+ doesn't allow apps to retrieve WiFi passwords
      // Only system apps or rooted devices can access this
      return {
        ssid: ssid,
        password: null, // Cannot retrieve password on modern Android
        note: 'Password retrieval not available on Android 10+',
      };
    } catch (e) {
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
      const isMobileDataEnabled =
        await NativeModules.MobileDataModule.isMobileDataEnabled();
      return {
        isMobileDataEnabled,
      };
    } catch (e) {
      console.log('Error while getting modile sta status');
      return {
        isMobileDataEnabled: false,
        error: e.toString(),
      };
    }
  };

  const checkLocationPermission = async () => {
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted;
    } catch (err) {
      return false;
    }
  };

  const checkVpn = async () => {
    const isVpnActive = await VpnModule.isVpnActive();
    return isVpnActive;
  };

  const getSystemStatus = async () => {
    try {
      const locationPermission = await checkLocationPermission();
      const mobileDataStatus = await getMobileDataStatus();
      const isVpnOn = await checkVpn();

      sendToWeb({
        action: 'SYSTEM_STATUS',
        data: {
          locationPermission,
          mobileData: mobileDataStatus.isMobileDataEnabled,
          isVpnOn,
        },
      });
      return {
        success: true,
        locationPermission,
        mobileData: mobileDataStatus.isMobileDataEnabled,
        isVpnOn,
      };
    } catch (e) {
      sendToWeb({
        action: 'SYSTEM_STATUS',
        error: e.toString(),
      });
      return {
        success: false,
      };
    }
  };

  // Derive the ESP32 gateway IP from the device's own Wi-Fi IP.
  // ESP32 SoftAP default subnet hands clients 192.168.4.x with gateway 192.168.4.1,
  // so replacing the last octet with `1` matches the running hotspot reliably without
  // hard-coding an IP. This avoids needing react-native-wifi-reborn's
  // getGatewayIPAddress() which is not available in v4.13.6.
  const resolveEsp32Gateway = async () => {
    const localIP = await WifiManager.getIP();
    if (!localIP) throw new Error('Could not read device IP');
    const parts = localIP.split('.');
    if (parts.length !== 4) throw new Error(`Unexpected IP format: ${localIP}`);
    parts[3] = '1';
    return parts.join('.');
  };

  const sendWifiCredentials = async payload => {
    const MAX_ATTEMPTS = 3;
    const REQUEST_TIMEOUT = 30000;
    const RETRY_DELAY_MS = 10000;

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const getStatusMessage = status => {
      if (status === 200) return 'Device connected successfully';
      if (status === 400)
        return 'Invalid request. Please check the WiFi credentials.';
      if (status === 401)
        return 'Authentication failed. Please verify device credentials.';
      if (status === 404)
        return 'Device endpoint not found. Please check the device URL.';
      if (status === 500) return 'Device internal error. Please try again.';
      if (status >= 400 && status < 500)
        return `Client error (${status}). Please check your request.`;
      if (status >= 500)
        return `Server error (${status}). Device encountered an error.`;
      return `Unexpected status code: ${status}`;
    };

    let routedToWifi = false;
    try {
      // forceWifiUsageWithOptions and getIP via WifiManager are Android-only in
      // react-native-wifi-reborn. iOS routes 192.168.4.1 over the active Wi-Fi
      // interface automatically when joined to the ESP32 SoftAP.
      if (Platform.OS === 'android') {
        await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
        routedToWifi = true;
        await delay(1500); // let the network binding settle

        try {
          const esp32IP = await resolveEsp32Gateway();
          console.log('SendWifiCredentials: resolved gateway', esp32IP);
        } catch (gwErr) {
          console.warn(
            'SendWifiCredentials: gateway resolve failed (continuing)',
            gwErr && gwErr.message,
          );
        }
      }

      const endpoint = `http://192.168.4.1/wifi`;
      console.log('SendWifiCredentials: target endpoint', endpoint);

      let attempt = 1;
      while (true) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(
          () => abortController.abort(),
          REQUEST_TIMEOUT,
        );
        try {
          console.log(
            `SendWifiCredentials: Attempt ${attempt}/${MAX_ATTEMPTS}`,
          );
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal,
          });
          clearTimeout(timeoutId);
          console.log(response);
          const statusCode = response.status;

          let responseBody = null;
          try {
            responseBody = await response.json();
          } catch {
            responseBody = null;
          }

          if (response.ok) {
            if (responseBody && responseBody.internetAvailable === false) {
              sendToWeb({
                action: 'SEND_WIFI_CREDENTIALS_RESULT',
                success: false,
                message:
                  'Internet is not available. Please check the WiFi details and try again.',
              });
              return;
            }
            sendToWeb({
              action: 'SEND_WIFI_CREDENTIALS_RESULT',
              success: true,
              message: getStatusMessage(statusCode),
            });
            return;
          }

          // Don't retry 4xx — request itself is bad.
          if (statusCode >= 400 && statusCode < 500) {
            sendToWeb({
              action: 'SEND_WIFI_CREDENTIALS_RESULT',
              success: false,
              message: getStatusMessage(statusCode),
              error: `HTTP ${statusCode}`,
            });
            return;
          }

          throw new Error(`HTTP ${statusCode}`);
        } catch (error) {
          clearTimeout(timeoutId);
          const isTimeout =
            error instanceof Error &&
            (error.name === 'AbortError' || error.message.includes('aborted'));
          const isNetworkError =
            error instanceof Error &&
            (error.message.includes('Failed to fetch') ||
              error.message.includes('Network request failed') ||
              error.message.includes('NetworkError'));

          console.warn(
            `SendWifiCredentials: Attempt ${attempt}/${MAX_ATTEMPTS} failed`,
            error && error.message,
          );

          if (attempt >= MAX_ATTEMPTS) {
            let msg =
              'Failed to connect to device. Please check the connection and try again.';
            if (isTimeout) {
              msg =
                'Device did not respond within the timeout period. Please check the connection.';
            } else if (isNetworkError) {
              msg =
                'Unable to connect to device. Please ensure the device is powered on and on the same network.';
            }
            sendToWeb({
              action: 'SEND_WIFI_CREDENTIALS_RESULT',
              success: false,
              message: msg,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
          }

          attempt++;
          await delay(RETRY_DELAY_MS);
        }
      }
    } catch (e) {
      sendToWeb({
        action: 'SEND_WIFI_CREDENTIALS_RESULT',
        success: false,
        message:
          e instanceof Error ? e.message : 'Unable to send Wi-Fi credentials',
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      // Always release the wifi binding so the rest of the app can use mobile/internet again.
      if (routedToWifi) {
        try {
          await WifiManager.forceWifiUsageWithOptions(false, {
            noInternet: true,
          });
        } catch (releaseErr) {
          console.warn(
            'SendWifiCredentials: failed to release forceWifiUsage',
            releaseErr,
          );
        }
      }
    }
  };

  // Strip a `data:<mime>;base64,` prefix if the web sent a full data URI,
  // leaving only the raw base64 payload that blob-util expects.
  const stripBase64Prefix = data => {
    if (typeof data !== 'string') return '';
    const marker = 'base64,';
    const idx = data.indexOf(marker);
    return idx !== -1 ? data.slice(idx + marker.length) : data;
  };

  // WRITE_EXTERNAL_STORAGE is only meaningful on Android <= 9 (API 28). On API 29+
  // we publish through MediaStore, which needs no runtime permission.
  const requestLegacyStoragePermission = async () => {
    if (Platform.OS !== 'android' || Platform.Version > 28) return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'SmartEco needs storage access to save downloaded files.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.log('Storage permission error:', e);
      return false;
    }
  };

  // Handles DOWNLOAD_FILE messages: writes the base64 payload to disk and saves it
  // to the public Downloads folder (Android) or the Save-to-Files sheet (iOS).
  const handleDownloadFile = async ({ fileName, mimeType, data }) => {
    const safeName = (fileName && String(fileName).trim()) || `download_${Date.now()}`;
    const type = mimeType || 'application/octet-stream';
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
      if (Platform.OS === 'android') {
        const hasPermission = await requestLegacyStoragePermission();
        if (!hasPermission) {
          sendToWeb({
            action: 'DOWNLOAD_FILE_RESULT',
            success: false,
            fileName: safeName,
            error: 'Storage permission denied.',
          });
          Alert.alert(
            'Permission Required',
            'Storage permission is needed to save files. Open settings to grant it?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }

        // Write to cache first, then publish into the public Downloads collection.
        const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName}`;
        await ReactNativeBlobUtil.fs.writeFile(tempPath, base64, 'base64');

        if (Platform.Version >= 29) {
          // Scoped storage: MediaStore handles the public Downloads entry, no permission needed.
          await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
            { name: safeName, parentFolder: '', mimeType: type },
            'Download',
            tempPath,
          );
        } else {
          // Legacy: copy into the public Downloads dir and register with Download Manager.
          const destPath = `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/${safeName}`;
          await ReactNativeBlobUtil.fs.cp(tempPath, destPath);
          ReactNativeBlobUtil.android.addCompleteDownload({
            title: safeName,
            description: 'Download complete',
            mime: type,
            path: destPath,
            showNotification: true,
          });
        }

        ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});

        sendToWeb({
          action: 'DOWNLOAD_FILE_RESULT',
          success: true,
          fileName: safeName,
          message: `${safeName} saved to Downloads.`,
        });
      } else {
        // iOS: write to the app's Documents dir, then open the Save-to-Files / share sheet.
        const path = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${safeName}`;
        await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');

        try {
          await Share.open({
            url: `file://${path}`,
            type,
            filename: safeName,
            saveToFiles: true,
          });
          sendToWeb({
            action: 'DOWNLOAD_FILE_RESULT',
            success: true,
            fileName: safeName,
            message: `${safeName} saved.`,
          });
        } catch (shareErr) {
          // react-native-share throws when the user dismisses the sheet — treat as a cancel.
          const msg = (shareErr && shareErr.message ? shareErr.message : '').toLowerCase();
          const cancelled = msg.includes('cancel') || msg.includes('dismiss') || msg.includes('user did not share');
          sendToWeb({
            action: 'DOWNLOAD_FILE_RESULT',
            success: false,
            fileName: safeName,
            error: cancelled ? 'Save cancelled.' : (shareErr?.message || 'Failed to save file.'),
          });
        }
      }
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

  // Handles PRINT_FILE messages: decodes the base64 payload and opens the native
  // print dialog. Images are embedded in HTML so they scale to the page; other
  // printable docs (e.g. PDF) are written to a temp file and printed directly.
  const handlePrintFile = async ({ fileName, mimeType, data }) => {
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
        error: cancelled
          ? 'Print cancelled.'
          : e instanceof Error
          ? e.message
          : 'Failed to print.',
      });
    } finally {
      if (tempPath) ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
    }
  };

  // Handles SHARE messages: opens the native share sheet. When `data` is present
  // the base64 payload (e.g. the QR image) is written to a temp file and shared
  // alongside any text/url; otherwise just the url/text is shared.
  const handleShare = async ({ url, title, text, fileName, mimeType, data }) => {
    const base64 = stripBase64Prefix(data);
    let tempPath = null;

    try {
      const options = {};
      if (title) options.title = title;

      const message = [text, url].filter(Boolean).join('\n');
      if (message) options.message = message;

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
        sendToWeb({
          action: 'SHARE_RESULT',
          success: false,
          error: 'Nothing to share.',
        });
        return;
      }

      await Share.open(options);
      sendToWeb({ action: 'SHARE_RESULT', success: true });
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      const cancelled =
        msg.includes('cancel') ||
        msg.includes('dismiss') ||
        msg.includes('user did not share');
      sendToWeb({
        action: 'SHARE_RESULT',
        success: false,
        error: cancelled
          ? 'Share cancelled.'
          : e instanceof Error
          ? e.message
          : 'Failed to share.',
      });
    } finally {
      if (tempPath) ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
    }
  };

  const forceWifiUsage = async (enable) => {
    await WifiManager.forceWifiUsageWithOptions(enable, { noInternet: enable });
  };

  const releaseNetworkBinding = async () => {
    try {
      await forceWifiUsage(false);
    } catch (e) {
      console.log('forceWifiUsage release error', e);
    }

    try {
      await WifiManager.disconnect();
    } catch (e) {
      console.log('disconnect error', e);
    }

    sendToWeb({ action: 'WIFI_BINDING_RELEASED', success: true });
  };

  const connectToWifi = async (ssid, password) => {
    try {
      const locationReady = await checkAndAskLocation();
      if (!locationReady) {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: false,
          error: 'Location permission required',
        });
        return;
      }

      await WifiManager.connectToProtectedSSID(ssid, password || '', false, false);

      // Route app process traffic through the IoT AP (it has no internet)
      try {
        await forceWifiUsage(true);
      } catch (e) {
        console.log('forceWifiUsage enable error', e);
      }

      // Wait a bit and verify connection
      setTimeout(async () => {
        const connectedSSID = await WifiManager.getCurrentWifiSSID();
        const success = connectedSSID === ssid;

        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success,
          currentWifi: {
            ssid: connectedSSID,
            note: 'Wifi details',
          },
          message: success
            ? `Connected to ${ssid}`
            : 'Connection failed or timed out',
        });
      }, 3000);
    } catch (e) {
      // Release any partial binding so the app isn't left stranded
      try {
        await forceWifiUsage(false);
      } catch (releaseErr) {
        console.log('forceWifiUsage release error on connect failure', releaseErr);
      }

      sendToWeb({
        action: 'WIFI_CONNECT_RESULT',
        success: false,
        error: e.toString(),
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <WebView
        ref={webviewRef}
        mixedContentMode="always"
        onMessage={onWebMessage}
<<<<<<< HEAD
        source={{ uri: 'https://app.smarteco.ai/smartecodev' }}
=======
        source={{ uri: 'https://app.smarteco.ai/smartecodev/' }}
>>>>>>> origin/newdeviceonboarding
        style={[styles.webview, { backgroundColor: '#fff' }]}
        contentInsetAdjustmentBehavior="automatic"
        androidLayerType="hardware"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        domStorageEnabled={true}
        javaScriptEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#0F796B" />
            <Text style={styles.loadingText}>Loading SmartEco...</Text>
          </View>
        )}
        onLoadEnd={async () => {
          setIsLoading(false);
          const connectedSSID = await getCurrentWifiInfo();
          sendToWeb({
            action: 'WIFI_CONNECT_RESULT',
            success: !!connectedSSID.ssid,
            currentWifi: { ssid: connectedSSID.ssid },
          });
        }}
        onError={() => setIsLoading(false)}
        onHttpError={() => setIsLoading(false)}
        injectedJavaScriptBeforeContentLoaded={`
          document.documentElement.style.backgroundColor = '#fff';
          document.addEventListener('DOMContentLoaded', function() {
            document.body.style.backgroundColor = '#fff';
          });
          true;
        `}
        onNavigationStateChange={navState => {
          setCanGoBack(navState.canGoBack);
        }}
      />
      {isLoading && !showSplash && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0F796B" />
          <Text style={styles.loadingText}>Loading SmartEco...</Text>
        </View>
      )}
      {showSplash && (
        <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]}>
          <WebView
            source={{ uri: splashUri }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
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
