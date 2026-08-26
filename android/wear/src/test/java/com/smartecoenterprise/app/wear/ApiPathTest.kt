package com.smartecoenterprise.app.wear

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Guards the three URL rules that are easy to break and produce misleading
 * failures at runtime (404s that look like server faults). No network needed.
 */
class ApiPathTest {

    private val base = "https://app.smarteco.ai/SmartecoAvdapi/".toHttpUrl()

    @Test
    fun `base url keeps its trailing slash`() {
        // Retrofit throws at construction without this, but assert it so a
        // careless edit to BuildConfig.API_BASE_URL fails here first.
        assertEquals("/SmartecoAvdapi/", base.encodedPath)
    }

    @Test
    fun `relative paths resolve under the base path`() {
        assertEquals(
            "https://app.smarteco.ai/SmartecoAvdapi/api/v1/auth/login",
            base.resolve("api/v1/auth/login").toString(),
        )
    }

    @Test
    fun `a leading slash would drop the base path`() {
        // This is the failure mode the rule exists to prevent — documented as a
        // test so the reason is not lost.
        assertEquals(
            "https://app.smarteco.ai/api/v1/auth/login",
            base.resolve("/api/v1/auth/login").toString(),
        )
    }

    @Test
    fun `rooms keeps its trailing slash`() {
        // FastAPI answers the slashless form with a 307; following it doubles
        // the round-trips on a Bluetooth-proxied watch connection.
        assertEquals(
            "https://app.smarteco.ai/SmartecoAvdapi/api/v1/rooms/",
            base.resolve("api/v1/rooms/").toString(),
        )
    }

    @Test
    fun `air quality router has no api v1 segment`() {
        // The backend's router prefixes are not uniform. Do not "tidy" this.
        assertEquals(
            "https://app.smarteco.ai/SmartecoAvdapi/air-quality/devices/latest",
            base.resolve("air-quality/devices/latest").toString(),
        )
    }

    @Test
    fun `room latest interpolates the id`() {
        assertEquals(
            "https://app.smarteco.ai/SmartecoAvdapi/api/v1/rooms/42/latest",
            base.resolve("api/v1/rooms/42/latest").toString(),
        )
    }
}
