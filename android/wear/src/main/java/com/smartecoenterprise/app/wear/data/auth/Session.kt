package com.smartecoenterprise.app.wear.data.auth

import kotlinx.serialization.Serializable

/**
 * Grace period before the recorded expiry at which a token stops being used.
 *
 * A top-level private const rather than a member of a companion object inside
 * [Session]: kotlinx-serialization generates `serializer()` onto that same
 * companion, so declaring it `private` made the generated `Session.Companion`
 * private too and every call site outside the class died with
 * IllegalAccessError at runtime (it compiles fine).
 */
private const val EXPIRY_GRACE_SEC = 60L

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
}
