package com.smartecoenterprise.app.wear.ui.roomdetail

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.smartecoenterprise.app.wear.data.api.dto.RoomLatestDto
import com.smartecoenterprise.app.wear.domain.AirQualityStatus
import com.smartecoenterprise.app.wear.domain.Freshness
import com.smartecoenterprise.app.wear.domain.Pollutant
import com.smartecoenterprise.app.wear.ui.UiState
import com.smartecoenterprise.app.wear.ui.common.ErrorScreen
import com.smartecoenterprise.app.wear.ui.common.LoadingScreen
import com.smartecoenterprise.app.wear.ui.common.MetricRow
import com.smartecoenterprise.app.wear.util.relativeTime

@Composable
fun RoomDetailScreen(viewModel: RoomDetailViewModel) {
    when (val state = viewModel.state.collectAsStateWithLifecycle().value) {
        is UiState.Loading -> LoadingScreen()
        is UiState.Error -> ErrorScreen(kind = state.kind, onRetry = viewModel::refresh)
        is UiState.Content -> RoomDetailContent(
            reading = state.value,
            refreshing = state.refreshing,
            onRefresh = viewModel::refresh,
        )
    }
}

@Composable
private fun RoomDetailContent(
    reading: RoomLatestDto,
    refreshing: Boolean,
    onRefresh: () -> Unit,
) {
    // AQI vocabulary here — lower is better. NOT ScoreCategory.
    val status = AirQualityStatus.fromWire(reading.airQualityStatus)
    val freshness = Freshness.fromWire(reading.freshness)
    val metrics = Pollutant.readingsOf(reading)
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxWidth(),
        state = listState,
    ) {
        item {
            ListHeader {
                Text(reading.roomName ?: reading.roomCode ?: "Room ${reading.roomId}")
            }
        }

        item {
            Text(
                text = reading.aqi?.let { "AQI ${it.toInt()}" } ?: "—",
                style = MaterialTheme.typography.display3,
                fontWeight = FontWeight.Bold,
                color = status.color,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            Text(
                text = status.label,
                style = MaterialTheme.typography.caption1,
                color = status.color,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // Only surfaced when it matters — a "fresh" badge on every screen is noise.
        if (freshness != Freshness.FRESH) {
            item {
                val label = when (freshness) {
                    Freshness.STALE -> listOfNotNull("Stale", relativeTime(reading.timestamp))
                        .joinToString(" · ")
                    else -> "No data"
                }
                Text(
                    text = label,
                    style = MaterialTheme.typography.caption2,
                    color = if (freshness == Freshness.STALE) {
                        AirQualityStatus.MODERATE.color
                    } else {
                        MaterialTheme.colors.onSurfaceVariant
                    },
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        // Only non-null sensors. Most devices report a handful of the 17 fields,
        // and a screen of dashes on a 450px display is worse than a short list.
        items(metrics) { (pollutant, value) ->
            MetricRow(
                label = pollutant.label,
                value = pollutant.format(value),
                unit = pollutant.unit,
                valueColor = pollutant.colorFor(value),
            )
        }

        if (metrics.isEmpty()) {
            item {
                Text(
                    text = "No readings",
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (freshness == Freshness.FRESH) {
            item {
                relativeTime(reading.timestamp)?.let { time ->
                    Text(
                        text = time,
                        style = MaterialTheme.typography.caption3,
                        color = MaterialTheme.colors.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        reading.deviceCode?.let { code ->
            item {
                Text(
                    text = code,
                    style = MaterialTheme.typography.caption3,
                    color = MaterialTheme.colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            if (refreshing) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
            } else {
                CompactChip(onClick = onRefresh, label = { Text("Refresh") })
            }
        }
    }
}
