import React, { useRef, useState, useEffect } from 'react';
import { BackHandler, Alert, Linking, Platform, StatusBar, View, Text, NativeModules, AppState, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';
import useVersionCheck from '../../hooks/useVersionCheck';
import UpdateModal from '../UpdateModal';

// Android-only: location services dialog (crashes on iOS if imported unconditionally)
const LocationServicesDialogBox = Platform.OS === 'android'
  ? require('react-native-android-location-services-dialog-box').default
  : null;

// Android-only: PermissionsAndroid is a no-op object on iOS
const PermissionsAndroid = Platform.OS === 'android'
  ? require('react-native').PermissionsAndroid
  : null;

const { VpnModule } = NativeModules;

const WebViewScreen = () => {
  const insets = useSafeAreaInsets();
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { modalVisible, updateType, updateData, handleVersionData, dismiss, skipVersion } = useVersionCheck();
  const lastVersionData = useRef(null);

  // Re-check version when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
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
        console.log("Deep link received:", url);
        const parsedUrl = new URL(url);
        const token = parsedUrl.searchParams.get("token");
        const error = parsedUrl.searchParams.get("error");
        const state = parsedUrl.searchParams.get("state");
        const code = parsedUrl.searchParams.get("code");

        if (error) {
          sendToWeb({ type: "OAUTH_ERROR", error });
          return;
        }
        if (token || code) {
          sendToWeb({
            type: "OAUTH_SUCCESS",
            access_token: token || undefined,
            code: code || undefined,
            state: state || undefined,
          });
        }
      } catch (e) {
        console.log("Deep link parse error:", e);
        sendToWeb({ type: "OAUTH_ERROR", error: 'Internal server error' });
      }
    };
    const urlSubscription = Linking.addEventListener('url', handleDeepLink);
    return () => urlSubscription.remove();
  }, []);

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack) {
          webviewRef.current.goBack();
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [canGoBack]);

  const webviewRef = useRef(null);

  // ─── Location / Permission helpers ───────────────────────────────────────────

  const checkAndAskLocation = async () => {
    if (Platform.OS === 'ios') {
      // On iOS, WiFi connection uses NEHotspotConfiguration which shows its own
      // system prompt. SSID reading requires the wifi-info entitlement + location.
      // We return true here and let downstream errors direct the user to Settings.
      return true;
    }

    // Android: request runtime location permission
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

    // Ask user to enable location services via system dialog
    try {
      await LocationServicesDialogBox.checkLocationServicesIsEnabled({
        message: '<h3>Turn On Location</h3>WiFi scanning requires Location to be enabled.',
        ok: 'Turn On',
        cancel: 'Cancel',
        enableHighAccuracy: false,
        showDialog: true,
        openLocationServices: true,
      });
      return true;
    } catch (error) {
      Alert.alert(
        'Enable Location',
        'Location is required to scan WiFi.\nOpen settings?',
        `${error}`,
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return false;
    }
  };

  const checkLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      // iOS WiFi SSID reading is gated by the wifi-info entitlement, not the
      // standard location permission flow used on Android.
      return true;
    }
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    } catch (err) {
      return false;
    }
  };

  // ─── WiFi scan / connect ─────────────────────────────────────────────────────

  const requestWifiScan = async () => {
    try {
      const locationReady = await checkAndAskLocation();
      if (!locationReady) return;

      const connectedSSID = await getCurrentWifiInfo();
      if (connectedSSID.ssid) {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success: true,
          currentWifi: { ssid: connectedSSID.ssid },
        });
      } else {
        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          currentWifi: { ssid: 'No wifi connected' },
          success: false,
          error: connectedSSID.error || 'Connection failed. Please try again...',
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

      // On iOS this triggers a native system prompt via NEHotspotConfiguration.
      // On Android this connects silently using WifiManager.
      await WifiManager.connectToProtectedSSID(ssid, password || '', false, false);

      // Wait and verify the connection settled
      setTimeout(async () => {
        const connectedSSID = await WifiManager.getCurrentWifiSSID();
        const success = connectedSSID === ssid;

        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success,
          currentWifi: { ssid: connectedSSID, note: 'Wifi details' },
          message: success ? `Connected to ${ssid}` : 'Connection failed or timed out',
        });
      }, 3000);
    } catch (e) {
      sendToWeb({
        action: 'WIFI_CONNECT_RESULT',
        success: false,
        error: e.toString(),
      });
    }
  };

  const checkWifiConnection = async () => {
    const connectedSSID = (await getCurrentWifiInfo()).ssid ?? 'Iaq_';
    const isDevice = connectedSSID != null && (
      connectedSSID.startsWith('IAQ_') ||
      connectedSSID.startsWith('iaq_') ||
      connectedSSID.startsWith('Iaq_')
    );

    sendToWeb(
      isDevice
        ? { action: 'DEVICE_WIFI_CONNECTED', currentWifi: { ssid: connectedSSID }, success: true }
        : { action: 'DEVICE_WIFI_CONNECTED', currentWifi: { ssid: 'No wifi connected' }, success: false, error: 'Connection failed. Please try again...' }
    );
  };

  // ─── System status (VPN / mobile data / location) ────────────────────────────

  const getMobileDataStatus = async () => {
    try {
      const isMobileDataEnabled = await NativeModules.MobileDataModule.isMobileDataEnabled();
      return { isMobileDataEnabled };
    } catch (e) {
      console.log('Error getting mobile data status:', e);
      return { isMobileDataEnabled: false, error: e.toString() };
    }
  };

  const checkVpn = async () => {
    try {
      return await VpnModule.isVpnActive();
    } catch (e) {
      console.log('Error checking VPN:', e);
      return false;
    }
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
      return { success: true, locationPermission, mobileData: mobileDataStatus.isMobileDataEnabled, isVpnOn };
    } catch (e) {
      sendToWeb({ action: 'SYSTEM_STATUS', error: e.toString() });
      return { success: false };
    }
  };

  // ─── WiFi info helper ────────────────────────────────────────────────────────

  const getCurrentWifiInfo = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      return { ssid, password: null };
    } catch (e) {
      return { ssid: null, password: null, error: e.toString() };
    }
  };

  // ─── Open settings helpers ───────────────────────────────────────────────────

  const openWifiSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.WIFI_SETTINGS');
    } else {
      // App-Prefs:root=WIFI opens WiFi settings directly on iOS
      Linking.openURL('App-Prefs:root=WIFI').catch(() => {
        Linking.openURL('app-settings:');
      });
    }
  };

  // ─── Message bridge ──────────────────────────────────────────────────────────

  const sendToWeb = data => {
    webviewRef.current?.postMessage(JSON.stringify(data));
  };

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

        case 'GET_SYSTEM_STATUS': {
          const interval = setInterval(async () => {
            const systemStatus = await getSystemStatus();
            if (systemStatus.success && systemStatus.locationPermission && !systemStatus.mobileData && !systemStatus.isVpnOn) {
              clearInterval(interval);
            }
          }, 3000);
          break;
        }

        case 'CONNECT_WIFI':
          if (message.ssid) {
            connectToWifi(message.ssid, message.password);
          } else {
            sendToWeb({ action: 'WIFI_CONNECT_RESULT', success: false, error: 'SSID is required' });
          }
          break;

        case 'OPEN_APP_SETTINGS':
          Linking.openURL('app-settings:');
          break;

        case 'OPEN_WIFI_SETTINGS':
          openWifiSettings();
          // Check connection after user returns from settings
          setTimeout(() => checkWifiConnection(), 6000);
          break;

        case 'OPEN_WIFI_SETTINGS_FOR_NO_INTERNET':
          openWifiSettings();
          break;

        case 'GET_IS_IOS':
          sendToWeb({ action: 'IS_IOS', isIOS: Platform.OS === 'ios' });
          break;

        case 'CHECK_LOCATION':
          checkAndAskLocation();
          break;

        default:
          console.log('Unknown action:', message.action);
      }
    } catch (err) {
      console.log('Bad message from web:', err);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <WebView
        ref={webviewRef}
        mixedContentMode="always"
        onMessage={onWebMessage}
        source={{ uri: 'https://atlas.smartgeoapps.com/Smartecodev/' }}
        style={[styles.webview, { backgroundColor: '#fff' }]}
        contentInsetAdjustmentBehavior="automatic"
        androidLayerType="hardware"
        webviewDebuggingEnabled={true}
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
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        onHttpError={() => setIsLoading(false)}
        injectedJavaScriptBeforeContentLoaded={`
          document.documentElement.style.backgroundColor = '#fff';
          document.addEventListener('DOMContentLoaded', function() {
            document.body.style.backgroundColor = '#fff';
          });
          true;
        `}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0F796B" />
          <Text style={styles.loadingText}>Loading SmartEco...</Text>
        </View>
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
});

export default WebViewScreen;
