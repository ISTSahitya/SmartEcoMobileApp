package com.smartecoenterprise.app.wear.data.api

import com.smartecoenterprise.app.wear.data.auth.SessionStore
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Attaches the bearer token.
 *
 * Also drops the header when the token is already (about to be) expired. That
 * proactive check matters more on a watch than a phone: a request over a
 * Bluetooth-proxied connection can hang for the full 30-second timeout before
 * coming back 401, which reads to the user as the app being broken.
 *
 * The login call carries no token, so it is skipped by path.
 */
class AuthInterceptor(private val sessionStore: SessionStore) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.url.encodedPath.endsWith("/auth/login")) {
            return chain.proceed(request)
        }

        val session = sessionStore.currentBlocking()
        val token = session?.takeUnless { it.isAboutToExpire() }?.token
            ?: return chain.proceed(request) // Unauthenticated -> server answers 401.

        return chain.proceed(
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build(),
        )
    }
}
