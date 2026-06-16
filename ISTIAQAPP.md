# ISTIAQAPP - Setup & Deployment Steps

## Overview
This document tracks all the changes made to convert the SmartEco app into a brand new Play Store app called **ISTIAQAPP**.

---

## Step 1: App Display Name Changed
Changed the app display name to **ISTIAQAPP** in the following files:
- `app.json` — `displayName` set to `ISTIAQAPP`
- `android/app/src/main/res/values/strings.xml` — `app_name` set to `ISTIAQAPP`
- `ios/Smart/Info.plist` — `CFBundleDisplayName` set to `ISTIAQAPP`

## Step 2: Application ID Changed
Changed the Android application ID from `com.smarteco.app` to `com.istiaqapp`:
- `android/app/build.gradle` — `namespace` and `applicationId` set to `com.istiaqapp`

## Step 3: Version Reset
Reset version for a fresh Play Store listing:
- `versionCode` set to `1`
- `versionName` set to `1.0.0`

## Step 4: Kotlin Package Renamed
Moved all Kotlin source files from `android/app/src/main/java/com/smarteco/app/` to `android/app/src/main/java/com/istiaqapp/` and updated the `package` declaration in each file:
- `MainActivity.kt`
- `MainApplication.kt`
- `MobileDataModule.kt`
- `MobileDataPackage.kt`
- `VpnModule.kt`
- `VpnPackage.kt`

## Step 5: Deep Link Scheme Updated
Changed deep link scheme from `smarteco://` to `istiaqapp://`:
- `android/app/src/main/AndroidManifest.xml` — scheme set to `istiaqapp`
- `src/navigation/AppNavigator.js` — prefix set to `istiaqapp://`

## Step 6: Release Signing Keystore Created
Generated a new PKCS12 release keystore for Play Store signing using the following command:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore istiaqapp-upload.keystore -alias istiaqapp -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=ISTIAQAPP, OU=Mobile, O=ISTIAQAPP, L=Unknown, ST=Unknown, C=US" -storepass istiaqapp123 -keypass istiaqapp123
```
- **File:** `android/app/istiaqapp-upload.keystore`
- **Alias:** `istiaqapp`
- **Store type:** PKCS12
- **Algorithm:** RSA 2048-bit
- **Validity:** 10,000 days (~27 years)

To change the keystore password after generation:
```bash
keytool -storepasswd -keystore android/app/istiaqapp-upload.keystore
```
Note: PKCS12 keystores use the same password for both the store and the key, so `-keypasswd` is not needed.

## Step 7: Release Signing Configured in build.gradle
Updated `android/app/build.gradle` to use the release keystore for release builds.

Added `local.properties` loader at the top of `build.gradle` (before `android {}`):
```gradle
def localProperties = new Properties()
def localPropertiesFile = rootProject.file('local.properties')
if (localPropertiesFile.exists()) {
    localPropertiesFile.withInputStream { localProperties.load(it) }
}
```

Credentials are referenced via `localProperties` (not hardcoded):
```gradle
release {
    storeFile file(localProperties['ISTIAQAPP_UPLOAD_STORE_FILE'])
    storePassword localProperties['ISTIAQAPP_UPLOAD_STORE_PASSWORD']
    keyAlias localProperties['ISTIAQAPP_UPLOAD_KEY_ALIAS']
    keyPassword localProperties['ISTIAQAPP_UPLOAD_KEY_PASSWORD']
}
```

## Step 8: Credentials Secured
Moved keystore credentials to `android/local.properties` (which is gitignored):
```properties
ISTIAQAPP_UPLOAD_STORE_FILE=istiaqapp-upload.keystore
ISTIAQAPP_UPLOAD_KEY_ALIAS=istiaqapp
ISTIAQAPP_UPLOAD_STORE_PASSWORD=Ist@12345678
ISTIAQAPP_UPLOAD_KEY_PASSWORD=Ist@12345678
```
- The keystore file (`*.keystore`) is also gitignored (except `debug.keystore`).
- Keystore password was changed from the default to `Ist@12345678`.

## Step 9: Generate Signed App Bundle

### Option A: Android Studio (GUI)
1. Open Android Studio
2. Go to **Build > Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Fill in the signing details:
   - **Key store path:** `android/app/istiaqapp-upload.keystore`
   - **Key store password:** `Ist@12345678`
   - **Key alias:** `istiaqapp`
   - **Key password:** `Ist@12345678`
5. Click **Next**
6. Select **release** build variant
7. Click **Create**
8. Output file: `android/app/build/outputs/bundle/release/app-release.aab`

### Option B: Command Line
```bash
cd android
./gradlew bundleRelease
```
Output file: `android/app/build/outputs/bundle/release/app-release.aab`

### Troubleshooting: Build Fails with "package com.smarteco.app does not exist"
This happens due to cached autolinking files referencing the old package name. Fix by doing a full clean:
```bash
cd android
rm -rf .gradle app/build build
./gradlew bundleRelease
```

## Step 10: Upload to Google Play Store
1. Go to [Google Play Console](https://play.google.com/console)
2. Create a **new app** called "ISTIAQAPP"
3. **Package name:** `com.istiaqapp`
4. Fill in the store listing (description, screenshots, category, privacy policy URL)
5. Go to **Production > Create new release**
6. Upload the `.aab` file from `android/app/build/outputs/bundle/release/app-release.aab`
7. Submit for review

---

## FAQ

### Do I need to upload the keystore to Play Console?
**No.** You do not upload your keystore file to Google Play Console.

- **Google Play App Signing** is enabled by default for all new apps.
- When you upload your first `.aab` file, Google automatically extracts your **upload key** from it.
- Your `istiaqapp-upload.keystore` is your **upload key** — it proves to Google that the bundle came from you.
- Google then **re-signs** the app with their own app signing key before distributing it to users.
- You only need the keystore locally to sign every future update you upload.

---

## Important Notes
- **Back up the keystore** — if lost, you can never update the app on Play Store
- **Never commit** `istiaqapp-upload.keystore` or `local.properties` to git
- A **Google Play Developer account** ($25 one-time fee) is required
- **Store listing assets required:** app description, at least 2 screenshots, feature graphic (1024x500), privacy policy URL
