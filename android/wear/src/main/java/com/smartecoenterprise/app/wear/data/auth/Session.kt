package com.smartecoenterprise.app.wear.data.auth

import kotlinx.serialization.Serializable

/**
 * A signed-in session. Persisted encrypted — see [SessionStore].
 *
 * The password is never part of this and is never stored anywhere.
 */
@Serializable
data class Session(
    val token: String,
    val userId: Int,
    val tenantId: Int?,
    val roles: List<String>,
    /** From the JWT `exp` claim, so expiry is known without a server round-trip. */
    val expiresAtEpochSec: Long,
    val email: String,
) {
    /**
     * A super_admin has no single tenant, so the tenant-scoped screens need an
     * explicit tenant id — which a watch has no good way to choose.
     */
    val isSuperAdmin: Boolean get() = roles.any { it.equals("super_admin", ignoreCase = true) }

    fun isExpired(nowEpochSec: Long = System.currentTimeMillis() / 1000): Boolean =
        nowEpochSec >= expiresAtEpochSec

    /**
     * True when the token is close enough to expiry that starting a request is
     * not worth it. On a watch a doomed call can stall for 30 seconds.
     */
    fun isAboutToExpire(nowEpochSec: Long = System.currentTimeMillis() / 1000): Boolean =
        nowEpochSec >= expiresAtEpochSec - EXPIRY_GRACE_SEC

    private companion object {
        const val EXPIRY_GRACE_SEC = 60L
    }
}
