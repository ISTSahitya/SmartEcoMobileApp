package com.smartecoenterprise.app.wear.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.smartecoenterprise.app.wear.ui.ErrorKind

@Composable
fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

/**
 * @param onRetry omitted for errors retrying cannot fix (a super_admin has no
 * single tenant, so hammering Retry would only produce the same 400).
 */
@Composable
fun ErrorScreen(
    kind: ErrorKind,
    onRetry: (() -> Unit)? = null,
    onSignOut: (() -> Unit)? = null,
) {
    val message = when (kind) {
        ErrorKind.NETWORK -> "No connection"
        ErrorKind.TENANT_REQUIRED ->
            "This account manages multiple tenants. Sign in with a tenant account."
        ErrorKind.SERVER -> "Something went wrong"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.body2,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colors.onSurfaceVariant,
        )
        if (onRetry != null && kind != ErrorKind.TENANT_REQUIRED) {
            CompactChip(
                onClick = onRetry,
                label = { Text("Retry") },
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        if (onSignOut != null) {
            CompactChip(
                onClick = onSignOut,
                label = { Text("Sign out") },
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

/** Colour-coded dot used as a Chip icon in the room list. */
@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(10.dp)
            .background(color = color, shape = CircleShape),
    )
}

/** One "PM2.5 · 12.4 µg/m³" line on the room detail screen. */
@Composable
fun MetricRow(
    label: String,
    value: String,
    unit: String?,
    valueColor: Color?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.caption2,
            color = MaterialTheme.colors.onSurfaceVariant,
        )
        Text(
            text = if (unit != null) "$value $unit" else value,
            style = MaterialTheme.typography.body2,
            color = valueColor ?: MaterialTheme.colors.onSurface,
        )
    }
}
