package com.smartecoenterprise.app.wear.util

import java.time.Duration
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
 *
 * Deliberately terse — a watch has room for a few characters, not
 * "3 hours and 12 minutes ago".
 */
fun relativeTime(isoTimestamp: String?): String? {
    val instant = parseInstant(isoTimestamp) ?: return null
    val elapsed = Duration.between(instant, Instant.now())

    // Clock skew between watch and server can put a fresh reading slightly in
    // the future; showing "in 2m" would look broken.
    if (elapsed.isNegative) return "just now"

    val minutes = elapsed.toMinutes()
    return when {
        minutes < 1 -> "just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 60 * 24 -> "${elapsed.toHours()}h ago"
        else -> "${elapsed.toDays()}d ago"
    }
}

private fun parseInstant(value: String?): Instant? {
    if (value.isNullOrBlank()) return null
    return try {
        Instant.parse(value)
    } catch (e: DateTimeParseException) {
        // FastAPI serialises naive datetimes without a zone offset, which
        // Instant.parse rejects. Assume UTC, which is what the server stores.
        try {
            Instant.parse(value.trimEnd('Z') + "Z")
        } catch (e2: DateTimeParseException) {
            null
        }
    }
}
