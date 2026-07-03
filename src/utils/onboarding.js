import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

// The onboarding splash is bundled locally on both platforms (no server):
//  - Android serves it from the packaged assets dir (file:///android_asset/...).
//  - iOS copies the same folder into the app bundle (see the "onboarding"
//    folder reference in Copy Bundle Resources), so we build a file:// URL into
//    the main bundle. The bundle path can contain spaces (the app is
//    "SmartEco Enterprise.app"), which break NSURL URLWithString, so the space
//    is percent-encoded.
const iosBundleDir = (
  ReactNativeBlobUtil?.fs?.dirs?.MainBundleDir || ''
).replace(/ /g, '%20');

export const ONBOARDING_BASE_URI =
  Platform.OS === 'ios'
    ? `file://${iosBundleDir}/onboarding/index.html`
    : 'file:///android_asset/onboarding/index.html';

// iOS WKWebView needs explicit read access to the bundle directory so the
// bundled index.html can load its sibling images. Undefined on Android.
export const ONBOARDING_READ_ACCESS =
  Platform.OS === 'ios' ? `file://${iosBundleDir}` : undefined;
