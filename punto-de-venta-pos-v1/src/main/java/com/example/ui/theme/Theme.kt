package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = PosPrimaryLight,
    onPrimary = PosNavyDark,
    primaryContainer = PosSlate700,
    onPrimaryContainer = PosPrimaryLight,
    secondary = PosSecondaryLight,
    onSecondary = PosNavyDark,
    secondaryContainer = PosSlate800,
    onSecondaryContainer = PosSecondaryLight,
    tertiary = PosGoldLight,
    onTertiary = PosNavyDark,
    background = PosNavyDark,
    onBackground = PosSlate100,
    surface = PosSlate900,
    onSurface = PosSlate100,
    surfaceVariant = PosSlate800,
    onSurfaceVariant = PosSlate300,
    outline = PosSlate600,
    error = PosErrorRedLight,
    onError = PosNavyDark
)

private val LightColorScheme = lightColorScheme(
    primary = PosPrimaryBlue,
    onPrimary = PosWhite,
    primaryContainer = PosSlate100,
    onPrimaryContainer = PosPrimaryBlue,
    secondary = PosSecondaryTeal,
    onSecondary = PosWhite,
    secondaryContainer = PosSlate100,
    onSecondaryContainer = PosSecondaryTeal,
    tertiary = PosGold,
    onTertiary = PosWhite,
    background = PosNavyDark, // Default to sleek kiosk dark for POS
    onBackground = PosSlate100,
    surface = PosSlate900,
    onSurface = PosSlate100,
    surfaceVariant = PosSlate800,
    onSurfaceVariant = PosSlate300,
    outline = PosSlate600,
    error = PosErrorRed,
    onError = PosWhite
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = true, // POS kiosk mode defaults to dark high-contrast
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
        typography = PosTypography,
        content = content
    )
}
