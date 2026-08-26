package com.smartecoenterprise.app.wear.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

/**
 * Wear Compose Material (M2.5) theme.
 *
 * Uses androidx.wear.compose.material — NOT androidx.compose.material/material3.
 * The phone Material libraries compile fine here but lay out at phone sizes, which
 * looks broken on a 450px round display.
 */

val Background = Color(0xFF000000)
val Surface = Color(0xFF1C1B1F)
val OnSurface = Color(0xFFE6E1E5)
val OnSurfaceVariant = Color(0xFFB0B0B0)
val Primary = Color(0xFF4CAF50)
val ErrorRed = Color(0xFFFF5252)

private val WearColorPalette = Colors(
    primary = Primary,
    primaryVariant = Color(0xFF2E7D32),
    secondary = Color(0xFF80CBC4),
    secondaryVariant = Color(0xFF4DB6AC),
    background = Background,
    surface = Surface,
    error = ErrorRed,
    onPrimary = Color(0xFF000000),
    onSecondary = Color(0xFF000000),
    onBackground = OnSurface,
    onSurface = OnSurface,
    onSurfaceVariant = OnSurfaceVariant,
    onError = Color(0xFF000000),
)

@Composable
fun SmartEcoWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = WearColorPalette, content = content)
}
