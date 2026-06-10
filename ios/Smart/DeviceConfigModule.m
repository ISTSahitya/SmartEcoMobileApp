#import <React/RCTBridgeModule.h>

@interface DeviceConfigModule : NSObject <RCTBridgeModule>
@end

@implementation DeviceConfigModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSDictionary *)constantsToExport
{
  return @{ @"bundlePath": [NSBundle mainBundle].bundlePath ?: @"" };
}

RCT_EXPORT_METHOD(send:(NSString *)urlString
                  payload:(NSDictionary *)payload
                  timeout:(nonnull NSNumber *)timeout
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSLog(@"[DeviceConfigModule] send_start url=%@ payloadKeys=%@", urlString, payload.allKeys);

  NSURL *url = [NSURL URLWithString:urlString];
  if (url == nil) {
    reject(@"invalid_url", @"Invalid device config URL", nil);
    return;
  }

  if (![NSJSONSerialization isValidJSONObject:payload]) {
    reject(@"invalid_payload", @"Device config payload is not valid JSON", nil);
    return;
  }

  NSError *jsonError = nil;
  NSData *body = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&jsonError];
  if (jsonError != nil || body == nil) {
    reject(@"json_encode_failed", jsonError.localizedDescription ?: @"Failed to encode payload", jsonError);
    return;
  }
  NSString *requestBody = [[NSString alloc] initWithData:body encoding:NSUTF8StringEncoding] ?: @"";
  NSLog(@"[DeviceConfigModule] send_body %@", requestBody);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  request.HTTPBody = body;
  request.timeoutInterval = timeout.doubleValue / 1000.0;
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  [request setValue:@"application/json, text/plain, */*" forHTTPHeaderField:@"Accept"];

  NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration ephemeralSessionConfiguration];
  configuration.timeoutIntervalForRequest = timeout.doubleValue / 1000.0;
  configuration.timeoutIntervalForResource = timeout.doubleValue / 1000.0;
  configuration.allowsCellularAccess = NO;
  NSURLSession *session = [NSURLSession sessionWithConfiguration:configuration];

  NSURLSessionDataTask *task = [session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error != nil) {
      NSLog(@"[DeviceConfigModule] send_error code=%ld domain=%@ message=%@", (long)error.code, error.domain, error.localizedDescription);
      reject(@"device_request_failed", error.localizedDescription ?: @"Device request failed", error);
      [session finishTasksAndInvalidate];
      return;
    }

    NSInteger statusCode = 0;
    if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
      statusCode = ((NSHTTPURLResponse *)response).statusCode;
    }

    NSString *responseText = @"";
    if (data != nil && data.length > 0) {
      responseText = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"";
    }

    NSLog(@"[DeviceConfigModule] send_response status=%ld length=%lu body=%@", (long)statusCode, (unsigned long)responseText.length, responseText);
    resolve(@{
      @"status": @(statusCode),
      @"response": responseText,
      @"requestBody": requestBody,
      @"url": urlString
    });
    [session finishTasksAndInvalidate];
  }];

  [task resume];
}

@end
