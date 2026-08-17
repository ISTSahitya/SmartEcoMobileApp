import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import GoogleSignIn
// react-native-app-auth's podspec has no explicit module_name, so CocoaPods
// derives it from the pod name "react-native-app-auth" by replacing hyphens
// with underscores (same rule that gives React_RCTAppDelegate its name above).
// If this fails to resolve once you build on macOS, check
// Pods/Target Support Files/react-native-app-auth/ for the actual generated
// module name and swap it in here.
import react_native_app_auth

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RNAppAuthAuthorizationFlowManager {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // react-native-app-auth (Microsoft login): retains the in-flight
  // authorization session so the redirect below can resume it.
  public weak var authorizationFlowManagerDelegate: RNAppAuthAuthorizationFlowManagerDelegate?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "SmartEco",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Routes the Microsoft (AppAuth) redirect and the Google Sign-In callback,
  // then falls back to RN's Linking handler for the app's own smarteco://
  // deep links.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if let authorizationFlowManagerDelegate = self.authorizationFlowManagerDelegate,
       authorizationFlowManagerDelegate.resumeExternalUserAgentFlow(with: url) {
      return true
    }
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
       let delegate = authorizationFlowManagerDelegate,
       let url = userActivity.webpageURL,
       delegate.resumeExternalUserAgentFlow(with: url) {
      return true
    }
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
