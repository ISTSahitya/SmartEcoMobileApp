package com.smartecoenterprise.app.wear.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Response of GET api/v1/dashboard/overview. */
@Serializable
data class OverviewResponse(
    val tenant: TenantDto,
    val summary: SummaryDto,
    @SerialName("top_concern_rooms") val topConcernRooms: List<ConcernRoomDto> = emptyList(),
    @SerialName("top_sites") val topSites: List<TopSiteDto> = emptyList(),
)

@Serializable
data class TenantDto(
    val id: Int,
    val name: String,
    @SerialName("profile_type") val profileType: String? = null,
)

@Serializable
data class SummaryDto(
    @SerialName("site_count") val siteCount: Int = 0,
    @SerialName("room_count") val roomCount: Int = 0,
    @SerialName("reporting_rooms") val reportingRooms: Int = 0,
    @SerialName("unknown_rooms") val unknownRooms: Int = 0,
    /** 0-100, HIGHER is better. Not an AQI — see ScoreCategory. */
    @SerialName("avg_score") val avgScore: Float? = null,
    @SerialName("open_alerts") val openAlerts: Int = 0,
    @SerialName("critical_alerts") val criticalAlerts: Int = 0,
)

@Serializable
data class ConcernRoomDto(
    @SerialName("room_id") val roomId: Int,
    @SerialName("room_name") val roomName: String? = null,
    @SerialName("room_code") val roomCode: String? = null,
    @SerialName("site_id") val siteId: Int? = null,
    @SerialName("site_name") val siteName: String? = null,
    val score: Float? = null,
    /** Lowercase score vocabulary: good|moderate|poor|unhealthy|severe. */
    val category: String? = null,
    @SerialName("alert_count") val alertCount: Int = 0,
    @SerialName("detection_count") val detectionCount: Int = 0,
)

@Serializable
data class TopSiteDto(
    @SerialName("site_id") val siteId: Int,
    @SerialName("site_name") val siteName: String? = null,
    @SerialName("reporting_rooms") val reportingRooms: Int = 0,
    @SerialName("avg_score") val avgScore: Float? = null,
    @SerialName("open_alerts") val openAlerts: Int = 0,
)
