import React, { useEffect, useRef } from "react";
import { Animated, View, Image } from "react-native";

export default function StepDropCircle() {
  const dropAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.timing(dropAnim, {
      toValue: 400,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Animated.Image
        source={require("../../assets/images/circle_small.png")}
        style={{
          width: 100,
          height: 100,
          alignSelf: "center",
          justifyContent: "center",
          transform: [{ translateY: dropAnim }],
        }}
      />
    </View>
  );
}
