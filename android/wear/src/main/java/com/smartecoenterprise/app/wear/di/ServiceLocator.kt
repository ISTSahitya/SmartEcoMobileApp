package com.smartecoenterprise.app.wear.di

import android.content.Context
import com.smartecoenterprise.app.wear.data.api.ApiClient
import com.smartecoenterprise.app.wear.data.api.AuthInterceptor
import com.smartecoenterprise.app.wear.data.api.SessionExpiryInterceptor
import com.smartecoenterprise.app.wear.data.api.SmartEcoApi
import com.smartecoenterprise.app.wear.data.auth.AuthRepository
import com.smartecoenterprise.app.wear.data.auth.SessionStore
import com.smartecoenterprise.app.wear.data.repo.AirQualityRepository

/**
 * Hand-rolled dependency graph, initialised from
 * [com.smartecoenterprise.app.wear.SmartEcoWearApplication.onCreate].
 *
 * No Hilt: it requires KSP, which would add another plugin and version matrix to
 * a build whose plugin versions already come from the React Native Gradle
 * Plugin's composite build. Three screens do not justify that risk.
 *
 * Everything is lazy so nothing touches disk or the keystore on the main thread
 * during Application.onCreate.
 */
object ServiceLocator {

    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    val sessionStore: SessionStore by lazy { SessionStore(appContext) }

    val authRepository: AuthRepository by lazy {
        AuthRepository(apiProvider = { api }, sessionStore = sessionStore)
    }

    // The API needs the interceptors, one interceptor needs AuthRepository, and
    // AuthRepository needs the API. The cycle is broken by passing the API as a
    // provider lambda rather than an instance, so nothing is constructed until
    // the first actual call.
    val api: SmartEcoApi by lazy {
        ApiClient.create(
            authInterceptor = AuthInterceptor(sessionStore),
            sessionExpiryInterceptor = SessionExpiryInterceptor(
                onUnauthorized = { authRepository.onUnauthorized() },
            ),
        )
    }

    val airQualityRepository: AirQualityRepository by lazy {
        AirQualityRepository(apiProvider = { api }, sessionStore = sessionStore)
    }
}
