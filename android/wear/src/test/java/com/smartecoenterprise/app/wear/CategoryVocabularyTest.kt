package com.smartecoenterprise.app.wear

import com.smartecoenterprise.app.wear.domain.AirQualityStatus
import com.smartecoenterprise.app.wear.domain.ScoreCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * The API exposes two category vocabularies with OPPOSITE polarity:
 *   - air_quality_status: AQI-derived, Capitalized, LOWER is better
 *   - category:           0-100 score, lowercase, HIGHER is better
 *
 * Conflating them renders a healthy room red (or a bad one green), which is the
 * kind of bug that survives review because both sides look reasonable. These
 * tests pin the distinction.
 */
class CategoryVocabularyTest {

    @Test
    fun `air quality status parses the capitalized wire vocabulary`() {
        assertEquals(AirQualityStatus.GOOD, AirQualityStatus.fromWire("Good"))
        assertEquals(AirQualityStatus.MODERATE, AirQualityStatus.fromWire("Moderate"))
        assertEquals(AirQualityStatus.POOR, AirQualityStatus.fromWire("Poor"))
    }

    @Test
    fun `unknown values never throw`() {
        // enumValueOf would crash the screen if the server adds a band.
        assertEquals(AirQualityStatus.UNKNOWN, AirQualityStatus.fromWire("Hazardous"))
        assertEquals(AirQualityStatus.UNKNOWN, AirQualityStatus.fromWire(null))
        assertEquals(ScoreCategory.UNKNOWN, ScoreCategory.fromWire("catastrophic"))
        assertEquals(ScoreCategory.UNKNOWN, ScoreCategory.fromWire(null))
    }

    @Test
    fun `score category has five bands where higher is better`() {
        assertEquals(ScoreCategory.GOOD, ScoreCategory.fromScore(85f))
        assertEquals(ScoreCategory.MODERATE, ScoreCategory.fromScore(65f))
        assertEquals(ScoreCategory.POOR, ScoreCategory.fromScore(45f))
        assertEquals(ScoreCategory.UNHEALTHY, ScoreCategory.fromScore(25f))
        assertEquals(ScoreCategory.SEVERE, ScoreCategory.fromScore(5f))
        assertEquals(ScoreCategory.UNKNOWN, ScoreCategory.fromScore(null))
    }

    @Test
    fun `the two scales run in opposite directions`() {
        // A LOW number is good on the score scale's inverse: 90 AQI is Moderate
        // air, while a score of 90 is Good. Same number, opposite meaning.
        assertEquals(AirQualityStatus.MODERATE, AirQualityStatus.fromWire("Moderate"))
        assertEquals(ScoreCategory.GOOD, ScoreCategory.fromScore(90f))
        assertNotEquals(
            AirQualityStatus.MODERATE.color,
            ScoreCategory.fromScore(90f).color,
        )
    }

    @Test
    fun `poor bands use different colours in each vocabulary`() {
        // Documents that the two colour tables are deliberately separate.
        assertNotEquals(AirQualityStatus.POOR.color, ScoreCategory.POOR.color)
    }
}
