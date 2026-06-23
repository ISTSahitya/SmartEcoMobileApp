#import <React/RCTBridgeModule.h>
#import <NetworkExtension/NetworkExtension.h>

@interface WifiConnectModule : NSObject <RCTBridgeModule>
@end

@implementation WifiConnectModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(connectToNetwork:(NSString *)ssid
                  password:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSLog(@"[WifiConnectModule] connectToNetwork ssid=%@", ssid);

  NEHotspotConfiguration *config;
  if (password != nil && password.length > 0) {
    config = [[NEHotspotConfiguration alloc] initWithSSID:ssid passphrase:password isWEP:NO];
  } else {
    config = [[NEHotspotConfiguration alloc] initWithSSID:ssid];
  }
  // joinOnce = YES: temporarily join for this session only, not saved to device
  config.joinOnce = YES;

  [[NEHotspotConfigurationManager sharedManager] applyConfiguration:config completionHandler:^(NSError *error) {
    if (error == nil) {
      NSLog(@"[WifiConnectModule] connected to %@", ssid);
      resolve(@{ @"success": @YES, @"message": @"Connected to network" });
      return;
    }

    // NEHotspotConfigurationErrorAlreadyAssociated means the device is already on this SSID
    if ([error.domain isEqualToString:NEHotspotConfigurationErrorDomain] &&
        error.code == NEHotspotConfigurationErrorAlreadyAssociated) {
      NSLog(@"[WifiConnectModule] already associated to %@", ssid);
      resolve(@{ @"success": @YES, @"message": @"Already connected to network" });
      return;
    }

    // User explicitly tapped "Don't Join" — no point polling, fail immediately.
    if ([error.domain isEqualToString:NEHotspotConfigurationErrorDomain] &&
        error.code == NEHotspotConfigurationErrorUserDenied) {
      NSLog(@"[WifiConnectModule] user denied connection to %@", ssid);
      reject(@"wifi_connect_user_denied", @"User denied the Wi-Fi connection", error);
      return;
    }

    NSString *errorMessage = error.localizedDescription ?: @"Failed to connect to WiFi network";
    NSLog(@"[WifiConnectModule] error code=%ld domain=%@ message=%@",
          (long)error.code, error.domain, errorMessage);
    reject(@"wifi_connect_failed", errorMessage, error);
  }];
}

RCT_EXPORT_METHOD(connectToHomeNetwork:(NSString *)ssid
                  password:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSLog(@"[WifiConnectModule] connectToHomeNetwork ssid=%@", ssid);

  NEHotspotConfiguration *config;
  if (password != nil && password.length > 0) {
    config = [[NEHotspotConfiguration alloc] initWithSSID:ssid passphrase:password isWEP:NO];
  } else {
    config = [[NEHotspotConfiguration alloc] initWithSSID:ssid];
  }
  // joinOnce = NO: persist the connection (home wifi, not a temporary device hotspot)
  config.joinOnce = NO;

  [[NEHotspotConfigurationManager sharedManager] applyConfiguration:config completionHandler:^(NSError *error) {
    if (error == nil) {
      NSLog(@"[WifiConnectModule] connectToHomeNetwork connected to %@", ssid);
      resolve(@{ @"success": @YES, @"message": @"Connected to network" });
      return;
    }

    if ([error.domain isEqualToString:NEHotspotConfigurationErrorDomain] &&
        error.code == NEHotspotConfigurationErrorAlreadyAssociated) {
      NSLog(@"[WifiConnectModule] connectToHomeNetwork already on %@", ssid);
      resolve(@{ @"success": @YES, @"message": @"Already connected to network" });
      return;
    }

    if ([error.domain isEqualToString:NEHotspotConfigurationErrorDomain] &&
        error.code == NEHotspotConfigurationErrorUserDenied) {
      NSLog(@"[WifiConnectModule] connectToHomeNetwork user denied connection to %@", ssid);
      reject(@"wifi_connect_home_user_denied", @"User denied the home Wi-Fi connection", error);
      return;
    }

    NSString *errorMessage = error.localizedDescription ?: @"Failed to connect to WiFi network";
    NSLog(@"[WifiConnectModule] connectToHomeNetwork error code=%ld domain=%@ message=%@",
          (long)error.code, error.domain, errorMessage);
    reject(@"wifi_connect_failed", errorMessage, error);
  }];
}

RCT_EXPORT_METHOD(disconnectFromNetwork:(NSString *)ssid
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSLog(@"[WifiConnectModule] disconnectFromNetwork ssid=%@", ssid);
  // iOS has no public API to force an immediate WiFi disconnect.
  // Removing the config prevents iOS from auto-rejoining; the active
  // association drops naturally when the device reboots after provisioning.
  [[NEHotspotConfigurationManager sharedManager] removeConfigurationForSSID:ssid];
  NSLog(@"[WifiConnectModule] removed hotspot config for %@", ssid);
  resolve(@{ @"success": @YES });
}

@end
