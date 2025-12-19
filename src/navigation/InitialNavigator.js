import { createNativeStackNavigator } from '@react-navigation/native-stack'
import React from 'react'
import Screen1 from '../InitialScreens/Screen1';
import Screen2 from '../InitialScreens/Screen2';
import Screen3 from '../InitialScreens/Screen3';
import Screen4 from '../InitialScreens/Screen4';


const Stack = createNativeStackNavigator();

function InitialNavigator() {

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 400 }} initialRouteName='screen1' >
      <Stack.Screen name='screen1' component={Screen1} />
      <Stack.Screen name='screen2' component={Screen2} />
      <Stack.Screen name='screen3' component={Screen3} />
      <Stack.Screen name='screen4' component={Screen4} />
    </Stack.Navigator>
  )
}

export default InitialNavigator