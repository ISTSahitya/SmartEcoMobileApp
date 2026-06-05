import React, { useEffect } from "react";
import { View, StyleSheet, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNBootSplash from "react-native-bootsplash";

export default function SplashController({ navigation }) {
  useEffect(() => {
    const init = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem("ONBOARDING_DONE");
        RNBootSplash.hide({ fade: true });

        if (onboardingDone === "true") {
          navigation.replace("WebView");
        } else {
          navigation.replace("Onboarding");
        }
      } catch (e) {
        RNBootSplash.hide({ fade: true });
        navigation.replace("Onboarding");
      }
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logo_1.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafffe",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 220,
  },
});
