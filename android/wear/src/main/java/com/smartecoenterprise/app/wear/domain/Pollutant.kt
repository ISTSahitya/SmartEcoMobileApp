package com.smartecoenterprise.app.wear.domain

import androidx.compose.ui.graphics.Color
import com.smartecoenterprise.app.wear.data.api.dto.RoomLatestDto

/**
 * Display metadata for one sensor reading.
 *
 * Declaration order here IS the on-screen order: AQI-contributing pollutants
 * first, then comfort, then device-only extras. Only non-null values are
 * rendered — most devices report a handful of the 17 fields, and a screen full
 * of dashes on a 450px display is worse than a short list.
 *
 * Units for TVOC, mold index, virus index and thermal comfort are not documented
 * by the API, so those render raw with no unit rather than guessing wrong.
 */
enum class Pollutant(
    val label: String,
    val unit: String?,
    val decimals: Int,
    private val goodMax: Float?,
    private val moderateMax: Float?,
) {
    PM25("PM2.5", "µg/m³", 1, goodMax = 12f, moderateMax = 35f),
    PM10("PM10", "µg/m³", 1, goodMax = 54f, moderateMax = 154f),
    CO2("CO₂", "ppm", 0, goodMax = 800f, moderateMax = 1200f),
    TVOC("TVOC", null, 0, goodMax = 220f, moderateMax = 660f),
    TEMPERATURE("Temp", "°C", 1, goodMax = null, moderateMax = null),
    HUMIDITY("Humidity", "%", 0, goodMax = null, moderateMax = null),
    HCHO("HCHO", "mg/m³", 3, goodMax = 0.05f, moderateMax = 0.1f),
    O3("O₃", "ppb", 0, goodMax = 54f, moderateMax = 70f),
    NO2("NO₂", "ppb", 0, goodMax = 53f, moderateMax = 100f),
    SO2("SO₂", "ppb", 0, goodMax = 35f, moderateMax = 75f),
    CO("CO", "ppm", 1, goodMax = 4.4f, moderateMax = 9.4f),
    PM1("PM1", "µg/m³", 1, goodMax = null, moderateMax = null),
    NOISE("Noise", "dB", 0, goodMax = 55f, moderateMax = 70f),
    BENZENE("Benzene", "µg/m³", 2, goodMax = null, moderateMax = null),
    MOLD("Mold index", null, 1, goodMax = null, moderateMax = null),
    VIRUS("Virus index", null, 1, goodMax = null, moderateMax = null),
    THERMAL("Thermal comfort", null, 1, goodMax = null, moderateMax = null);

    /**
     * Colour for a value, or null when this metric has no meaningful threshold
     * (temperature and humidity are comfort ranges, not one-sided limits, and
     * the index metrics have undocumented scales).
     */
    fun colorFor(value: Float): Color? = when {
        goodMax == null || moderateMax == null -> null
        value <= goodMax -> AirQualityStatus.GOOD.color
        value <= moderateMax -> AirQualityStatus.MODERATE.color
        else -> AirQualityStatus.POOR.color
    }

    fun format(value: Float): String =
        if (decimals == 0) value.toInt().toString() else "%.${decimals}f".format(value)

    companion object {
        /**
         * Pairs each populated sensor with its metadata, in declaration order.
         * Nulls are dropped here so the UI never has to think about them.
         */
        fun readingsOf(dto: RoomLatestDto): List<Pair<Pollutant, Float>> = buildList {
            fun add(p: Pollutant, v: Float?) { if (v != null) add(p to v) }
            add(PM25, dto.pm25)
            add(PM10, dto.pm10)
            add(CO2, dto.co2)
            add(TVOC, dto.tvoc)
            add(TEMPERATURE, dto.temperature)
            add(HUMIDITY, dto.humidity)
            add(HCHO, dto.hcho)
            add(O3, dto.o3)
            add(NO2, dto.no2)
            add(SO2, dto.so2)
            add(CO, dto.co)
            add(PM1, dto.pm1)
            add(NOISE, dto.noise)
            add(BENZENE, dto.benzene)
            add(MOLD, dto.moldIndex)
            add(VIRUS, dto.virusIndex)
            add(THERMAL, dto.thermalComfort)
        }
    }
}
