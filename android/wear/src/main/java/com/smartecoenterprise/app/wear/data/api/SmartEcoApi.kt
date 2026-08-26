package com.smartecoenterprise.app.wear.data.api

import com.smartecoenterprise.app.wear.data.api.dto.DeviceLatestDto
import com.smartecoenterprise.app.wear.data.api.dto.LoginRequest
import com.smartecoenterprise.app.wear.data.api.dto.LoginResponse
import com.smartecoenterprise.app.wear.data.api.dto.OverviewResponse
import com.smartecoenterprise.app.wear.data.api.dto.RoomDto
import com.smartecoenterprise.app.wear.data.api.dto.RoomLatestDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The single place API paths live.
 *
 * Three rules that are easy to break and hard to debug:
 *
 * 1. Paths are RELATIVE with no leading slash. A leading '/' resolves against the
 *    host root and silently drops the '/SmartecoAvdapi' base path, producing 404s
 *    that look like server faults.
 * 2. The backend's router prefixes are NOT uniform. Most are 'api/v1/...', but
 *    air-quality (and devices) sit at the root with no version segment. Do not
 *    "tidy" these into a shared api/v1 base URL.
 * 3. 'api/v1/rooms/' keeps its trailing slash — FastAPI answers the slashless form
 *    with a 307, and following it doubles the round-trips on a slow link.
 *
 * ApiPathTest asserts all three against the real base URL.
 */
interface SmartEcoApi {

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    /**
     * @param tenantId only meaningful for super_admin. Retrofit omits null query
     * params, so a normal user sends nothing and gets their own tenant. An
     * unscoped super_admin gets a 400 from this endpoint by design.
     */
    @GET("api/v1/dashboard/overview")
    suspend fun overview(@Query("tenant_id") tenantId: Int? = null): OverviewResponse

    @GET("api/v1/rooms/")
    suspend fun rooms(): List<RoomDto>

    @GET("api/v1/rooms/{roomId}/latest")
    suspend fun roomLatest(@Path("roomId") roomId: Int): RoomLatestDto

    /** Note: no 'api/v1' — this router is mounted at the root. */
    @GET("air-quality/devices/latest")
    suspend fun devicesLatest(): List<DeviceLatestDto>
}
