// Public OAuth identifiers for native social login. These are NOT secrets — the
// same values are exposed in the web app. Keep them in sync with the web
// (.env NEXT_PUBLIC_* values) and the provider consoles.

export const GOOGLE_WEB_CLIENT_ID =
  '973195332590-6gb4rgv9g3bn0tk4jaiprfbaho10mh6k.apps.googleusercontent.com';

// iOS-type OAuth client (distinct from the Android/Web client above), created
// under the same Google Cloud project. Required by GoogleSignin.configure() on
// iOS; its reversed form must also be registered as a CFBundleURLSchemes entry
// in ios/Smart/Info.plist.
export const GOOGLE_IOS_CLIENT_ID =
  '973195332590-1fk3fq7p6q5gcp64geefvfdoahcd22f2.apps.googleusercontent.com';

export const MICROSOFT = {
  clientId: 'a9a3337b-556d-4540-b084-f92a48a2ce15',
  // Azure AD v2 "common" endpoint (work/school + personal accounts).
  issuer: 'https://login.microsoftonline.com/common/v2.0',
  // Must be registered as a Mobile/desktop redirect URI on the Azure app
  // (an iOS/macOS platform entry is needed in addition to the Android one), and
  // matches appAuthRedirectScheme=smartecoavd in android/app/build.gradle and
  // the CFBundleURLSchemes entry in ios/Smart/Info.plist.
  redirectUrl: 'smartecoavd://oauth2redirect',
  // Graph scope only — deliberately NO openid/profile/email. On the "common"
  // endpoint the ID token issuer is tenant-specific and fails AppAuth's issuer
  // check ("invalid id token"). We only need the access token (backend reads
  // the profile from Graph /me), so requesting no OIDC scopes avoids an ID
  // token entirely.
  scopes: ['User.Read'],
};

export const FACEBOOK_APP_ID = '801425132976958';
