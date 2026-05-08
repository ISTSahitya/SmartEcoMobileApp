import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import InitialScreensStyles from '../styles/InitialScreensStyles'
import GradientNextButton from './GradientNextButton'
import LinearGradient from 'react-native-linear-gradient';
import Carousel from './Carousel.js'



function Screen3({ navigation }) {
    return (
        <LinearGradient
            style={InitialScreensStyles.container}
            colors={["#C4DBD8", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}   // top
            end={{ x: 0, y: 1 }}     // bottom
        >
            <SafeAreaView style={InitialScreensStyles.safeArea} edges={['top', 'bottom']}>
                <View style={InitialScreensStyles.header}>
                    <Text style={InitialScreensStyles.pageHeading}>Real-Time Monitoring</Text>
                    <Text style={InitialScreensStyles.pageDescription}>Track energy usage, environmental conditions, and device performance—all in one dashboard.</Text>
                </View>

            <View style={InitialScreensStyles.carouselSection}>
                <Carousel currentScreen={2} />
            </View>

            <View style={InitialScreensStyles.footer}>
                <View style={InitialScreensStyles.buttonContainer}>
                    <Pressable onPress={() => navigation.replace("screen4")}>
                        <Text style={InitialScreensStyles.skipButton}>Skip</Text>
                    </Pressable>

                        <GradientNextButton title='Next' onPress={() => navigation.replace("screen4")} />
                </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

export default Screen3
