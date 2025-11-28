import React, { useState, useEffect } from "react";
import { View } from "react-native";
import StepWhite from "./StepWhite";
import StepDropCircle from "./StepDropCircle";
import StepExpandCircle from "./StepExpandCircle";
import StepGradient from "./gradient";
import StepText from "./StepText";
import StepLogo from "./StepLogo";
import RNBootSplash from "react-native-bootsplash";
export default function SplashController({ navigation }) {

  const [step, setStep] = useState(1);

  useEffect(() => {

    // setTimeout(() => setStep(2), 300);       // white → drop circle
    // setTimeout(() => setStep(3), 3000);      // drop → expand
    // setTimeout(() => setStep(4), 6000);      // expand → full bg
    // setTimeout(() => setStep(5), 6500);      // show text
    // setTimeout(() => setStep(6), 8000);      // show logo animation
    // setTimeout(() => navigation.replace("Login"), 5500); 
  }, []);
  useEffect(() => {
    const init = async () => {
      // Add your loading tasks here:
      // - Load fonts
      // - Fetch initial data
      // - Check authentication
      // - Initialize services
 RNBootSplash.hide({ fade: true });
      // Example: Simulate loading for 2 seconds
     // await new Promise(resolve => setTimeout(resolve, 2000));
    };

    init().finally(() => {
      // Hide splash screen when everything is ready
     
      setTimeout(() => setStep(2), 300);       // white → drop circle
      setTimeout(() => setStep(3), 3000);      // drop → expand
      setTimeout(() => setStep(4), 6000);      // expand → full bg
      setTimeout(() => setStep(5), 6500);
      setTimeout(() => navigation.replace("WebView"), 9500);
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {step === 1 && <StepWhite />}
      {step === 2 && <StepDropCircle />}
      {step === 3 && <StepExpandCircle />}
      {step === 4 && <StepGradient />}
      {step === 5 && <StepText />}
      {/* {step === 6 && <StepLogo />} */}
    </View>
  );
}
