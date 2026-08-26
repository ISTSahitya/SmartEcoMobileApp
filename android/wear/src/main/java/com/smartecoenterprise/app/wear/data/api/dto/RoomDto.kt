package com.smartecoenterprise.app.wear.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Response element of GET api/v1/rooms/ — note this carries NO reading data.
 * Per-room status comes from joining against air-quality/devices/latest on room id.
 */
@Serializable
data class RoomDto(
    val id: Int,
    @SerialName("tenant_id") val tenantId: Int? = null,
    @SerialName("floor_id") val floorId: Int? = null,
    val name: String,
    val code: String? = null,
    @SerialName("room_type") val roomType: String? = null,
    val capacity: Int? = null,
    val status: String? = null,
)

/**
 * Response of GET api/v1/rooms/{id}/latest.
 *
 * Every sensor is nullable: a given device reports only a handful of the 17
 * fields, so the UI renders only non-null values rather than a wall of dashes.
 */
@Serializable
data class RoomLatestDto(
    @SerialName("room_id") val roomId: Int,
    @SerialName("room_code") val roomCode: String? = null,
    @SerialName("room_name") val roomName: String? = null,
    @SerialName("room_type") val roomType: String? = null,
    @SerialName("room_status") val roomStatus: String? = null,
    @SerialName("device_id") val deviceId: Int? = null,
    @SerialName("device_code") val deviceCode: String? = null,
    val timestamp: String? = null,
    @SerialName("reading_id") val readingId: Int? = null,
    /** Capitalized AQI vocabulary: Good|Moderate|Poor|Unknown. */
    @SerialName("air_quality_status") val airQualityStatus: String? = null,
    /** fresh|stale|no_data — server-computed, saves the watch a staleness rule. */
    val freshness: String? = null,

    // AQI-contributing pollutants
    @SerialName("pm2_5") val pm25: Float? = null,
    val pm10: Float? = null,
    val co2: Float? = null,
    val tvoc: Float? = null,
    val temperature: Float? = null,
    val humidity: Float? = null,
    val aqi: Float? = null,
    val hcho: Float? = null,
    val o3: Float? = null,
    val no2: Float? = null,
    val so2: Float? = null,
    val co: Float? = null,

    // Device-only extras (no AQI contribution)
    val pm1: Float? = null,
    val noise: Float? = null,
    val benzene: Float? = null,
    @SerialName("mold_index") val moldIndex: Float? = null,
    @SerialName("virus_index") val virusIndex: Float? = null,
    @SerialName("thermal_comfort") val thermalComfort: Float? = null,
)
