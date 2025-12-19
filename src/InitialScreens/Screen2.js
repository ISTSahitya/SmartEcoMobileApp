import React from 'react'
import { View, Text, Pressable } from 'react-native'
import InitialScreensStyles from '../styles/InitialScreensStyles'
import GradientNextButton from './GradientNextButton'
import LinearGradient from 'react-native-linear-gradient';
import Carousel from './Carousel.js'



function Screen2({ navigation }) {
    return (
        <LinearGradient
            style={InitialScreensStyles.container}
            colors={["#C4DBD8", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}   // top
            end={{ x: 0, y: 1 }}     // bottom
        >
            <View style={InitialScreensStyles.header}>
                <Text style={InitialScreensStyles.pageHeading}>Connect Your Devices</Text>
                <Text style={InitialScreensStyles.pageDescription}>Add and manage Smart Echo devices easily with quick, simple pairing.</Text>
            </View>

            <Carousel />

            <View style={InitialScreensStyles.buttonContainer}>
                <Pressable onPress={() => navigation.replace("screen4")}>
                    <Text style={InitialScreensStyles.skipButton}>Skip</Text>
                </Pressable>

                <GradientNextButton title='Next' onPress={() => navigation.replace("screen3")} />
            </View>
        </LinearGradient>
    );
};

export default Screen2