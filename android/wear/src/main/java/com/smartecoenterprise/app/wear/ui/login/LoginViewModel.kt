package com.smartecoenterprise.app.wear.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartecoenterprise.app.wear.data.api.ApiResult
import com.smartecoenterprise.app.wear.data.auth.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val signedIn: Boolean = false,
) {
    val canSubmit: Boolean get() = email.isNotBlank() && password.isNotBlank() && !submitting
}

class LoginViewModel(private val authRepository: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    init {
        // Pre-fill the last email so the user only types a password — worth a
        // lot on a watch keyboard.
        viewModelScope.launch {
            val email = authRepository.lastEmail.first()
            if (email.isNotBlank()) _state.value = _state.value.copy(email = email)
        }
    }

    fun onEmailChanged(value: String) {
        _state.value = _state.value.copy(email = value, error = null)
    }

    fun onPasswordChanged(value: String) {
        _state.value = _state.value.copy(password = value, error = null)
    }

    fun submit() {
        val current = _state.value
        if (!current.canSubmit) return

        _state.value = current.copy(submitting = true, error = null)
        viewModelScope.launch {
            val message = when (val result = authRepository.login(current.email, current.password)) {
                is ApiResult.Success -> {
                    _state.value = _state.value.copy(submitting = false, signedIn = true)
                    return@launch
                }
                // 401 here is a wrong password, not an expired session.
                is ApiResult.Unauthorized -> "Wrong email or password"
                is ApiResult.NetworkError -> "No connection"
                is ApiResult.ServerError -> when (result.code) {
                    403 -> "Account is not active"
                    409 -> "Use social sign-in for this account"
                    else -> "Sign in failed"
                }
                is ApiResult.TenantRequired -> "Sign in failed"
            }
            _state.value = _state.value.copy(submitting = false, error = message)
        }
    }
}
