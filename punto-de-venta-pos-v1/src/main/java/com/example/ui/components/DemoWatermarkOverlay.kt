package com.example.ui.components

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun DemoWatermarkOverlay(
    isDemo: Boolean,
    modifier: Modifier = Modifier,
    onBannerClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier = modifier.fillMaxSize()) {
        // Screen Content
        content()

        if (isDemo) {
            // Diagonal Watermarks on canvas over/under (with non-blocking touch)
            DemoWatermarkCanvas(
                modifier = Modifier
                    .fillMaxSize()
            )

            // Top Persistent Warning Badge / Banner
            DemoTopHeaderBanner(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars),
                onClick = onBannerClick
            )
        }
    }
}

@Composable
fun DemoWatermarkCanvas(modifier: Modifier = Modifier) {
    val watermarkPaint = remember {
        Paint().apply {
            color = android.graphics.Color.argb(22, 245, 158, 11) // Gold with subtle opacity
            textSize = 42f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.15f
        }
    }

    val smallWatermarkPaint = remember {
        Paint().apply {
            color = android.graphics.Color.argb(16, 239, 68, 68) // Red with subtle opacity
            textSize = 28f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.1f
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxSize()
    ) {
        val w = size.width
        val h = size.height

        drawIntoCanvas { canvas ->
            withTransform({
                rotate(-28f, pivot = androidx.compose.ui.geometry.Offset(w / 2f, h / 2f))
            }) {
                val stepY = 160f
                val stepX = 400f
                val startY = -h * 0.5f
                val endY = h * 1.8f
                val startX = -w * 0.8f
                val endX = w * 1.8f

                var row = 0
                var y = startY
                while (y < endY) {
                    val offsetX = if (row % 2 == 0) 0f else stepX / 2f
                    var x = startX + offsetX
                    while (x < endX) {
                        if (row % 2 == 0) {
                            canvas.nativeCanvas.drawText("⚡ MODO DEMO • SIMULACIÓN", x, y, watermarkPaint)
                        } else {
                            canvas.nativeCanvas.drawText("⚠️ NO ES TRANSACCIÓN REAL", x, y, smallWatermarkPaint)
                        }
                        x += stepX
                    }
                    y += stepY
                    row++
                }
            }
        }
    }
}

@Composable
fun DemoTopHeaderBanner(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Surface(
        color = PosGold.copy(alpha = 0.95f),
        contentColor = PosNavyDark,
        shadowElevation = 4.dp,
        modifier = modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, PosGoldLight, RoundedCornerShape(10.dp))
            .then(
                if (onClick != null) Modifier.clickable { onClick() } else Modifier
            )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Science,
                contentDescription = "Demo Mode",
                tint = PosNavyDark,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "MODO DEMOSTRACIÓN — TRANSACCIONES SIMULADAS (NO REALES)",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Black,
                color = PosNavyDark,
                fontSize = 11.sp
            )
        }
    }
}
