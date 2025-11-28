import React from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import WebView from 'react-native-webview';

const WebViewScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <WebView 
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

