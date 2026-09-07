/**
 * @format
 */

import { AppRegistry } from 'react-native';
// Modular API — @react-native-firebase v23 removed the namespaced default
// export, so `import messaging from '...'` yields undefined and the app dies at
// startup. See src/services/pushNotifications.js.
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Push handlers for when the app is backgrounded or killed.
 *
 * These MUST be registered here, at module scope, before
 * AppRegistry.registerComponent — not inside a component. When the app has been
 * killed React never mounts, so a handler registered in a useEffect simply does
 * not exist at the one moment it is needed. Registering them here is what makes
 * the quit-state notification path work at all.
 *
 * Our alert pushes all carry a `notification` block, so the OS draws the tray
 * item without any JS running and the tap is picked up by
 * getInitialNotification / onNotificationOpenedApp in usePushNotifications.
 * These two handlers exist so a future data-only push has somewhere to land,
 * and so notifee does not warn about a missing background event handler.
 */
setBackgroundMessageHandler(getMessaging(), async () => {
  // Nothing to do: the OS has already displayed the notification.
});

notifee.onBackgroundEvent(async ({ type }) => {
  if (type === EventType.PRESS) {
    // The launch intent carries the payload; the app reads it on start.
  }
});

const Root = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <App />
  </GestureHandlerRootView>
);

AppRegistry.registerComponent(appName, () => Root);
