package com.smartecoenterprise.app.wear.data.api

import kotlinx.coroutines.CancellationException
import retrofit2.HttpException
import java.io.IOException

/**
 * Outcome of one API call, with the failure modes the UI actually needs to tell
 * apart. Anything the watch renders differently gets its own case.
 */
sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>

    /** No network, DNS failure, or timeout — retryable, so the UI offers Retry. */
    data object NetworkError : ApiResult<Nothing>

    /** 401. The session is already cleared by SessionExpiryInterceptor. */
    data object Unauthorized : ApiResult<Nothing>

    /**
     * A super_admin has no single tenant and the overview endpoint refuses to
     * guess, so it answers 400. Retrying cannot help, hence a distinct case.
     *
     * Only the overview call maps a 400 to this — see AirQualityRepository.
     * Treating every 400 as "tenant required" would mislabel unrelated
     * validation errors.
     */
    data object TenantRequired : ApiResult<Nothing>

    data class ServerError(val code: Int, val message: String?) : ApiResult<Nothing>
}

/**
 * Runs [block] and maps its failure onto [ApiResult].
 *
 * CancellationException is rethrown rather than swallowed — catching it would
 * break structured concurrency and leave a cancelled screen showing a spinner.
 */
suspend fun <T> safeApiCall(block: suspend () -> T): ApiResult<T> = try {
    ApiResult.Success(block())
} catch (e: CancellationException) {
    throw e
} catch (e: HttpException) {
    if (e.code() == 401) ApiResult.Unauthorized
    else ApiResult.ServerError(e.code(), e.message())
} catch (e: IOException) {
    ApiResult.NetworkError
}
