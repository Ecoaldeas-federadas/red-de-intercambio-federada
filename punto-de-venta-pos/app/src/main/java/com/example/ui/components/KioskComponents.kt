package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper

@Composable
fun KioskAmountDisplay(
    amountInput: String,
    modifier: Modifier = Modifier,
    label: String = "Monto a Cobrar"
) {
    // POS-style decimal: input is in centimos. "1" = 0.01 TQ, "100" = 1.00 TQ
    val centimos = amountInput.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
    val microUnits = centimos // centimos map directly to micro-units
    val formatted = CurrencyHelper.formatMicroUnits(microUnits)

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("kiosk_amount_display"),
        colors = CardDefaults.cardColors(containerColor = PosSlate800),
        shape = RoundedCornerShape(20.dp),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(PosSlate700))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 18.dp, horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelMedium,
                color = PosSlate300,
                letterSpacing = 1.2.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = if (centimos == 0L) CurrencyHelper.formatMicroUnits(0L) else formatted,
                style = MaterialTheme.typography.displayMedium,
                color = if (centimos > 0) PosPrimaryLight else PosSlate600,
                fontWeight = FontWeight.Black
            )
        }
    }
}

@Composable
fun KioskNumericKeypad(
    currentInput: String,
    onInputChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    // POS-style decimal keypad: digits enter as centimos from the right.
    // "1" → 0.01, "10" → 0.10, "100" → 1.00, "1234" → 12.34
    // No decimal point button, no quick-add buttons.
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Numeric Keypad Grid 3x4 (no decimal point, no quick-add)
        val rows = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("C", "0", "DEL")
        )

        rows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                row.forEach { key ->
                    val bgColor = when (key) {
                        "DEL" -> PosSlate700
                        "C" -> PosErrorRed.copy(alpha = 0.3f)
                        else -> PosSlate800
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(64.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(bgColor)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                when (key) {
                                    "DEL" -> {
                                        if (currentInput.isNotEmpty()) {
                                            onInputChange(currentInput.dropLast(1))
                                        }
                                    }
                                    "C" -> {
                                        onInputChange("")
                                    }
                                    else -> {
                                        // Limit to 9 digits (max 999,999.99 TQ)
                                        val digits = currentInput.replace(Regex("[^0-9]"), "")
                                        if (digits.length < 9) {
                                            onInputChange(digits + key)
                                        }
                                    }
                                }
                            }
                            .testTag("keypad_btn_$key"),
                        contentAlignment = Alignment.Center
                    ) {
                        when (key) {
                            "DEL" -> {
                                Icon(
                                    imageVector = Icons.Default.Backspace,
                                    contentDescription = "Borrar",
                                    tint = PosSlate100,
                                    modifier = Modifier.size(26.dp)
                                )
                            }
                            "C" -> {
                                Text(
                                    text = "C",
                                    style = MaterialTheme.typography.headlineMedium,
                                    color = PosErrorRedLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            else -> {
                                Text(
                                    text = key,
                                    style = MaterialTheme.typography.headlineMedium,
                                    color = PosSlate100,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PinInputPad(
    pin: String,
    onPinChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    title: String = "Ingrese PIN de 4 dígitos"
) {
    val context = LocalContext.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = PosSlate100,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(16.dp))

        // 4 PIN Dots
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(vertical = 12.dp)
        ) {
            for (i in 0 until 4) {
                val filled = i < pin.length
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(if (filled) PosPrimaryLight else PosSlate700)
                        .border(1.5.dp, if (filled) PosPrimaryLight else PosSlate600, CircleShape)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // 3x4 Pin Pad
        val rows = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("C", "0", "DEL")
        )

        rows.forEach { row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                row.forEach { key ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(PosSlate800)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                when (key) {
                                    "C" -> onPinChange("")
                                    "DEL" -> if (pin.isNotEmpty()) onPinChange(pin.dropLast(1))
                                    else -> if (pin.length < 4) onPinChange(pin + key)
                                }
                            }
                            .testTag("pin_btn_$key"),
                        contentAlignment = Alignment.Center
                    ) {
                        if (key == "DEL") {
                            Icon(
                                imageVector = Icons.Default.Backspace,
                                contentDescription = "Borrar dígito",
                                tint = PosSlate100
                            )
                        } else {
                            Text(
                                text = key,
                                style = MaterialTheme.typography.titleLarge,
                                color = PosSlate100,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NfcWaveAnimation(
    modifier: Modifier = Modifier,
    isCardDetected: Boolean = false,
    cardType: String? = null
) {
    val infiniteTransition = rememberInfiniteTransition(label = "nfc_waves")
    val waveScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave_scale"
    )
    val waveAlpha by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave_alpha"
    )

    Box(
        modifier = modifier
            .size(160.dp)
            .testTag("nfc_wave_animation"),
        contentAlignment = Alignment.Center
    ) {
        if (!isCardDetected) {
            // Radiating rings
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .scale(waveScale)
                    .clip(CircleShape)
                    .background(PosPrimaryLight.copy(alpha = waveAlpha * 0.4f))
            )
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .scale(waveScale * 0.85f)
                    .clip(CircleShape)
                    .background(PosPrimaryLight.copy(alpha = waveAlpha * 0.6f))
            )
        }

        // Center NFC Icon / Badge
        Box(
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
                .background(if (isCardDetected) PosSuccessGreen else PosSlate800)
                .border(3.dp, if (isCardDetected) PosSuccessGreenLight else PosPrimaryLight, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Nfc,
                contentDescription = "NFC Contactless",
                tint = if (isCardDetected) PosNavyDark else PosPrimaryLight,
                modifier = Modifier.size(48.dp)
            )
        }
    }
}

@Composable
fun MultisigCountdownHeader(
    remainingSeconds: Long,
    requiredSignatures: Int,
    collectedSignatures: Int,
    modifier: Modifier = Modifier
) {
    val minutes = remainingSeconds / 60
    val seconds = remainingSeconds % 60
    val timeStr = "%02d:%02d".format(minutes, seconds)
    val isUrgent = remainingSeconds < 120

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("multisig_countdown_header"),
        colors = CardDefaults.cardColors(
            containerColor = if (isUrgent) PosErrorRed.copy(alpha = 0.2f) else PosWarningAmber.copy(alpha = 0.15f)
        ),
        shape = RoundedCornerShape(16.dp),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(if (isUrgent) PosErrorRed else PosWarningAmber)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "PAGO MULTI-FIRMA",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isUrgent) PosErrorRedLight else PosWarningAmberLight,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Firmas: $collectedSignatures de $requiredSignatures completadas",
                    style = MaterialTheme.typography.bodyMedium,
                    color = PosSlate100
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isUrgent) PosErrorRed else PosWarningAmber)
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(
                    text = timeStr,
                    style = MaterialTheme.typography.titleLarge,
                    color = PosNavyDark,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}
