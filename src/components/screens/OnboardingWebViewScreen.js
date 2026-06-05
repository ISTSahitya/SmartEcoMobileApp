import React, { useRef, useEffect } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import WebView from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNBootSplash from "react-native-bootsplash";

// Loads from bundled Android assets — no server needed
const ONBOARDING_URI = "file:///android_asset/onboarding/index.html";

export default function OnboardingWebViewScreen({ navigation }) {
  const webViewRef = useRef(null);

  useEffect(() => {
    // Hide native boot splash — Lovable HTML has its own splash
    RNBootSplash.hide({ fade: true });
  }, []);

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ONBOARDING_DONE") {
        await AsyncStorage.setItem("ONBOARDING_DONE", "true");
        navigation.replace("WebView");
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <WebView
        ref={webViewRef}
        source={{ uri: ONBOARDING_URI }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        onMessage={handleMessage}
        originWhitelist={["*"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafffe",
  },
  webview: {
    flex: 1,
  },
});
