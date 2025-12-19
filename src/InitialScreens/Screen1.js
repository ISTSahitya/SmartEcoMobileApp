import React from 'react'
import { View, Text, Pressable } from 'react-native'
import InitialScreensStyles from '../styles/InitialScreensStyles'
import GradientNextButton from './GradientNextButton'
import LinearGradient from 'react-native-linear-gradient';
import Carousel from './Carousel.js'

function Screen1({ navigation }) {

  return (
    <LinearGradient
      colors={["#C4DBD8", "#FFFFFF"]}
      start={{ x: 0, y: 0 }}   // top
      end={{ x: 0, y: 1 }}     // bottom
      style={InitialScreensStyles.container}
    >

      <View style={InitialScreensStyles.header}>
        <Text style={InitialScreensStyles.pageHeading}>Welcome to SmartEco!</Text>
        <Text style={InitialScreensStyles.pageDescription}>Your all-in-one platform to monitor, control, and optimize your smart devices.</Text>
      </View>

      <Carousel currentScreen={0} />

      <View style={InitialScreensStyles.buttonContainer}>

        <Pressable onPress={() => navigation.replace("screen4")}>
          <Text style={InitialScreensStyles.skipButton}>Skip</Text>
        </Pressable>

        <GradientNextButton title='Next' onPress={() => navigation.replace("screen2")} />

      </View>
    </LinearGradient>
  );
};

export default Screen1