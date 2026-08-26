package com.smartecoenterprise.app.wear.data.repo

import com.smartecoenterprise.app.wear.data.api.ApiResult
import com.smartecoenterprise.app.wear.data.api.SmartEcoApi
import com.smartecoenterprise.app.wear.data.api.dto.OverviewResponse
import com.smartecoenterprise.app.wear.data.api.dto.RoomLatestDto
import com.smartecoenterprise.app.wear.data.api.safeApiCall
import com.smartecoenterprise.app.wear.data.auth.SessionStore
import com.smartecoenterprise.app.wear.domain.AirQualityStatus
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/** One room plus its latest reading, ready for the list screen. */
data class RoomStatus(
    val roomId: Int,
    val name: String,
    val aqi: Float?,
    val status: AirQualityStatus,
)

class AirQualityRepository(
    private val apiProvider: () -> SmartEcoApi,
    private val sessionStore: SessionStore,
) {

    private val cache = TtlCache()

    suspend fun overview(forceRefresh: Boolean = false): ApiResult<OverviewResponse> {
        cache.get<OverviewResponse>(KEY_OVERVIEW, forceRefresh)?.let { return ApiResult.Success(it) }

        // Only a super_admin needs an explicit tenant; Retrofit omits a null
        // query param, so everyone else sends nothing and gets their own tenant.
        val session = sessionStore.current()
        val tenantId = session?.takeIf { it.isSuperAdmin }?.tenantId

        return when (val result = safeApiCall { apiProvider().overview(tenantId) }) {
            is ApiResult.Success -> {
                cache.put(KEY_OVERVIEW, result.value)
                result
            }
            // This endpoint is single-tenant by nature and answers 400 rather
            // than guessing for an unscoped super_admin. Only mapped here,
            // because only this call carries that meaning.
            is ApiResult.ServerError -> if (result.code == 400) ApiResult.TenantRequired else result
            else -> result
        }
    }

    /**
     * Room list with per-room status in TWO requests, not one per room.
     *
     * air-quality/devices/latest carries room_id, so it can be joined against the
     * rooms list locally. Over a Bluetooth-proxied watch connection an N+1 fetch
     * would take tens of seconds.
     *
     * Joined on room_id and never on room_name: the name can come from a legacy
     * freetext column with no room behind it.
     */
    suspend fun roomStatuses(forceRefresh: Boolean = false): ApiResult<List<RoomStatus>> {
        cache.get<List<RoomStatus>>(KEY_ROOMS, forceRefresh)?.let { return ApiResult.Success(it) }

        return safeApiCall {
            coroutineScope {
                val api = apiProvider()
                val roomsDeferred = async { api.rooms() }
                val devicesDeferred = async { api.devicesLatest() }
                val rooms = roomsDeferred.await()
                val devices = devicesDeferred.await()

                // Several devices can share a room; keep the worst reading so the
                // room is not reported as Good because one of its sensors is.
                val byRoom = devices
                    .filter { it.roomId != null }
                    .groupBy { it.roomId!! }
                    .mapValues { (_, list) -> list.maxByOrNull { it.aqi ?: Float.MIN_VALUE } }

                val statuses = rooms.map { room ->
                    val reading = byRoom[room.id]
                    RoomStatus(
                        roomId = room.id,
                        name = room.name,
                        aqi = reading?.aqi,
                        status = AirQualityStatus.fromWire(reading?.airQualityStatus),
                    )
                }.sortedWith(
                    compareBy(
                        { AirQualityStatus.severityOrder(it.status) },
                        { -(it.aqi ?: 0f) },
                        { it.name },
                    ),
                )

                statuses
            }
        }.also { if (it is ApiResult.Success) cache.put(KEY_ROOMS, it.value) }
    }

    suspend fun roomLatest(roomId: Int, forceRefresh: Boolean = false): ApiResult<RoomLatestDto> {
        val key = "$KEY_ROOM_LATEST$roomId"
        cache.get<RoomLatestDto>(key, forceRefresh)?.let { return ApiResult.Success(it) }

        return safeApiCall { apiProvider().roomLatest(roomId) }.also {
            if (it is ApiResult.Success) cache.put(key, it.value)
        }
    }

    fun invalidate() = cache.clear()

    private companion object {
        const val KEY_OVERVIEW = "overview"
        const val KEY_ROOMS = "rooms"
        const val KEY_ROOM_LATEST = "room_latest_"
    }
}

/**
 * Tiny in-memory TTL cache. Its real job is making back-navigation instant:
 * swiping from room detail to the room list should not re-fetch.
 */
private class TtlCache(private val ttlMillis: Long = 60_000) {

    private data class Entry(val value: Any, val storedAt: Long)

    private val entries = mutableMapOf<String, Entry>()

    @Suppress("UNCHECKED_CAST")
    fun <T> get(key: String, forceRefresh: Boolean): T? {
        if (forceRefresh) {
            entries.remove(key)
            return null
        }
        val entry = entries[key] ?: return null
        if (System.currentTimeMillis() - entry.storedAt > ttlMillis) {
            entries.remove(key)
            return null
        }
        return entry.value as? T
    }

    fun put(key: String, value: Any) {
        entries[key] = Entry(value, System.currentTimeMillis())
    }

    fun clear() = entries.clear()
}
