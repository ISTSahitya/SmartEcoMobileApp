import React, { useEffect, useRef } from "react";
import { Animated, ImageBackground, Dimensions, Text } from "react-native";

export default function StepText() {
  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;

  const gifWidth = screenWidth * 0.45;    // 45% of screen width
  const gifHeight = gifWidth * (796 / 800); // maintain aspect ratio

  const textSlide = useRef(new Animated.Value(screenHeight)).current;
  const gifSlide = useRef(new Animated.Value(-screenHeight)).current;

  const gifFade = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(textSlide, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),

      Animated.timing(gifSlide, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),

      Animated.timing(gifFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(textFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <ImageBackground
      source={require("../../assets/images/bg_gradient.png")}
      style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      resizeMode="cover"
    >
      {/* Animated GIF */}
      <Animated.Image
        source={require("../../assets/images/logo_animation.gif")}
        style={{
          width: gifWidth,
          height: gifHeight,
          opacity: gifFade,
          transform: [{ translateY: gifSlide }],
          marginBottom: 20,
        }}
        resizeMode="contain"
      />

      {/* Animated Text */}
      <Animated.Text
        style={{
          color: "#8FFF44",
          fontSize: 28.79,
          fontWeight: "700",
          opacity: textFade,
          transform: [{ translateY: textSlide }],
        }}
      >
        SmartEco
      </Animated.Text>
    </ImageBackground>
  );
}
