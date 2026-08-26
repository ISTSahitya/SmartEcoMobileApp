package com.smartecoenterprise.app.wear.data.api

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.smartecoenterprise.app.wear.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

object ApiClient {

    val json = Json {
        // The API grows; a watch build in the field must not start crashing
        // because the server added a field.
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    fun create(
        authInterceptor: AuthInterceptor,
        sessionExpiryInterceptor: SessionExpiryInterceptor,
    ): SmartEcoApi {
        val client = OkHttpClient.Builder()
            // Generous by phone standards, deliberately: when the watch has no
            // Wi-Fi or LTE these calls are proxied over Bluetooth via the phone,
            // which is an order of magnitude slower.
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .callTimeout(45, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .addInterceptor(authInterceptor)
            .addInterceptor(sessionExpiryInterceptor)
            .apply {
                if (BuildConfig.DEBUG) {
                    // BASIC, never BODY: the login request body carries a
                    // plaintext password and the response carries a bearer token.
                    addInterceptor(
                        HttpLoggingInterceptor()
                            .setLevel(HttpLoggingInterceptor.Level.BASIC)
                            .apply { redactHeader("Authorization") },
                    )
                }
            }
            .build()

        return Retrofit.Builder()
            // Trailing slash is required by Retrofit, and is what makes the
            // relative paths in SmartEcoApi resolve under /SmartecoAvdapi.
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(SmartEcoApi::class.java)
    }
}
