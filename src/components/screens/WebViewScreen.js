import React, { useRef, useState, useEffect } from 'react';
import { PermissionsAndroid, BackHandler, Alert, Linking } from 'react-native';
import { StyleSheet, SafeAreaView } from 'react-native';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';

const WebViewScreen = () => {
  const [history, setHistory] = useState([]);
  const [currentUrl, setCurrentUrl] = useState(null);
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
  }, [history, currentUrl]);
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
  const requestWifiScan = async () => {
    try {
      const locationReady = await checkAndAskLocation();
      if (!locationReady) return;

      // 3️⃣ Now scan WiFi
      const wifiList = await WifiManager.loadWifiList();
      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        networks: wifiList,
      });
    } catch (e) {
      sendToWeb({ error: e.toString() });
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
          getSystemStatus();
          break;

        case 'CONNECT_WIFI':
          if (message.ssid) {
            connectToWifi(message.ssid);
          } else {
            sendToWeb({
              action: 'WIFI_CONNECT_RESULT',
              success: false,
              error: 'SSID and password required',
            });
          }
          break;

        default:
          console.log('Unknown action:', message.action);
      }
    } catch (err) {
      console.log('Bad message from web:', err);
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
      const state = await NetInfo.fetch();
      return {
        isMobileDataEnabled: state.type === 'cellular' && state.isConnected,
        connectionType: state.type,
        isConnected: state.isConnected,
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
      const wifiInfo = await getCurrentWifiInfo();
      // const mobileDataStatus = await getMobileDataStatus();

      sendToWeb({
        action: 'SYSTEM_STATUS',
        data: {
          locationPermission,
          currentWifi: wifiInfo,
          // mobileData: mobileDataStatus,
        },
      });
    } catch (e) {
      sendToWeb({
        action: 'SYSTEM_STATUS',
        error: e.toString(),
      });
    }
  };

  const connectToWifi = async (ssid) => {
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

      // Connect to WiFi
      await WifiManager.connectToProtectedSSID(ssid,'12345678',false, false);

      // Wait a bit and verify connection
      setTimeout(async () => {
        const connectedSSID = await WifiManager.getCurrentWifiSSID();
        const success = connectedSSID === ssid;

        sendToWeb({
          action: 'WIFI_CONNECT_RESULT',
          success,
          ssid: connectedSSID,
          message: success
            ? `Connected to ${ssid}`
            : 'Connection failed or timed out',
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

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webviewRef}
        mixedContentMode="always"
        onMessage={onWebMessage}
        source={{ uri: 'https://atlas.smartgeoapps.com/smartecodev' }}
        style={{ flex: 1 }}
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
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default WebViewScreen;
