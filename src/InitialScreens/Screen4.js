import React from 'react'
import { View, Text, Pressable } from 'react-native'
import InitialScreensStyles from '../styles/InitialScreensStyles'
import AsyncStorage from '@react-native-async-storage/async-storage'
import LinearGradient from 'react-native-linear-gradient';
import GradientNextButton from './GradientNextButton'
import Carousel from './Carousel.js'



function Screen4({ navigation }) {

    const handleStartClick = async () => {
        await AsyncStorage.setItem("ONBOARDING_DONE", "true");
        navigation.replace("WebView");
    };

    return (
        <LinearGradient
            colors={["#C4DBD8", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}   // top
            end={{ x: 0, y: 1 }}     // bottom
            style={InitialScreensStyles.container}
        >
            <View style={InitialScreensStyles.header}>
                <Text style={InitialScreensStyles.pageHeading}>Instant Notifications</Text>
                <Text style={InitialScreensStyles.pageDescription}>Stay informed with automatic alerts when something needs your attention.</Text>
            </View>

            <Carousel currentScreen={3} />

            <View style={[InitialScreensStyles.buttonContainer, {justifyContent: 'center'}]}>
                <GradientNextButton title='Get Started' onPress={handleStartClick} />
            </View>
        </LinearGradient>
    );
};

export default Screen4