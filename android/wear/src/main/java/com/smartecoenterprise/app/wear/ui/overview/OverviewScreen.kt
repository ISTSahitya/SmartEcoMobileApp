package com.smartecoenterprise.app.wear.ui.overview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.smartecoenterprise.app.wear.domain.ScoreCategory
import com.smartecoenterprise.app.wear.ui.UiState
import com.smartecoenterprise.app.wear.ui.common.ErrorScreen
import com.smartecoenterprise.app.wear.ui.common.LoadingScreen
import com.smartecoenterprise.app.wear.ui.common.StatusDot

@Composable
fun OverviewScreen(
    viewModel: OverviewViewModel,
    onRoomClick: (Int) -> Unit,
    onAllRoomsClick: () -> Unit,
    onSignOut: () -> Unit,
) {
    when (val state = viewModel.state.collectAsStateWithLifecycle().value) {
        is UiState.Loading -> LoadingScreen()
        is UiState.Error -> ErrorScreen(
            kind = state.kind,
            onRetry = viewModel::refresh,
            onSignOut = onSignOut,
        )
        is UiState.Content -> OverviewContent(
            state = state,
            onRefresh = viewModel::refresh,
            onRoomClick = onRoomClick,
            onAllRoomsClick = onAllRoomsClick,
            onSignOut = onSignOut,
        )
    }
}

@Composable
private fun OverviewContent(
    state: UiState.Content<com.smartecoenterprise.app.wear.data.api.dto.OverviewResponse>,
    onRefresh: () -> Unit,
    onRoomClick: (Int) -> Unit,
    onAllRoomsClick: () -> Unit,
    onSignOut: () -> Unit,
) {
    val overview = state.value
    val summary = overview.summary
    // avg_score is a 0-100 score where HIGHER is better — NOT an AQI.
    val category = ScoreCategory.fromScore(summary.avgScore)
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxWidth(),
        state = listState,
    ) {
        item { ScoreGauge(score = summary.avgScore, category = category) }

        item {
            Text(
                text = overview.tenant.name,
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            Text(
                text = "${summary.reportingRooms}/${summary.roomCount} reporting",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (summary.openAlerts > 0) {
            item {
                Text(
                    text = if (summary.criticalAlerts > 0) {
                        "${summary.openAlerts} alerts · ${summary.criticalAlerts} critical"
                    } else {
                        "${summary.openAlerts} alerts"
                    },
                    style = MaterialTheme.typography.caption2,
                    color = if (summary.criticalAlerts > 0) {
                        MaterialTheme.colors.error
                    } else {
                        MaterialTheme.colors.onSurfaceVariant
                    },
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        // Worst rooms first — the whole point of a glance is seeing what needs
        // attention without scrolling.
        items(overview.topConcernRooms.take(3)) { room ->
            val roomCategory = ScoreCategory.fromWire(room.category)
            Chip(
                onClick = { onRoomClick(room.roomId) },
                label = { Text(room.roomName ?: room.roomCode ?: "Room ${room.roomId}") },
                secondaryLabel = { Text(roomCategory.label) },
                icon = { StatusDot(roomCategory.color) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            Chip(
                onClick = onAllRoomsClick,
                label = { Text("All rooms") },
                secondaryLabel = { Text("${summary.roomCount}") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            if (state.refreshing) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
            } else {
                CompactChip(onClick = onRefresh, label = { Text("Refresh") })
            }
        }

        item { CompactChip(onClick = onSignOut, label = { Text("Sign out") }) }
    }
}

@Composable
private fun ScoreGauge(score: Float?, category: ScoreCategory) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (score != null) {
            CircularProgressIndicator(
                progress = (score / 100f).coerceIn(0f, 1f),
                modifier = Modifier.size(72.dp),
                indicatorColor = category.color,
                strokeWidth = 4.dp,
            )
        }
        Text(
            text = score?.let { "%.0f".format(it) } ?: "—",
            style = MaterialTheme.typography.display2,
            fontWeight = FontWeight.Bold,
            color = category.color,
        )
    }
}
