import React, { useState, useEffect } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import StepWhite from "./StepWhite";
import StepDropCircle from "./StepDropCircle";
import StepExpandCircle from "./StepExpandCircle";
import StepGradient from "./gradient";
import StepText from "./StepText";
import RNBootSplash from "react-native-bootsplash";

export default function SplashController({ navigation }) {
  const [step, setStep] = useState(1);

 useEffect(() => {
  let targetScreen = "WebView"; // default

  const init = async () => {
    const onboardingDone = await AsyncStorage.getItem("ONBOARDING_DONE");
    targetScreen = onboardingDone === "true" ? "WebView" : "Onboarding";
    RNBootSplash.hide({ fade: true });
  };

  init().finally(() => {
    setTimeout(() => setStep(2), 300);
    setTimeout(() => setStep(3), 3000);
    setTimeout(() => setStep(4), 6000);
    setTimeout(() => setStep(5), 6500);

    setTimeout(() => {
      navigation.replace(targetScreen); 
    }, 10000);
  });
}, []);


  return (
    <View style={{ flex: 1 }}>
      {step === 1 && <StepWhite />}
      {step === 2 && <StepDropCircle />}
      {step === 3 && <StepExpandCircle />}
      {step === 4 && <StepGradient />}
      {step === 5 && <StepText />}
    </View>
  );
}
