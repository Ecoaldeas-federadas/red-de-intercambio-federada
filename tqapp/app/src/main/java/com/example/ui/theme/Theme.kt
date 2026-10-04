package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val WhatsAppDarkColorScheme = darkColorScheme(
    primary = WhatsAppGreenAccent,
    onPrimary = Color.Black,
    primaryContainer = WhatsAppGreenBubbleDark,
    onPrimaryContainer = Color.White,
    secondary = WhatsAppGreenTeal,
    onSecondary = Color.White,
    tertiary = WhatsAppBlueTick,
    background = WhatsAppBgDark,
    onBackground = WhatsAppTextPrimaryDark,
    surface = WhatsAppSurfaceDark,
    onSurface = WhatsAppTextPrimaryDark,
    surfaceVariant = WhatsAppSurfaceDarkVariant,
    onSurfaceVariant = WhatsAppTextSecondaryDark
)

private val WhatsAppLightColorScheme = lightColorScheme(
    primary = WhatsAppGreenPrimary,
    onPrimary = Color.White,
    primaryContainer = WhatsAppGreenLight,
    onPrimaryContainer = WhatsAppTextPrimaryLight,
    secondary = WhatsAppGreenTeal,
    onSecondary = Color.White,
    tertiary = WhatsAppGreenAccent,
    background = WhatsAppBgLight,
    onBackground = WhatsAppTextPrimaryLight,
    surface = WhatsAppSurfaceLight,
    onSurface = WhatsAppTextPrimaryLight,
    surfaceVariant = Color(0xFFF0F2F5),
    onSurfaceVariant = WhatsAppTextSecondaryLight
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) WhatsAppDarkColorScheme else WhatsAppLightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
