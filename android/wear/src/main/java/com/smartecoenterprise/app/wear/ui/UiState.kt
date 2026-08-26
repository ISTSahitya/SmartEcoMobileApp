package com.smartecoenterprise.app.wear.ui

import com.smartecoenterprise.app.wear.data.api.ApiResult

/**
 * What a screen is currently showing. Kept separate from [ApiResult] because the
 * UI needs a "refreshing while already showing data" state that the network
 * layer has no concept of.
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>

    data class Content<T>(val value: T, val refreshing: Boolean = false) : UiState<T>

    /** Retryable — the screen offers a Retry action. */
    data class Error(val kind: ErrorKind) : UiState<Nothing>
}

enum class ErrorKind {
    NETWORK,
    /** A super_admin has no single tenant; retrying cannot fix it. */
    TENANT_REQUIRED,
    SERVER,
}

fun ApiResult<*>.toErrorKind(): ErrorKind = when (this) {
    is ApiResult.NetworkError -> ErrorKind.NETWORK
    is ApiResult.TenantRequired -> ErrorKind.TENANT_REQUIRED
    else -> ErrorKind.SERVER
}
