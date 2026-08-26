package com.smartecoenterprise.app.wear

import android.app.Application
import com.smartecoenterprise.app.wear.di.ServiceLocator

/**
 * Wires the (deliberately hand-rolled) dependency graph.
 *
 * No Hilt: it needs KSP, which adds another plugin/version matrix to a build whose
 * plugin resolution is already unusual (versions come from the React Native Gradle
 * Plugin's composite build). Three screens do not justify that.
 */
class SmartEcoWearApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
    }
}
