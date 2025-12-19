import React from 'react'
import { Pressable, Text } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import InitialScreensStyles from '../styles/InitialScreensStyles'


function GradientNextButton({ title, onPress}) {
  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={["#0F796B", "#6FDC95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={InitialScreensStyles.nextButton}
      >
        <Text style={InitialScreensStyles.nextButtonText}>
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  )
}

export default GradientNextButton