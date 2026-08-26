package com.smartecoenterprise.app.wear.data.api

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Turns any 401 into a signed-out state.
 *
 * This is an Interceptor rather than an OkHttp [okhttp3.Authenticator] on
 * purpose: an Authenticator exists to retry a request with fresh credentials,
 * and this API has no refresh token, so there is nothing to retry with. The only
 * correct response to a 401 is to send the user back to the login screen.
 */
class SessionExpiryInterceptor(
    private val onUnauthorized: suspend () -> Unit,
) : Interceptor {

    // OkHttp threads are not a coroutine scope, and the response must be
    // returned without waiting for the session wipe.
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code == 401) {
            scope.launch { onUnauthorized() }
        }
        return response
    }
}
