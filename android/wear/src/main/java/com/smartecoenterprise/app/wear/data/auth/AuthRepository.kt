package com.smartecoenterprise.app.wear.data.auth

import com.smartecoenterprise.app.wear.data.api.ApiResult
import com.smartecoenterprise.app.wear.data.api.SmartEcoApi
import com.smartecoenterprise.app.wear.data.api.dto.LoginRequest
import com.smartecoenterprise.app.wear.data.api.safeApiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class AuthRepository(
    private val apiProvider: () -> SmartEcoApi,
    private val sessionStore: SessionStore,
) {

    val session: Flow<Session?> = sessionStore.session
    val lastEmail: Flow<String> = sessionStore.lastEmail

    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    /** Emits when a 401 came back, so the UI can route to login. */
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    suspend fun login(email: String, password: String): ApiResult<Session> {
        val trimmed = email.trim()
        return when (val result = safeApiCall { apiProvider().login(LoginRequest(trimmed, password)) }) {
            is ApiResult.Success -> {
                val body = result.value
                val session = Session(
                    token = body.accessToken,
                    userId = body.userId,
                    tenantId = body.tenantId,
                    roles = body.roles,
                    expiresAtEpochSec = JwtExpiry.expiresAtEpochSec(body.accessToken),
                    email = trimmed,
                )
                sessionStore.save(session)
                ApiResult.Success(session)
            }
            // A 401 here means "wrong password", not "session expired" — do NOT
            // forward it to sessionExpired or the UI would loop on the login screen.
            is ApiResult.Unauthorized -> ApiResult.Unauthorized
            is ApiResult.NetworkError -> ApiResult.NetworkError
            is ApiResult.ServerError -> result
            is ApiResult.TenantRequired -> result
        }
    }

    suspend fun logout() {
        sessionStore.clear()
    }

    /** Called by SessionExpiryInterceptor on any 401 outside the login call. */
    suspend fun onUnauthorized() {
        sessionStore.clear()
        _sessionExpired.tryEmit(Unit)
    }
}
