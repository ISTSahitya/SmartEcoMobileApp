import React, { useRef, useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import useVersionCheck from '../../hooks/useVersionCheck';
import UpdateModal from '../UpdateModal';

const { VpnModule } = NativeModules;

const WebViewScreen = () => {
  const insets = useSafeAreaInsets();
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const {
    modalVisible,
    updateType,
    updateData,
    handleVersionData,
    dismiss,
    skipVersion,
  } = useVersionCheck();
  const lastVersionData = useRef(null);

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

      switch (message.action) {
        case 'APP_VERSION_INFO':
          lastVersionData.current = message.data;
          handleVersionData(message.data);
          break;

        case 'SCAN_WIFI':
          requestWifiScan();
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
        source={{ uri: 'https://default-libs-helped-updates.trycloudflare.com/smartecodev/' }}
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
        onNavigationStateChange={navState => {
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
