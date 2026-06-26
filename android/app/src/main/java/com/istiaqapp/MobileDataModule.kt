package com.istiaqapp

import android.content.Context
import android.provider.Settings
import android.telephony.TelephonyManager
import com.facebook.react.bridge.*

class MobileDataModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MobileDataModule"

    @ReactMethod
    fun isMobileDataEnabled(promise: Promise) {
        try {
            // Method 1: Read the actual mobile data toggle from system settings
            val mobileDataEnabled = Settings.Global.getInt(
                reactApplicationContext.contentResolver,
                "mobile_data",
                0
            ) == 1

            promise.resolve(mobileDataEnabled)
        } catch (e: Exception) {
            // Method 2: Fallback using TelephonyManager
            try {
                val tm = reactApplicationContext
                    .getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                val method = tm.javaClass.getDeclaredMethod("getDataEnabled")
                method.isAccessible = true
                val result = method.invoke(tm) as Boolean
                promise.resolve(result)
            } catch (e2: Exception) {
                promise.reject("ERROR", e2.message)
            }
        }
    }
}
