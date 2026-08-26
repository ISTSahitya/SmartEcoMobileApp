package com.smartecoenterprise.app.wear.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

/**
 * Response of POST api/v1/auth/login.
 *
 * The token is a 24-hour HS256 JWT. There is NO refresh token and no refresh
 * endpoint on this API, so the only recovery from expiry is a fresh login.
 *
 * `tenant_id` is typed non-nullable server-side but is populated from a nullable
 * column, so it is modelled as nullable here — a super_admin without a tenant is
 * a real possibility and should degrade rather than crash the parse.
 */
@Serializable
data class LoginResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "bearer",
    @SerialName("user_id") val userId: Int,
    @SerialName("tenant_id") val tenantId: Int? = null,
    val roles: List<String> = emptyList(),
)
