package com.smartecoenterprise.app.wear.domain

import androidx.compose.ui.graphics.Color

/**
 * Air-quality SCORE band: 0-100 where **HIGHER is better**
 * (server rule: >=80 good, >=60 moderate, >=40 poor, >=20 unhealthy, else severe).
 *
 * This is the opposite polarity to [AirQualityStatus], which is AQI-derived and
 * where lower is better. Five bands here versus four there, lowercase wire values
 * here versus Capitalized there. Keep the two apart — see the note on
 * [AirQualityStatus].
 */
enum class ScoreCategory(val label: String, val color: Color) {
    GOOD("Good", Color(0xFF4CAF50)),
    MODERATE("Moderate", Color(0xFFFFB300)),
    POOR("Poor", Color(0xFFFF7043)),
    UNHEALTHY("Unhealthy", Color(0xFFFF5252)),
    SEVERE("Severe", Color(0xFFB71C1C)),
    UNKNOWN("No data", Color(0xFF757575));

    companion object {
        /** Total function — unrecognised values map to UNKNOWN, never throw. */
        fun fromWire(value: String?): ScoreCategory = when (value?.trim()?.lowercase()) {
            "good" -> GOOD
            "moderate" -> MODERATE
            "poor" -> POOR
            "unhealthy" -> UNHEALTHY
            "severe" -> SEVERE
            else -> UNKNOWN
        }

        /**
         * Local fallback for when only a number is available. Mirrors
         * scoring_engine._score_to_category on the server.
         */
        fun fromScore(score: Float?): ScoreCategory = when {
            score == null -> UNKNOWN
            score >= 80f -> GOOD
            score >= 60f -> MODERATE
            score >= 40f -> POOR
            score >= 20f -> UNHEALTHY
            else -> SEVERE
        }
    }
}
