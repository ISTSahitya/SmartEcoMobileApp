package com.smartecoenterprise.app.wear.ui.roomdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartecoenterprise.app.wear.data.api.ApiResult
import com.smartecoenterprise.app.wear.data.api.dto.RoomLatestDto
import com.smartecoenterprise.app.wear.data.repo.AirQualityRepository
import com.smartecoenterprise.app.wear.ui.UiState
import com.smartecoenterprise.app.wear.ui.toErrorKind
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RoomDetailViewModel(
    private val repository: AirQualityRepository,
    private val roomId: Int,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<RoomLatestDto>>(UiState.Loading)
    val state: StateFlow<UiState<RoomLatestDto>> = _state.asStateFlow()

    init {
        load(forceRefresh = false)
    }

    fun refresh() = load(forceRefresh = true)

    private fun load(forceRefresh: Boolean) {
        val current = _state.value
        if (current is UiState.Content) {
            _state.value = current.copy(refreshing = true)
        }

        viewModelScope.launch {
            _state.value = when (val result = repository.roomLatest(roomId, forceRefresh)) {
                is ApiResult.Success -> UiState.Content(result.value)
                is ApiResult.Unauthorized -> UiState.Loading // global expiry flow routes to login
                else -> UiState.Error(result.toErrorKind())
            }
        }
    }
}
