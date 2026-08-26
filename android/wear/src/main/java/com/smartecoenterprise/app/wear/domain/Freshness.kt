package com.smartecoenterprise.app.wear.domain

/**
 * How current a reading is. Computed server-side (fresh = within 30 minutes),
 * which spares the watch from having to reason about clock skew.
 */
enum class Freshness {
    FRESH,
    STALE,
    NO_DATA;

    companion object {
        fun fromWire(value: String?): Freshness = when (value?.trim()?.lowercase()) {
            "fresh" -> FRESH
            "stale" -> STALE
            else -> NO_DATA
        }
    }
}
