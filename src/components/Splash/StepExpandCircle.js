import React, { useEffect, useRef } from "react";
import { Animated, View, Dimensions } from "react-native";

export default function StepExpandCircle() {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1.9,   // reduced scale so it's fully visible
      duration: 2500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.Image
        source={require("../../assets/images/circle_expand.png")}
        style={{
          width: 600,
          height: 600,
          position: "absolute",     // FIX: stays centered while expanding
          transform: [{ scale: scaleAnim }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}
