// src/screens/SplashLottieScreen.js
import React, { useRef, useEffect } from "react";
import { StyleSheet, Animated, ImageBackground, Dimensions, View } from "react-native";

const { width: screenWidth } = Dimensions.get("window");
const gifWidth = screenWidth * 0.45;
const gifHeight = gifWidth * (796 / 800);

export default function SplashLottieScreen({ navigation }) {
    const gifFade = useRef(new Animated.Value(0)).current;
    const gifSlide = useRef(new Animated.Value(-50)).current;
    const textFade = useRef(new Animated.Value(0)).current;
    const textSlide = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Start animations immediately
        Animated.parallel([
            Animated.timing(gifFade, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(gifSlide, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(textFade, {
                toValue: 1,
                duration: 1000,
                delay: 400,
                useNativeDriver: true,
            }),
            Animated.timing(textSlide, {
                toValue: 0,
                duration: 1000,
                delay: 400,
                useNativeDriver: true,
            }),
        ]).start();

        // Navigate after animation (2.5 seconds)
        const navigateTimer = setTimeout(() => {
            if (navigation) {
                navigation.replace("WebView");
            }
        }, 2500);

        return () => {
            clearTimeout(navigateTimer);
        };
    }, [navigation]);

    return (
        <View style={styles.wrapper}>
            <ImageBackground
                source={require("../../assets/images/bg_gradient.png")}
                style={styles.container}
                resizeMode="cover"
            >
                {/* Animated GIF */}
                <Animated.Image
                    source={require("../../assets/images/logo_animation.gif")}
                    style={[
                        {
                            width: gifWidth,
                            height: gifHeight,
                            opacity: gifFade,
                            transform: [{ translateY: gifSlide }],
                            marginBottom: 20,
                        },
                    ]}
                    resizeMode="contain"
                />

                {/* Animated Text */}
                <Animated.Text
                    style={[
                        styles.text,
                        {
                            opacity: textFade,
                            transform: [{ translateY: textSlide }],
                        },
                    ]}
                >
                    SmartEco
                </Animated.Text>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
    },
    text: {
        color: "#8FFF44",
        fontSize: 28.79,
        fontWeight: "700",
    },
});
