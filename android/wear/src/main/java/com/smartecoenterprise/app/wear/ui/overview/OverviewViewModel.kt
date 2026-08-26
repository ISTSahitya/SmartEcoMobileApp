package com.smartecoenterprise.app.wear.ui.overview

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartecoenterprise.app.wear.data.api.ApiResult
import com.smartecoenterprise.app.wear.data.api.dto.OverviewResponse
import com.smartecoenterprise.app.wear.data.repo.AirQualityRepository
import com.smartecoenterprise.app.wear.ui.UiState
import com.smartecoenterprise.app.wear.ui.toErrorKind
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OverviewViewModel(
    private val repository: AirQualityRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<OverviewResponse>>(UiState.Loading)
    val state: StateFlow<UiState<OverviewResponse>> = _state.asStateFlow()

    init {
        load(forceRefresh = false)
    }

    fun refresh() = load(forceRefresh = true)

    private fun load(forceRefresh: Boolean) {
        // Keep showing existing data while refreshing — a watch screen that
        // blanks to a spinner on every poll is worse than slightly stale numbers.
        val current = _state.value
        if (current is UiState.Content) {
            _state.value = current.copy(refreshing = true)
        }

        viewModelScope.launch {
            _state.value = when (val result = repository.overview(forceRefresh)) {
                is ApiResult.Success -> UiState.Content(result.value)
                // Unauthorized is handled globally by the session-expiry flow,
                // which routes to login; showing an error here too would flash
                // a message on the way out.
                is ApiResult.Unauthorized -> UiState.Loading
                else -> UiState.Error(result.toErrorKind())
            }
        }
    }
}
