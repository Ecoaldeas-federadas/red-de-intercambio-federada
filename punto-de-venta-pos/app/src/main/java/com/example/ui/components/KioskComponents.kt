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
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.example.data.api.DEFAULT_DOCUMENT_TYPES
import com.example.data.api.DocumentTypeItem
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper

@Composable
fun KioskAmountDisplay(
    amountInput: String,
    modifier: Modifier = Modifier,
    label: String = "Monto a Cobrar"
) {
    // POS-style decimal: input is in centavos. "1" = 0.01 TQ, "100" = 1.00 TQ
    val centavos = amountInput.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
    val formatted = CurrencyHelper.formatCentavos(centavos)

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
                text = if (centavos == 0L) CurrencyHelper.formatCentavos(0L) else formatted,
                style = MaterialTheme.typography.displayMedium,
                color = if (centavos > 0) PosPrimaryLight else PosSlate600,
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
    // POS-style decimal keypad: digits enter as centavos from the right.
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

@Composable
fun KioskDocumentDisplay(
    docType: String,
    documentNumber: String,
    onDocTypeChange: (String) -> Unit,
    onClear: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    label: String = "Documento de Identidad",
    accentColor: Color = PosPrimaryLight,
    testTag: String = "id_doc_number_input",
    availableDocTypes: List<DocumentTypeItem> = DEFAULT_DOCUMENT_TYPES
) {
    val context = LocalContext.current
    var docTypeDropdownExpanded by remember { mutableStateOf(false) }
    val currentDocTypeObj = availableDocTypes.find { it.code == docType }
    val currentDocTypeName = currentDocTypeObj?.spanishName ?: docType

    // Two-line layout: Top line for Document Type selector & Clear action, Bottom line for multiline Document number
    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag(testTag),
        colors = CardDefaults.cardColors(containerColor = PosNavyDark.copy(alpha = 0.95f)),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.5.dp,
            if (documentNumber.isNotEmpty()) accentColor.copy(alpha = 0.8f) else PosSlate700
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // LÍNEA SUPERIOR: Tipo de Documento + Botón de Limpiar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Selector de Tipo de Documento con Menú Desplegable
                Box {
                    Surface(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            docTypeDropdownExpanded = true
                        },
                        shape = RoundedCornerShape(10.dp),
                        color = accentColor.copy(alpha = 0.18f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, accentColor.copy(alpha = 0.5f)),
                        modifier = Modifier.testTag("doc_type_selector_btn")
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Badge,
                                contentDescription = null,
                                tint = accentColor,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "$currentDocTypeName (${docType.uppercase()})",
                                color = accentColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = "Seleccionar tipo de documento",
                                tint = accentColor,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = docTypeDropdownExpanded,
                        onDismissRequest = { docTypeDropdownExpanded = false },
                        modifier = Modifier.background(PosSlate800)
                    ) {
                        availableDocTypes.forEach { item ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = "${item.spanishName} (${item.code})",
                                        color = if (item.code == docType) accentColor else PosSlate100,
                                        fontWeight = if (item.code == docType) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    onDocTypeChange(item.code)
                                    docTypeDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                // Botón de Borrar / Limpiar si hay texto
                if (documentNumber.isNotEmpty() && onClear != null) {
                    Surface(
                        onClick = {
                            FeedbackHelper.playKeyClick(context)
                            onClear()
                        },
                        shape = RoundedCornerShape(8.dp),
                        color = PosErrorRed.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, PosErrorRed.copy(alpha = 0.3f)),
                        modifier = Modifier.testTag("clear_doc_display_btn")
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Limpiar documento",
                                tint = PosErrorRedLight,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Borrar",
                                color = PosErrorRedLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // LÍNEA INFERIOR: Visualización Multilínea del Número de Documento (100% visible, sin recortes)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = PosSlate900.copy(alpha = 0.8f),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, PosSlate700)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    if (documentNumber.isEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "${docType.uppercase()}-",
                                color = PosSlate500,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            Text(
                                text = "Ingrese número con el teclado abajo...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate500,
                                fontSize = 13.sp
                            )
                        }
                    } else {
                        Row(
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "${docType.uppercase()}-",
                                color = accentColor,
                                fontWeight = FontWeight.Black,
                                fontSize = 20.sp
                            )
                            // Text multilínea que nunca se corta ni se trunca aunque sea muy largo
                            Text(
                                text = documentNumber,
                                style = MaterialTheme.typography.titleLarge,
                                color = PosSlate100,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                letterSpacing = 1.2.sp,
                                softWrap = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

enum class DocumentKeypadMode {
    NUMERIC,
    ALPHANUMERIC,
    SYMBOLS
}

@Composable
fun KioskDocumentKeypad(
    documentNumber: String,
    onDocumentChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    initialMode: DocumentKeypadMode = DocumentKeypadMode.NUMERIC
) {
    val context = LocalContext.current
    var keypadMode by remember(initialMode) { mutableStateOf(initialMode) }
    var isUpperCase by remember { mutableStateOf(false) }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Mode Switcher Header with 3 direct tabs: [123] [ABC] [?@#] + [Limpiar]
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Mode Segmented Buttons
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.testTag("toggle_doc_keypad_mode")
            ) {
                listOf(
                    DocumentKeypadMode.NUMERIC to "123",
                    DocumentKeypadMode.ALPHANUMERIC to "ABC",
                    DocumentKeypadMode.SYMBOLS to "?@#"
                ).forEach { (mode, label) ->
                    val isSelected = keypadMode == mode
                    Surface(
                        onClick = {
                            FeedbackHelper.playKeyClick(context)
                            keypadMode = mode
                        },
                        shape = RoundedCornerShape(10.dp),
                        color = if (isSelected) PosPrimaryBlue else PosSlate800,
                        modifier = Modifier.testTag("doc_mode_${label.lowercase()}")
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) PosWhite else PosSlate300,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            if (documentNumber.isNotEmpty()) {
                TextButton(
                    onClick = {
                        FeedbackHelper.playKeyClick(context)
                        onDocumentChange("")
                    },
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text("Limpiar", color = PosErrorRedLight, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        when (keypadMode) {
            DocumentKeypadMode.NUMERIC -> {
                // 3x4 Numeric Keypad with ABC, Symbols and DEL
                val rows = listOf(
                    listOf("1", "2", "3"),
                    listOf("4", "5", "6"),
                    listOf("7", "8", "9"),
                    listOf("ABC", "0", "DEL")
                )

                rows.forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row.forEach { key ->
                            val bgColor = when (key) {
                                "DEL" -> PosSlate700
                                "ABC" -> PosPrimaryDark.copy(alpha = 0.6f)
                                else -> PosSlate800
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(bgColor)
                                    .clickable {
                                        FeedbackHelper.playKeyClick(context)
                                        when (key) {
                                            "DEL" -> {
                                                if (documentNumber.isNotEmpty()) {
                                                    onDocumentChange(documentNumber.dropLast(1))
                                                }
                                            }
                                            "ABC" -> {
                                                keypadMode = DocumentKeypadMode.ALPHANUMERIC
                                            }
                                            else -> {
                                                if (documentNumber.length < 60) {
                                                    onDocumentChange(documentNumber + key)
                                                }
                                            }
                                        }
                                    }
                                    .testTag("doc_key_${key}"),
                                contentAlignment = Alignment.Center
                            ) {
                                if (key == "DEL") {
                                    Icon(
                                        imageVector = Icons.Default.Backspace,
                                        contentDescription = "Borrar",
                                        tint = PosSlate100,
                                        modifier = Modifier.size(24.dp)
                                    )
                                } else if (key == "ABC") {
                                    Text(
                                        text = "ABC",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosPrimaryLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                } else {
                                    Text(
                                        text = key,
                                        style = MaterialTheme.typography.headlineSmall,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
            DocumentKeypadMode.ALPHANUMERIC -> {
                // Alphanumeric On-Screen Keyboard with Shift and Symbol shortcuts
                val numberRow = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0")
                val rawRow1 = listOf("Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P")
                val rawRow2 = listOf("A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ")
                val rawRow3 = listOf("Z", "X", "C", "V", "B", "N", "M")

                val row1 = if (isUpperCase) rawRow1 else rawRow1.map { it.lowercase() }
                val row2 = if (isUpperCase) rawRow2 else rawRow2.map { it.lowercase() }
                val row3 = if (isUpperCase) rawRow3 else rawRow3.map { it.lowercase() }

                // Numbers row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    numberRow.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate700)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_alpha_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Row 1 (QWERTY)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    row1.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_alpha_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Row 2 (ASDFG)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    row2.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_alpha_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Row 3 (Shift + ZXCVB + DEL)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Shift / Mayús toggle
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isUpperCase) PosPrimaryBlue else PosSlate700)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                isUpperCase = !isUpperCase
                            }
                            .testTag("doc_alpha_shift"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isUpperCase) "⇧ MAY" else "⇧ min",
                            color = if (isUpperCase) PosWhite else PosSlate300,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }

                    row3.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_alpha_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    // DEL button
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosSlate700)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                if (documentNumber.isNotEmpty()) {
                                    onDocumentChange(documentNumber.dropLast(1))
                                }
                            }
                            .testTag("doc_alpha_del"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Backspace,
                            contentDescription = "Borrar",
                            tint = PosSlate100,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Row 4 (123, ?@#, @, ., _, -, Espacio)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // 123 switch
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosPrimaryDark.copy(alpha = 0.7f))
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                keypadMode = DocumentKeypadMode.NUMERIC
                            }
                            .testTag("doc_alpha_123"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "123", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    // ?@# switch
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosPrimaryDark.copy(alpha = 0.7f))
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                keypadMode = DocumentKeypadMode.SYMBOLS
                            }
                            .testTag("doc_alpha_symbols"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "?@#", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    // Quick keys: @, ., _, -
                    listOf("@", ".", "_", "-").forEach { sym ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (sym == "@") PosPrimaryBlue.copy(alpha = 0.5f) else PosSlate700)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + sym)
                                    }
                                }
                                .testTag("doc_alpha_key_$sym"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = sym, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    // Espacio
                    Box(
                        modifier = Modifier
                            .weight(2.4f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosSlate700)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                if (documentNumber.length < 60) {
                                    onDocumentChange(documentNumber + " ")
                                }
                            }
                            .testTag("doc_alpha_space"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "ESPACIO", color = PosSlate300, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                    }
                }
            }
            DocumentKeypadMode.SYMBOLS -> {
                // Complete Symbols On-Screen Keyboard
                val numberRow = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0")
                val symRow1 = listOf("@", "#", "$", "%", "&", "*", "-", "+", "(", ")")
                val symRow2 = listOf("!", "\"", "'", ":", ";", "/", "?", "~", "\\", "_")
                val symRow3 = listOf("=", "<", ">", "[", "]", "{", "}", "^")

                // Top numbers row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    numberRow.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate700)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_sym_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Symbols Row 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    symRow1.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (key == "@" || key == "_" || key == "-") PosPrimaryDark.copy(alpha = 0.5f) else PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_sym_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Symbols Row 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    symRow2.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (key == "_") PosPrimaryDark.copy(alpha = 0.5f) else PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_sym_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Symbols Row 3 (ABC switch + symbols + DEL)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // ABC switch
                    Box(
                        modifier = Modifier
                            .weight(1.5f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosPrimaryDark.copy(alpha = 0.7f))
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                keypadMode = DocumentKeypadMode.ALPHANUMERIC
                            }
                            .testTag("doc_sym_abc"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "ABC", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }

                    symRow3.forEach { key ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PosSlate800)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + key)
                                    }
                                }
                                .testTag("doc_sym_key_$key"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = key, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    // DEL button
                    Box(
                        modifier = Modifier
                            .weight(1.5f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosSlate700)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                if (documentNumber.isNotEmpty()) {
                                    onDocumentChange(documentNumber.dropLast(1))
                                }
                            }
                            .testTag("doc_sym_del"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Backspace,
                            contentDescription = "Borrar",
                            tint = PosSlate100,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Symbols Row 4 (123, @, ., ,, -, ESPACIO)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // 123 switch
                    Box(
                        modifier = Modifier
                            .weight(1.4f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosPrimaryDark.copy(alpha = 0.7f))
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                keypadMode = DocumentKeypadMode.NUMERIC
                            }
                            .testTag("doc_sym_123"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "123", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    listOf("@", ".", ",", "-").forEach { sym ->
                        Box(
                            modifier = Modifier
                                .weight(1.1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (sym == "@") PosPrimaryBlue.copy(alpha = 0.6f) else PosSlate700)
                                .clickable {
                                    FeedbackHelper.playKeyClick(context)
                                    if (documentNumber.length < 60) {
                                        onDocumentChange(documentNumber + sym)
                                    }
                                }
                                .testTag("doc_sym_key_$sym"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = sym, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    // Space
                    Box(
                        modifier = Modifier
                            .weight(2.6f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(PosSlate700)
                            .clickable {
                                FeedbackHelper.playKeyClick(context)
                                if (documentNumber.length < 60) {
                                    onDocumentChange(documentNumber + " ")
                                }
                            }
                            .testTag("doc_sym_space"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "ESPACIO", color = PosSlate300, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

