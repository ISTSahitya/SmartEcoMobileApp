#import <React/RCTBridgeModule.h>
#include <ifaddrs.h>

@interface VpnModule : NSObject <RCTBridgeModule>
@end

@implementation VpnModule

RCT_EXPORT_MODULE()

// Detects VPN by checking for utun/ipsec network interfaces (tunnel interfaces created by VPN)
RCT_EXPORT_METHOD(isVpnActive:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL isVpnActive = NO;
  struct ifaddrs *interfaces = NULL;

  if (getifaddrs(&interfaces) == 0) {
    struct ifaddrs *cursor = interfaces;
    while (cursor != NULL) {
      NSString *name = [NSString stringWithUTF8String:cursor->ifa_name];
      if ([name hasPrefix:@"utun"] || [name hasPrefix:@"ipsec"]) {
        isVpnActive = YES;
        break;
      }
      cursor = cursor->ifa_next;
    }
    freeifaddrs(interfaces);
  }

  resolve(@(isVpnActive));
}

@end
