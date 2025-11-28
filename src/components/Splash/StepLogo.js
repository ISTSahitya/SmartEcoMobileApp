import React, { useEffect, useRef } from "react";
import { Animated, ImageBackground, Image } from "react-native";

export default function StepLogo() {
  const dropAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.timing(dropAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <ImageBackground
      source={require("../../assets/images/bg_gradient.png")}
      style={{ flex: 1, justifyContent: "center", alignItems: "center", width: '100%', height: '100%' }}
    >
      <Animated.Image
        source={require("../../assets/images/logo_animation.gif")}
        style={{
          width: 200,
          height: 200,
          transform: [{ translateY: dropAnim }],
        }}
      />
    </ImageBackground>
  );
}
