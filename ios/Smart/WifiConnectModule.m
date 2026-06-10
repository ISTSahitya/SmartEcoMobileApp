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
  [[NEHotspotConfigurationManager sharedManager] removeConfigurationForSSID:ssid];
  NSLog(@"[WifiConnectModule] removed hotspot config for %@", ssid);
  resolve(@{ @"success": @YES });
}

@end
