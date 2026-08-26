package com.smartecoenterprise.app.wear.ui.rooms

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.smartecoenterprise.app.wear.ui.UiState
import com.smartecoenterprise.app.wear.ui.common.ErrorScreen
import com.smartecoenterprise.app.wear.ui.common.LoadingScreen
import com.smartecoenterprise.app.wear.ui.common.StatusDot

@Composable
fun RoomListScreen(
    viewModel: RoomListViewModel,
    onRoomClick: (Int) -> Unit,
) {
    when (val state = viewModel.state.collectAsStateWithLifecycle().value) {
        is UiState.Loading -> LoadingScreen()
        is UiState.Error -> ErrorScreen(kind = state.kind, onRetry = viewModel::refresh)
        is UiState.Content -> {
            val listState = rememberScalingLazyListState()
            ScalingLazyColumn(
                modifier = Modifier.fillMaxWidth(),
                state = listState,
            ) {
                item { ListHeader { Text("Rooms") } }

                if (state.value.isEmpty()) {
                    item {
                        Text(
                            text = "No rooms yet",
                            style = MaterialTheme.typography.caption2,
                            color = MaterialTheme.colors.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                // Already sorted worst-first by the repository.
                items(state.value) { room ->
                    Chip(
                        onClick = { onRoomClick(room.roomId) },
                        label = { Text(room.name) },
                        secondaryLabel = {
                            Text(
                                if (room.aqi != null) {
                                    "AQI ${room.aqi.toInt()} · ${room.status.label}"
                                } else {
                                    "No data"
                                },
                            )
                        },
                        icon = { StatusDot(room.status.color) },
                        colors = ChipDefaults.secondaryChipColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                item {
                    if (state.refreshing) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        CompactChip(onClick = viewModel::refresh, label = { Text("Refresh") })
                    }
                }
            }
        }
    }
}
