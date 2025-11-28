/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View,Text } from 'react-native';
import  WebView  from 'react-native-webview';
import AppNavigator from './src/navigation/AppNavigator';
function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    
     
      <AppContent />
  
  );
}

function AppContent() {


  return (
      <View style={{ flex: 1 }}>
      {/* <Text style={{ textAlign: "center", marginTop: 10 }}>
        Hello, Smart Eco!
      </Text> */}
      <AppNavigator />

     
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
