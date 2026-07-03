package com.smartecoenterprise.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.facebook.react.bridge.*

class VpnModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "VpnModule"
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        try {
            val cm = reactApplicationContext
                .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

            val network = cm.activeNetwork

            if (network == null) {
                promise.resolve(false)
                return
            }

            val caps = cm.getNetworkCapabilities(network)
            val isVpn = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ?: false

            promise.resolve(isVpn)

        } catch (e: Exception) {
            promise.reject("VPN_ERROR", e)
        }
    }
}
