import React, { useRef, useState, useEffect } from 'react';
import { PermissionsAndroid, BackHandler, Alert, Linking, Platform, StatusBar, View, NativeModules, ActivityIndicator, Text } from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
const { VpnModule, LocationPermissionModule } = NativeModules;
const WEB_APP_URL = 'https://app.smarteco.ai/smartecoiaq/';
const WEB_APP_SOURCE = { uri: WEB_APP_URL };
const OAUTH_CALLBACK_SCHEMES = ['smarteco://', 'smart://'];
let webViewCanGoBack = false;

const isOAuthCallbackUrl = url => {
  const normalizedUrl = url?.toLowerCase();
  return OAUTH_CALLBACK_SCHEMES.some(scheme => normalizedUrl?.startsWith(scheme));
};

const WebViewScreen = () => {
  const insets = useSafeAreaInsets();
  const [canGoBack] = useState(false);
  const [webSourceUri, setWebSourceUri] = useState(WEB_APP_URL);
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [hasLoadedPage, setHasLoadedPage] = useState(false);
  const pendingOAuthMessageRef = useRef(null);
  const hasRequestedIosLocationRef = useRef(false);
  const hasShownIosLocationAlertRef = useRef(false);

  /* deeplink setup for oauth login */
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (isOAuthCallbackUrl(url)) {
        handleOAuthCallback(url);
      }
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      if (isOAuthCallbackUrl(url)) {
        handleOAuthCallback(url);
      }
    });

    return () => {
      urlSubscription.remove();
    };
}, []);

  // 
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (webViewCanGoBack || canGoBack) {
          webviewRef.current?.goBack();
          return true;
        }
        return false; // allow app exit
      }
    );

  return () => backHandler.remove();
}, []);

  const webviewRef = useRef(null);
  const checkAndAskLocation = async ({ showAlert = true } = {}) => {
    if (Platform.OS === 'ios') {
      hasRequestedIosLocationRef.current = true;
      const granted = await LocationPermissionModule?.request?.();
      if (!granted && showAlert && !hasShownIosLocationAlertRef.current) {
        hasShownIosLocationAlertRef.current = true;
        Alert.alert(
          'Permission Required',
          'Please allow Location Permission to detect your current Wi-Fi network.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ],
        );
      }
      return !!granted;
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
  const requestWifiScan = async () => {
    try {
      const locationReady = await checkAndAskLocation();
      if (!locationReady) return;

      // 3️⃣ Now scan WiFi
      const connectedSSID = await getCurrentWifiInfo();
      if (connectedSSID.ssid) {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: true,
          currentWifi: {
            ssid: connectedSSID.ssid,
          }
        });
      } else {
        sendToWeb({
          action: "WIFI_CONNECT_RESULT",
          currentWifi: {
            ssid: "No wifi connected"
          },
          success: false,
          error: 'Connection failed. Please try again...'
        })
      }
    } catch (e) {
      sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: false,
          error: 'Connection timeout. Please try again...'
        });
    }
  };

  // const onWebMessage = event => {
  //   try {
  //     const message = JSON.parse(event.nativeEvent.data);
  //     if (message.action === 'SCAN_WIFI') {
  //       requestWifiScan();
  //     }
  //   } catch (err) {
  //     console.log('Bad message from web:', err);
  //   }
  // };

  const onWebMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.action) {
        case 'APP_VERSION_INFO':
          lastVersionData.current = message.data;
          handleVersionData(message.data);
          break;

        case 'SCAN_WIFI':
          requestWifiScan();
          break;

        case 'GET_SYSTEM_STATUS':
          const interval = setInterval(async () => {
            const systemStatus = await getSystemStatus();
            if (systemStatus.success && systemStatus.locationPermission && !systemStatus.mobileData && !systemStatus.isVpnOn) {
              clearInterval(interval);
            }
          }, 3000);
          break;

        // case 'CONNECT_WIFI':
        //   if (message.ssid) {
        //     const { ssid, password } = message;
        //     connectToWifi(ssid, password);
        //   } else {
        //     sendToWeb({
        //       action: 'WIFI_CONNECT_RESULT',
        //       success: false,
        //       error: 'SSID and password required',
        //     });
        //   }
        //   break;

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
                onPress: () => Linking.openURL('app-settings:'),
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
                onPress: () => Linking.openURL('app-settings:'),
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
        action: "DEVICE_WIFI_CONNECTED",
        currentWifi: {
          ssid: connectedSSID
        },
        success: true
      })
    } else {
      sendToWeb({
        action: "DEVICE_WIFI_CONNECTED",
        currentWifi: {
          ssid: "No wifi connected"
        },
        success: false,
        error: 'Connection failed. Please try again...'
      })
    }
  };

  const handleOAuthCallback = url => {
    try {
      console.log("OAuth callback received:", url);

      const parsedUrl = new URL(url);
      const token = parsedUrl.searchParams.get("token");
      const error = parsedUrl.searchParams.get("error");
      const state = parsedUrl.searchParams.get("state");
      const code = parsedUrl.searchParams.get("code");
      const webCallbackUrl = buildWebOAuthCallbackUrl(url);

      if (error) {
        setWebSourceUri(webCallbackUrl);
        sendToWeb({ type: "OAUTH_ERROR", action: "OAUTH_ERROR", error }, true);
        return;
      }

      if (token || code) {
        setWebSourceUri(webCallbackUrl);
        sendToWeb({
          type: "OAUTH_SUCCESS",
          action: "OAUTH_SUCCESS",
          access_token: token || undefined,
          token: token || undefined,
          code: code || undefined,
          state: state || undefined,
        }, true);
      }
    } catch (e) {
      console.log("OAuth callback parse error:", e);
      sendToWeb({ type: "OAUTH_ERROR", action: "OAUTH_ERROR", error: 'Internal server error' }, true);
    }
  };

  const buildWebOAuthCallbackUrl = callbackUrl => {
    const queryIndex = callbackUrl.indexOf('?');
    const hashIndex = callbackUrl.indexOf('#');
    const query = queryIndex >= 0 ? callbackUrl.slice(queryIndex, hashIndex >= 0 ? hashIndex : undefined) : '';
    const hash = hashIndex >= 0 ? callbackUrl.slice(hashIndex) : '';

    return `${WEB_APP_URL}oauth-success${query}${hash}`;
  };

  const sendToWeb = (data, retryOnLoad = false) => {
    const payload = JSON.stringify(data);
    if (retryOnLoad) {
      pendingOAuthMessageRef.current = payload;
    }
    webviewRef.current?.postMessage(payload);
  };

  const handleWebViewLoadEnd = () => {
    setIsWebViewLoading(false);
    setHasLoadedPage(true);

    if (pendingOAuthMessageRef.current) {
      webviewRef.current?.postMessage(pendingOAuthMessageRef.current);
      pendingOAuthMessageRef.current = null;
    }
  };

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

  const getMobileDataStatus = async () => {
    try {
      if (!NativeModules.MobileDataModule?.isMobileDataEnabled) {
        return {
          isMobileDataEnabled: false,
        };
      }

      const isMobileDataEnabled = await NativeModules.MobileDataModule.isMobileDataEnabled();
      return {
        isMobileDataEnabled,
      };
    } catch (e) {
      console.log("Error while getting mobile data status", e?.message ?? e);
      return {
        isMobileDataEnabled: false,
        error: e.toString(),
      };
    }
  };

  const checkLocationPermission = async () => {
    try {
      if (Platform.OS === 'ios') {
        return !!(await LocationPermissionModule?.check?.());
      }

      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted;
    } catch (err) {
      return false;
    }
  };

  const checkVpn = async () => {
    if (!VpnModule?.isVpnActive) {
      return false;
    }

    const isVpnActive = await VpnModule.isVpnActive();
    return isVpnActive;
  };

  const getSystemStatus = async () => {
    try {
      let locationPermission;

      if (Platform.OS === 'ios') {
        locationPermission = hasRequestedIosLocationRef.current
          ? await checkLocationPermission()
          : await checkAndAskLocation({ showAlert: false });
      } else {
        locationPermission = await checkLocationPermission();
      }

      const mobileDataStatus = await getMobileDataStatus();
      const isVpnOn = await checkVpn();


      sendToWeb({
        action: 'SYSTEM_STATUS',
        data: {
          locationPermission,
          mobileData: mobileDataStatus.isMobileDataEnabled,
          isVpnOn
        },
      });
      return {
        success: true,
        locationPermission,
        mobileData: mobileDataStatus.isMobileDataEnabled,
        isVpnOn
      }
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

  // const connectToWifi = async (ssid, password) => {
  //   try {
  //     const locationReady = await checkAndAskLocation();
  //     if (!locationReady) {
  //       sendToWeb({
  //         action: 'WIFI_CONNECT_RESULT',
  //         success: false,
  //         error: 'Location permission required',
  //       });
  //       return;
  //     }

  //     // Connect to WiFi
  //     await WifiManager.connectToProtectedSSID(ssid, password, false, false);

  //     // Wait a bit and verify connection
  //     setTimeout(async () => {
  //       const connectedSSID = await WifiManager.getCurrentWifiSSID();
  //       const success = connectedSSID === ssid;

  //       sendToWeb({
  //         action: 'WIFI_CONNECT_RESULT',
  //         success,
  //         currentWifi: {
  //           ssid: connectedSSID,
  //           password: password,
  //           note: "Wifi details"
  //         },
  //         message: success
  //           ? `Connected to ${ssid}`
  //           : 'Connection failed or timed out',
  //       });
  //     }, 3000);
  //   } catch (e) {
  //     sendToWeb({
  //       action: 'WIFI_CONNECT_RESULT',
  //       success: false,
  //       error: e.toString(),
  //     });
  //   }
  // };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <WebView
        ref={webviewRef}
        originWhitelist={['http://*', 'https://*', 'smarteco://*', 'smart://*']}
        mixedContentMode="always"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        setSupportMultipleWindows={false}
        onMessage={onWebMessage}
        source={webSourceUri === WEB_APP_URL ? WEB_APP_SOURCE : { uri: webSourceUri }}
        style={styles.webview}
        contentInsetAdjustmentBehavior="automatic"
        onLoadStart={() => setIsWebViewLoading(true)}
        onLoadEnd={handleWebViewLoadEnd}
        onShouldStartLoadWithRequest={request => {
          console.log('[WebView request]', request.url);

          if (isOAuthCallbackUrl(request.url)) {
            handleOAuthCallback(request.url);
            return false;
          }

          return true;
        }}
        onNavigationStateChange={(navState) => {
          console.log('[WebView nav]', navState.url);
          webViewCanGoBack = navState.canGoBack;
        }}
       
      />
      {isWebViewLoading && (
        <View style={[styles.loaderOverlay, hasLoadedPage && styles.loaderOverlayAfterFirstLoad]}>
          <ActivityIndicator size="large" color="#15947f" />
          {!hasLoadedPage && <Text style={styles.loaderText}>Loading SmartEco...</Text>}
        </View>
      )}
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
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loaderOverlayAfterFirstLoad: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  loaderText: {
    marginTop: 14,
    color: '#4b5b67',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default WebViewScreen;
