/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

LogBox.ignoreLogs([
  'Open debugger to view warnings',
  'Unable to simultaneously satisfy constraints',
  'Can only set suggestions for an active session',
  'Failed to resolve host network app id to config',
  'WebPageProxy::didFailProvisionalLoadForFrame',
]);

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
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
