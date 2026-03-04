import React, { useRef, useState, useEffect } from 'react';
import { PermissionsAndroid, BackHandler, Alert, Linking, Platform, StatusBar, View } from 'react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import NetInfo from "@react-native-community/netinfo";
import { NativeModules } from 'react-native';

const WebViewScreen = () => {
  const insets = useSafeAreaInsets();
  const [canGoBack, setCanGoBack] = useState(false);

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
    }
     catch (e) {
      console.log("Deep link parse error:", e);
      sendToWeb({ type: "OAUTH_ERROR", error : 'Internal server error' });
    }
  }
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
      }
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
        case 'SCAN_WIFI':
          requestWifiScan();
          break;

        case 'GET_SYSTEM_STATUS':
          const interval = setInterval(async () => {
            const systemStatus = await getSystemStatus();
            if (systemStatus.success && systemStatus.locationPermission && !systemStatus.mobileData) {
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

  const sendToWeb = data => {
    webviewRef.current?.postMessage(JSON.stringify(data));
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
      const isMobileDataEnabled = await NativeModules.MobileDataModule.isMobileDataEnabled();
      return {
        isMobileDataEnabled,
      };
    } catch (e) {
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

  const getSystemStatus = async () => {
    try {
      const locationPermission = await checkLocationPermission();
      const mobileDataStatus = await getMobileDataStatus();
      console.log("mobileDataStatus", mobileDataStatus);
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
        mobileData: mobileDataStatus.isMobileDataEnabled
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
        mixedContentMode="always"
        onMessage={onWebMessage}
        source={{ uri: 'https://atlas.smartgeoapps.com/smartecodev' }}
        style={styles.webview}
        contentInsetAdjustmentBehavior="automatic"
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        // onError={(e) => {
        //   console.log("WEBVIEW ERROR", e.nativeEvent);
        // }}
        // onHttpError={(e) => {
        //   console.log("HTTP ERROR", e.nativeEvent);
        // }}
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
});

export default WebViewScreen;
