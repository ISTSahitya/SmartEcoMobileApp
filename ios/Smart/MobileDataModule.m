#import <React/RCTBridgeModule.h>
#include <ifaddrs.h>

@interface MobileDataModule : NSObject <RCTBridgeModule>
@end

@implementation MobileDataModule

RCT_EXPORT_MODULE()

// Detects active cellular data by checking for pdp_ip* network interfaces (cellular data interfaces on iOS)
RCT_EXPORT_METHOD(isMobileDataEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL isCellularActive = NO;
  struct ifaddrs *interfaces = NULL;

  if (getifaddrs(&interfaces) == 0) {
    struct ifaddrs *cursor = interfaces;
    while (cursor != NULL) {
      NSString *name = [NSString stringWithUTF8String:cursor->ifa_name];
      // pdp_ip0, pdp_ip1, etc. are the cellular data interfaces on iOS
      if ([name hasPrefix:@"pdp_ip"] && cursor->ifa_addr != NULL) {
        isCellularActive = YES;
        break;
      }
      cursor = cursor->ifa_next;
    }
    freeifaddrs(interfaces);
  }

  resolve(@(isCellularActive));
}

@end
