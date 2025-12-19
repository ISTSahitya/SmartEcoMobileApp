import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashLottieScreen from "../components/screens/SplashLottieScreen";
import WebViewScreen from "../components/screens/WebViewScreen";
import SplashController from "../components/Splash/SplashController";
import InitialNavigator from '../navigation/InitialNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName="Splash"
      >
        {/* FIRST SCREEN — Lottie Splash Animation */}
        <Stack.Screen name="Splash" component={SplashController} />

        {/* Onboarding flow (4 screens inside) */}
        <Stack.Screen name="Onboarding" component={InitialNavigator} />

        {/* AFTER SPLASH → WebView (Login Page) */}
        <Stack.Screen name="WebView" component={WebViewScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
