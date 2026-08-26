package com.smartecoenterprise.app.wear.ui.login

import android.app.Activity
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.input.RemoteInputIntentHelper
import android.app.RemoteInput

private const val KEY_EMAIL = "email"
private const val KEY_PASSWORD = "password"

/**
 * Sign-in on a round watch face.
 *
 * Text entry goes through the system RemoteInput activity rather than an in-app
 * text field: that gives voice dictation, the on-watch keyboard and handwriting
 * for free, and is what Wear users expect.
 *
 * Known trade-off: RemoteInput has NO password masking, so the password is
 * visible while being typed. On a wrist-worn device that is a defensible
 * compromise, but it is a deliberate one. If masking is ever required, keep
 * RemoteInput for email and swap the password field for a Wear-styled
 * BasicTextField with PasswordVisualTransformation.
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onSignedIn: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedIn) {
        if (state.signedIn) onSignedIn()
    }

    val emailLauncher = rememberRemoteInputLauncher(KEY_EMAIL, viewModel::onEmailChanged)
    val passwordLauncher = rememberRemoteInputLauncher(KEY_PASSWORD, viewModel::onPasswordChanged)

    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxWidth(),
        state = listState,
    ) {
        item { ListHeader { Text("Sign in") } }

        item {
            Chip(
                onClick = { emailLauncher("Email") },
                label = { Text(state.email.ifBlank { "Email" }) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            Chip(
                onClick = { passwordLauncher("Password") },
                label = { Text(if (state.password.isBlank()) "Password" else "••••••") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            if (state.submitting) {
                CircularProgressIndicator(modifier = Modifier.padding(top = 8.dp))
            } else {
                Chip(
                    onClick = viewModel::submit,
                    label = { Text("Sign in") },
                    enabled = state.canSubmit,
                    colors = ChipDefaults.primaryChipColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        state.error?.let { error ->
            item {
                Text(
                    text = error,
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }
    }
}

/**
 * Returns a launcher taking a field label and delivering the typed text to
 * [onResult].
 *
 * RemoteInput offers no way to pre-fill the editor, so the label doubles as the
 * only affordance telling the user which field they are editing.
 */
@Composable
private fun rememberRemoteInputLauncher(
    key: String,
    onResult: (String) -> Unit,
): (String) -> Unit {
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            RemoteInput.getResultsFromIntent(result.data)
                ?.getCharSequence(key)
                ?.toString()
                ?.let(onResult)
        }
    }

    return { label ->
        val remoteInput = RemoteInput.Builder(key)
            .setLabel(label)
            .build()

        val intent: Intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(remoteInput))
        RemoteInputIntentHelper.putTitleExtra(intent, label)
        launcher.launch(intent)
    }
}
