import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import WebViewScreen from "../components/screens/WebViewScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("ONBOARDING_DONE").then((value) => {
      setIsReturningUser(value === "true");
      setIsReady(true);
    });
  }, []);

  const linking = {
    prefixes: ["smarteco://", "smart://", "Smart://"],
    config: {
      screens: {
        WebView: "oauth-success",
      },
    },
  };

  // Wait until AsyncStorage check completes
  if (!isReady) return null;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="WebView"
          component={WebViewScreen}
          initialParams={{ splashOnly: isReturningUser }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
