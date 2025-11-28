import React from "react";
import { ImageBackground, StyleSheet } from "react-native";

export default function StepGradient() {
  return (
    <ImageBackground
      source={require("../../assets/images/bg_gradient.png")}
      style={styles.bg}
    />
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
