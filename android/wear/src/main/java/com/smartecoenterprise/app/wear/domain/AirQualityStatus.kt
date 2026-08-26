package com.smartecoenterprise.app.wear.domain

import androidx.compose.ui.graphics.Color

/**
 * Air quality band derived from AQI, where **LOWER is better**
 * (server rule: <=50 Good, <=100 Moderate, >100 Poor).
 *
 * Deliberately separate from [ScoreCategory], which runs the OTHER WAY — it is a
 * 0-100 score where higher is better. The two use different words and different
 * polarity, and the API returns them from different endpoints. They must never
 * share a mapping function or a colour table, or a "Good" room will eventually
 * render red.
 *
 * The wire values are Capitalized: Good | Moderate | Poor | Unknown.
 */
enum class AirQualityStatus(val label: String, val color: Color) {
    GOOD("Good", Color(0xFF4CAF50)),
    MODERATE("Moderate", Color(0xFFFFB300)),
    POOR("Poor", Color(0xFFFF5252)),
    UNKNOWN("Unknown", Color(0xFF757575));

    companion object {
        /**
         * Total function — an unrecognised value maps to UNKNOWN rather than
         * throwing. `enumValueOf` would crash the screen if the server ever adds
         * a band.
         */
        fun fromWire(value: String?): AirQualityStatus = when (value?.trim()?.lowercase()) {
            "good" -> GOOD
            "moderate" -> MODERATE
            "poor" -> POOR
            else -> UNKNOWN
        }

        /** Worst first: on a watch, only the top of a list is reliably seen. */
        fun severityOrder(status: AirQualityStatus): Int = when (status) {
            POOR -> 0
            MODERATE -> 1
            GOOD -> 2
            UNKNOWN -> 3
        }
    }
}
