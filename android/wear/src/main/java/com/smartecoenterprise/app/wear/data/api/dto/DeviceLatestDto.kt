package com.smartecoenterprise.app.wear.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Response element of GET air-quality/devices/latest.
 *
 * This is the one call that returns readings for every device at once. It carries
 * `room_id`, which is what lets the room list be TWO requests (this + the rooms
 * list, joined by room id) rather than one request per room — a real difference
 * over a Bluetooth-proxied watch connection.
 *
 * `room_name` can be populated from a legacy freetext column with no room behind
 * it, so join on `room_id` and never on the name.
 */
@Serializable
data class DeviceLatestDto(
    @SerialName("device_code") val deviceCode: String,
    @SerialName("device_name") val deviceName: String? = null,
    val industry: String? = null,
    @SerialName("site_name") val siteName: String? = null,
    val building: String? = null,
    val floor: String? = null,
    @SerialName("room_name") val roomName: String? = null,
    @SerialName("room_id") val roomId: Int? = null,
    @SerialName("device_status") val deviceStatus: String? = null,
    @SerialName("tenant_id") val tenantId: Int? = null,
    @SerialName("tenant_name") val tenantName: String? = null,

    val timestamp: String? = null,
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

    /** Capitalized AQI vocabulary: Good|Moderate|Poor|Unknown. */
    @SerialName("air_quality_status") val airQualityStatus: String? = null,
)
