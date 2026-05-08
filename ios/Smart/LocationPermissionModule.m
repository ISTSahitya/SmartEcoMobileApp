#import <CoreLocation/CoreLocation.h>
#import <React/RCTBridgeModule.h>

@interface LocationPermissionModule : NSObject <RCTBridgeModule, CLLocationManagerDelegate>
@property (nonatomic, strong) CLLocationManager *locationManager;
@property (nonatomic, copy) RCTPromiseResolveBlock pendingResolve;
@end

@implementation LocationPermissionModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (BOOL)isAuthorized:(CLAuthorizationStatus)status
{
  return status == kCLAuthorizationStatusAuthorizedWhenInUse ||
         status == kCLAuthorizationStatusAuthorizedAlways;
}

- (CLAuthorizationStatus)currentStatus
{
  if (@available(iOS 14.0, *)) {
    if (self.locationManager == nil) {
      self.locationManager = [CLLocationManager new];
      self.locationManager.delegate = self;
    }
    return self.locationManager.authorizationStatus;
  }

  return [CLLocationManager authorizationStatus];
}

RCT_EXPORT_METHOD(check:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    resolve(@([self isAuthorized:[self currentStatus]]));
  });
}

RCT_EXPORT_METHOD(request:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    CLAuthorizationStatus status = [self currentStatus];
    if ([self isAuthorized:status]) {
      resolve(@YES);
      return;
    }

    if (status == kCLAuthorizationStatusDenied || status == kCLAuthorizationStatusRestricted) {
      resolve(@NO);
      return;
    }

    self.pendingResolve = resolve;
    if (self.locationManager == nil) {
      self.locationManager = [CLLocationManager new];
    }
    self.locationManager.delegate = self;
    [self.locationManager requestWhenInUseAuthorization];
  });
}

- (void)resolvePendingWithStatus:(CLAuthorizationStatus)status
{
  if (self.pendingResolve != nil) {
    self.pendingResolve(@([self isAuthorized:status]));
    self.pendingResolve = nil;
  }
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager
{
  if (@available(iOS 14.0, *)) {
    [self resolvePendingWithStatus:manager.authorizationStatus];
  }
}

- (void)locationManager:(CLLocationManager *)manager didChangeAuthorizationStatus:(CLAuthorizationStatus)status
{
  [self resolvePendingWithStatus:status];
}

@end
