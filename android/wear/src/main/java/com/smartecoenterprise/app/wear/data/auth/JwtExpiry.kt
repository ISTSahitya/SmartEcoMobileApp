package com.smartecoenterprise.app.wear.data.auth

import android.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Reads the `exp` claim out of a JWT.
 *
 * This only DECODES — it does not verify the signature, and must never be used
 * to decide whether a token is authentic. Its one job is letting the client skip
 * requests it already knows will 401.
 */
object JwtExpiry {

    private val json = Json { ignoreUnknownKeys = true }

    /** Token lifetime advertised by the API when the claim cannot be read. */
    private const val FALLBACK_LIFETIME_SEC = 24 * 60 * 60L

    fun expiresAtEpochSec(token: String): Long {
        return parseExp(token) ?: (System.currentTimeMillis() / 1000 + FALLBACK_LIFETIME_SEC)
    }

    private fun parseExp(token: String): Long? = try {
        val payload = token.split('.').getOrNull(1)
        if (payload.isNullOrEmpty()) {
            null
        } else {
            // JWT uses base64url without padding.
            val decoded = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            json.parseToJsonElement(String(decoded, Charsets.UTF_8))
                .jsonObject["exp"]?.jsonPrimitive?.longOrNull
        }
    } catch (e: Exception) {
        // A malformed token is not worth crashing over — the fallback simply
        // means the client trusts the server's 401 instead of pre-empting it.
        null
    }
}
