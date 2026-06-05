import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import OnboardingWebViewScreen from "../components/screens/OnboardingWebViewScreen";
import WebViewScreen from "../components/screens/WebViewScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {

  const linking = {
    prefixes: ["smarteco://"],
    config: {
      screens: {
        WebView: "oauth-success",
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Onboarding"
      >
        {/* Lovable onboarding (splash + 3 screens) loaded via WebView */}
        <Stack.Screen name="Onboarding" component={OnboardingWebViewScreen} />

        {/* Main app WebView */}
        <Stack.Screen name="WebView" component={WebViewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
