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
import { ONBOARDING_BASE_URI, ONBOARDING_READ_ACCESS } from '../../utils/onboarding';
import {
  scanForDevices,
  connectToDevice,
  disconnectDevice,
  sendConfig as bleSendConfig,
} from '../../services/bleProvisioning';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authorize } from 'react-native-app-auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  MICROSOFT,
} from '../../config/socialAuth';

const { VpnModule } = NativeModules;

// iOS zooms the page in whenever an input with font-size < 16px is focused.
// Injecting a stylesheet that enforces a 16px minimum on form controls stops
// that auto-zoom. Runs after load so document.head exists; the injected <style>
// also covers inputs the SPA adds later.
const injectedAutoZoomFix = `
  (function () {
    var style = document.createElement('style');
    style.textContent = 'input, select, textarea { font-size: max(16px, 1em) !important; }';
    document.head.appendChild(style);
    true;
  })();
`;

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
  // Set when we send the user to Wi-Fi settings so we can re-read the connected
  // network once they return to the app (see the AppState listener below).
  const awaitingWifiReturn = useRef(false);

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

  // When the user returns from Wi-Fi settings, re-read the connected network
  // and push it to the web app. The flag is set before we open settings.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && awaitingWifiReturn.current) {
        awaitingWifiReturn.current = false;
        console.log("Getting connected wifi details");
        getConnectedWifiDetails();
      }
    });
    return () => subscription.remove();
  }, []);

  /* Native social login: configure Google Sign-In once. Microsoft uses
     react-native-app-auth (Chrome Custom Tab / ASWebAuthenticationSession) and
     needs no setup here. The provider auth runs natively (outside the WebView,
     which the providers block) and the resulting access token is handed back
     to the web via SOCIAL_LOGIN_RESULT. */
  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        offlineAccess: false,
      });
    } catch (e) {
      console.log('GoogleSignin.configure failed:', e);
    }
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

  // Pending Universal Link stored while onboarding/splash is active.
  const pendingDeepLinkRef = useRef(null);

  const navigateWebviewTo = (target) => {
    if (!target) return;
    if (webviewRef.current && typeof webviewRef.current.injectJavaScript === 'function') {
      const js = `window.location.href = ${JSON.stringify(target)}; true;`;
      try {
        webviewRef.current.injectJavaScript(js);
        console.log('[Universal Link] Navigated WebView to', target);
      } catch (e) {
        console.log('[Universal Link] injectJavaScript failed', e);
        pendingDeepLinkRef.current = target;
      }
    } else {
      pendingDeepLinkRef.current = target;
    }
  };

  // Listen for Universal Links (cold start and while app is running)
  useEffect(() => {
    const handleIncoming = (evtOrUrl) => {
      const incoming = typeof evtOrUrl === 'string' ? evtOrUrl : evtOrUrl?.url;
      if (!incoming) return;
      console.log('[Universal Link] Received:182', incoming);
      try {
        const parsed = new URL(incoming);
        if (
          parsed.protocol === 'https:' &&
          parsed.hostname === 'app.smarteco.ai' &&
          parsed.pathname === '/SmartecoAvd/dashboard/alerts/'
        ) {
          const target = parsed.origin + parsed.pathname + parsed.search + parsed.hash;
          if (showSplash) {
            pendingDeepLinkRef.current = target;
            console.log('[Universal Link] Deferred until splash done:', target);
          } else {
            navigateWebviewTo(target);
          }
        }
      } catch (_) {}
    };

    // Cold start
    Linking.getInitialURL().then(url => { if (url) handleIncoming(url); }).catch(() => {});

    // Warm start
    const sub = Linking.addEventListener('url', handleIncoming);
    return () => {
      try { sub.remove(); } catch (_) {}
    };
  }, [showSplash]);

  // When splash finishes, process any pending deep link
  useEffect(() => {
    if (!showSplash && pendingDeepLinkRef.current) {
      const target = pendingDeepLinkRef.current;
      pendingDeepLinkRef.current = null;
      navigateWebviewTo(target);
    }
  }, [showSplash]);

  // iOS has no public deep link to the system Wi-Fi settings (sendIntent is
  // Android-only). App-Prefs:root=WIFI opens the Wi-Fi pane on most iOS
  // versions; fall back to the app's own Settings page if the scheme is
  // unavailable so the "Open Settings" button always does something.
  const openIOSWifiSettings = () => {
    Alert.alert('Enable Wi-Fi', 'Please enable Wi-Fi from Settings', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Re-read the connected Wi-Fi when the user comes back to the app.
          awaitingWifiReturn.current = true;
          Linking.openURL('App-Prefs:root=WIFI').catch(() =>
            Linking.openSettings(),
          );
        },
      },
    ]);
  };

  // iOS location flow. PermissionsAndroid and LocationServicesDialogBox are
  // Android-only, so on iOS we lean on WifiManager.getCurrentWifiSSID(), which
  // natively shows the Core Location prompt the first time and rejects with a
  // locationPermission* code once the user has denied it. On denial we send the
  // user to the app's Settings page (where iOS keeps the Location toggle).
  const checkAndAskLocationIOS = async () => {
    try {
      await WifiManager.getCurrentWifiSSID();
      return true;
    } catch (e) {
      const code = (e?.code || e?.message || '').toString().toLowerCase();
      const denied =
        code.includes('locationpermission') ||
        code.includes('denied') ||
        code.includes('restricted');

      if (denied) {
        Alert.alert(
          'Location Permission Required',
          'Please allow Location access for SmartEco Enterprise in Settings to scan Wi-Fi networks.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openURL('app-settings:'),
            },
          ],
        );
        return false;
      }

      // "Could not detect SSID" (e.g. not currently on Wi-Fi) is not a
      // permission failure — access is granted, so let the caller proceed.
      return true;
    }
  };

  const checkAndAskLocation = async () => {
    if (Platform.OS === 'ios') {
      return checkAndAskLocationIOS();
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

      // Force a fresh scan rather than returning Android's cached (often
      // stale/partial) scan results. reScanAndLoadWifiList resolves with a
      // string message instead of an array when Android throttles scanning
      // (max 4 scans / 2 min on Android 9+); fall back to the last cached
      // list in that case so the user still sees networks.
      const loadNetworks = async () => {
        // iOS has no public API to enumerate nearby Wi-Fi networks
        // (reScanAndLoadWifiList/loadWifiList are Android-only), so return an
        // empty list — the web falls back to manual SSID entry on iOS.
        if (Platform.OS === 'ios') return [];
        try {
          const fresh = await WifiManager.reScanAndLoadWifiList();
          if (Array.isArray(fresh)) return fresh;
        } catch (e) {
          // fall through to cached results
        }
        return await WifiManager.loadWifiList();
      };

      const [networks, connectedSSID] = await Promise.all([
        loadNetworks(),
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

        case 'SOCIAL_LOGIN':
          handleSocialLogin(message.provider);
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

        case 'BLE_SCAN':
          bleScan();
          break;

        case 'BLE_CONNECT':
          if (message.deviceId) {
            bleConnect(message.deviceId);
          } else {
            sendToWeb({
              action: 'BLE_CONNECT_RESULT',
              success: false,
              error: 'deviceId is required',
            });
          }
          break;

        case 'BLE_SEND_CONFIG':
          console.log("Credentials sending");
          bleSend(message.payload);
          break;

        case 'BLE_DISCONNECT':
          disconnectDevice();
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
          } else {
            openIOSWifiSettings();
          }

          break;

        case 'OPEN_WIFI_SETTINGS_FOR_NO_INTERNET':
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIFI_SETTINGS');
          } else {
            openIOSWifiSettings();
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

  /* -------------------- BLE device provisioning -------------------- */

  // Scan for IAQ_ devices advertising over BLE and return the list to the web app.
  const bleScan = async () => {
    try {
      const devices = await scanForDevices({ timeoutMs: 8000 });
      sendToWeb({ action: 'BLE_SCAN_RESULT', success: true, devices });
    } catch (e) {
      sendToWeb({
        action: 'BLE_SCAN_RESULT',
        success: false,
        devices: [],
        error: e?.message || 'Bluetooth scan failed',
      });
    }
  };

  // Connect to the selected BLE device (discover services + negotiate MTU).
  const bleConnect = async deviceId => {
    try {
      const info = await connectToDevice(deviceId);
      sendToWeb({ action: 'BLE_CONNECT_RESULT', success: true, device: info });
    } catch (e) {
      sendToWeb({
        action: 'BLE_CONNECT_RESULT',
        success: false,
        error: e?.message || 'Failed to connect to device',
      });
    }
  };

  // Write the config payload over BLE and relay the device's notify result.
  const bleSend = async payload => {
    try {
      const result = await bleSendConfig(payload);
      sendToWeb({
        action: 'BLE_SEND_CONFIG_RESULT',
        success: !!result.success,
        internetAvailable: result.internetAvailable,
        message: result.message,
      });
    } catch (e) {
      sendToWeb({
        action: 'BLE_SEND_CONFIG_RESULT',
        success: false,
        error: e?.message || 'Failed to send configuration',
      });
    }
  };

  const sendToWeb = data => {
    console.log('[Native → WebView] Sending:', JSON.stringify(data));
    webviewRef.current?.postMessage(JSON.stringify(data));
  };

  /* -------------------- Native social login -------------------- */
  // Runs the provider SDK natively (providers block OAuth inside WebViews), then
  // returns the access token to the web, which posts it to /social-login and
  // handles the session / organization-setup flow.
  const handleSocialLogin = async provider => {
    try {
      let token;
      let extra = {};

      if (provider === 'google') {
        // hasPlayServices() is an Android/Play-Services-only check.
        if (Platform.OS === 'android') {
          await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
          });
        }
        await GoogleSignin.signIn();
        const tokens = await GoogleSignin.getTokens();
        token = tokens?.accessToken;
      } else if (provider === 'microsoft') {
        const result = await authorize({
          issuer: MICROSOFT.issuer,
          clientId: MICROSOFT.clientId,
          redirectUrl: MICROSOFT.redirectUrl,
          scopes: MICROSOFT.scopes,
        });
        token = result?.accessToken;
      } else if (provider === 'apple') {
        // Sign in with Apple has no native SDK on Android; App Store guideline
        // 4.8 only requires offering it on iOS anyway.
        if (Platform.OS !== 'ios') {
          sendToWeb({
            action: 'SOCIAL_LOGIN_RESULT',
            provider,
            success: false,
            error: 'Apple Sign-In is only available on iOS',
          });
          return;
        }
        if (!appleAuth.isSupported) {
          sendToWeb({
            action: 'SOCIAL_LOGIN_RESULT',
            provider,
            success: false,
            error: 'Sign in with Apple is not supported on this device',
          });
          return;
        }
        const appleResponse = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        });
        token = appleResponse?.identityToken;
        // Apple only returns the user's email/name on the very first
        // authorization for a given Apple ID — pass them along now so the
        // backend can capture them before they're gone for good.
        const nameParts = [
          appleResponse?.fullName?.givenName,
          appleResponse?.fullName?.middleName,
          appleResponse?.fullName?.familyName,
        ].filter(Boolean);
        extra = {
          authorizationCode: appleResponse?.authorizationCode || undefined,
          email: appleResponse?.email || undefined,
          fullName: nameParts.length ? nameParts.join(' ') : undefined,
        };
      } else {
        sendToWeb({
          action: 'SOCIAL_LOGIN_RESULT',
          provider,
          success: false,
          error: 'Unknown provider',
        });
        return;
      }

      if (!token) {
        sendToWeb({
          action: 'SOCIAL_LOGIN_RESULT',
          provider,
          success: false,
          error: 'No token received',
        });
        return;
      }

      sendToWeb({
        action: 'SOCIAL_LOGIN_RESULT',
        provider,
        success: true,
        token,
        ...extra,
      });
    } catch (e) {
      sendToWeb({
        action: 'SOCIAL_LOGIN_RESULT',
        provider,
        success: false,
        error: e?.message || 'Login failed',
      });
    }
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
        // Look up the connected network's frequency (band) from the cached scan
        // list so the web can decide whether to auto-fill it (2.4 GHz only).
        // loadWifiList is Android-only and iOS exposes no public API for the
        // Wi-Fi band, so assume 2.4 GHz on iOS (2437 MHz = channel 6) — the
        // provisioned ESP device is 2.4 GHz-only and reports back over BLE if
        // the network can't actually be joined.
        let frequency = Platform.OS === 'ios' ? 2437 : null;
        if (Platform.OS === 'android') {
          try {
            const list = await WifiManager.loadWifiList();
            if (Array.isArray(list)) {
              const match = list.find(n => n.SSID === connectedSSID);
              if (match && typeof match.frequency === 'number') {
                frequency = match.frequency;
              }
            }
          } catch (e) {
            // Ignore — band unknown; the web simply won't auto-fill.
          }
        }
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: true,
          currentWifi: {
            ssid: connectedSSID,
            frequency,
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
          message: 'SmartEco Enterprise needs storage access to save downloaded files.',
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
  // to the public Downloads folder. Android only.
  const handleDownloadFile = async ({ fileName, mimeType, data }) => {
    if (Platform.OS !== 'android') return;

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
    if (Platform.OS !== 'android') return;

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
    if (Platform.OS !== 'android') return;

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

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top},
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
        source={{ uri: 'https://app.smarteco.ai/SmartecoAvd' }}
        style={[styles.webview, { backgroundColor: '#fff' }]}
        contentInsetAdjustmentBehavior="never"
        androidLayerType="hardware"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        domStorageEnabled={true}
        javaScriptEnabled={true}
        startInLoadingState={true}
        // Camera access for the in-web QR scanner: play the camera stream inline
        // (not fullscreen) and don't require a user gesture to start it. iOS also
        // needs NSCameraUsageDescription (Info.plist); Android needs the CAMERA
        // manifest permission — both are in place.
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // iOS: auto-grant the WKWebView getUserMedia request for our trusted web
        // app so the QR scanner starts without a second WebKit-level prompt. The
        // OS camera permission prompt (from NSCameraUsageDescription) still shows
        // once. Android grants via the native WebChromeClient automatically.
        mediaCapturePermissionGrantType="grant"
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#0F796B" />
            <Text style={styles.loadingText}>Loading SmartEco Enterprise...</Text>
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
        injectedJavaScript={injectedAutoZoomFix}
        onNavigationStateChange={navState => {
          setCanGoBack(navState.canGoBack);
        }}
      />
      {isLoading && !showSplash && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0F796B" />
          <Text style={styles.loadingText}>Loading SmartEco Enterprise...</Text>
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
            allowingReadAccessToURL={ONBOARDING_READ_ACCESS}
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
