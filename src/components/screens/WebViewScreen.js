import React, { useRef, useState, useEffect } from 'react';
import { PermissionsAndroid, BackHandler } from 'react-native';
import { StyleSheet, SafeAreaView } from 'react-native';
import WebView from 'react-native-webview';
import WifiManager from 'react-native-wifi-reborn';

const WebViewScreen = () => {
  const webviewRef = useRef(null);
  const requestWifiScan = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        sendToWeb({ error: 'Permission denied' });
        return;
      }

      const wifiList = await WifiManager.loadWifiList();

      sendToWeb({
        action: 'WIFI_SCAN_RESULT',
        networks: wifiList,
      });
    } catch (e) {
      sendToWeb({ error: e.toString() });
    }
  };

  const onWebMessage = event => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.action === 'SCAN_WIFI') {
        requestWifiScan();
      }
    } catch (err) {
      console.log('Bad message from web:', err);
    }
  };

  const sendToWeb = data => {
    webviewRef.current?.postMessage(JSON.stringify(data));
  };
  return (
    <SafeAreaView style={styles.container}>
      <WebView 
        ref={webviewRef}
        onMessage={onWebMessage}
        source={{ uri: 'https://atlas.smartgeoapps.com/smartecodev' }} 
        style={{ flex: 1 }}
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

