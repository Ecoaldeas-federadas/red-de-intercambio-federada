package com.example.ui.screens

import android.graphics.Bitmap
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.KioskAmountDisplay
import com.example.ui.components.KioskNumericKeypad
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.QrCodeHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrChargeScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val isChargeGenerated = (uiState.qrChargeResponse != null && uiState.qrPayUrl != null)
    val isPaid = (uiState.qrStatus == "paid")
    val isExpired = (uiState.qrStatus == "expired" || (isChargeGenerated && uiState.qrRemainingSeconds <= 0 && !isPaid))
    val isMultisig = (uiState.qrRequiredSignatures > 1 || uiState.qrCollectedSignatures > 0 || uiState.qrStatus == "partially_signed")

    var qrBitmap by remember(uiState.qrPayUrl) {
        mutableStateOf<Bitmap?>(null)
    }

    LaunchedEffect(uiState.qrPayUrl) {
        val url = uiState.qrPayUrl
        if (!url.isNullOrBlank()) {
            qrBitmap = QrCodeHelper.generateQrBitmap(url, 600)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Cobro con Código QR",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (isChargeGenerated && !isPaid) {
                                viewModel.cancelQrCharge()
                            }
                            viewModel.navigateTo(PosScreen.Dashboard)
                        },
                        modifier = Modifier.testTag("qr_back_btn")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = PosSlate100
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PosSlate900)
            )
        },
        containerColor = PosNavyDark
    ) { padding ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Alerts / Error Messages
            if (!uiState.errorMessage.isNullOrBlank() && !isExpired) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosErrorRed)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(imageVector = Icons.Default.Error, contentDescription = null, tint = PosErrorRedLight)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.errorMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            if (!uiState.successMessage.isNullOrBlank() && !isPaid) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSuccessGreen.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosSuccessGreen)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = PosSuccessGreenLight)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.successMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            if (!isChargeGenerated) {
                // --- STEP 1: AMOUNT INPUT KEYPAD ---
                KioskAmountDisplay(
                    amountInput = uiState.amountInput,
                    label = "Monto del Cobro QR"
                )

                OutlinedTextField(
                    value = uiState.chargeDescription,
                    onValueChange = { viewModel.setChargeDescription(it) },
                    label = { Text("Concepto o Descripción (opcional)") },
                    placeholder = { Text("Ej. Compra en feria") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("qr_desc_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = PosSlate100,
                        unfocusedTextColor = PosSlate100,
                        focusedBorderColor = PosPrimaryLight,
                        unfocusedBorderColor = PosSlate700
                    )
                )

                KioskNumericKeypad(
                    currentInput = uiState.amountInput,
                    onInputChange = { viewModel.setAmountInput(it) }
                )

                Button(
                    onClick = { viewModel.startQrCharge() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .testTag("generate_qr_btn"),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PosPrimaryBlue,
                        contentColor = PosWhite
                    ),
                    enabled = !uiState.isLoading && uiState.amountInput.isNotBlank() && uiState.amountInput != "0"
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                    } else {
                        Icon(imageVector = Icons.Default.QrCode, contentDescription = null)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Generar Código QR (3 Min)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            } else if (isPaid) {
                // --- STEP 2B: SUCCESS SCREEN ---
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(24.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(PosSuccessGreen)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(40.dp))
                                .background(PosSuccessGreen.copy(alpha = 0.2f))
                                .border(2.dp, PosSuccessGreen, RoundedCornerShape(40.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Aprobado",
                                tint = PosSuccessGreenLight,
                                modifier = Modifier.size(48.dp)
                            )
                        }

                        Text(
                            text = "¡PAGO CONFIRMADO!",
                            style = MaterialTheme.typography.headlineMedium,
                            color = PosSuccessGreenLight,
                            fontWeight = FontWeight.Black
                        )

                        Text(
                            text = CurrencyHelper.formatMicroUnits(
                                CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)
                            ),
                            style = MaterialTheme.typography.displayMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Black
                        )

                        if (uiState.qrRequiredSignatures > 1) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = PosPrimaryBlue.copy(alpha = 0.2f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, PosPrimaryLight)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = PosPrimaryLight, modifier = Modifier.size(18.dp))
                                    Text(
                                        text = "Completado con ${uiState.qrCollectedSignatures} de ${uiState.qrRequiredSignatures} firmas requeridas",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = PosPrimaryLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Text(
                            text = "El cobro ha sido liquidado exitosamente en el nodo comunitario.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
                        )

                        HorizontalDivider(color = PosSlate800)

                        Button(
                            onClick = {
                                viewModel.resetQrCharge()
                                viewModel.navigateTo(PosScreen.Dashboard)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .testTag("qr_done_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosSuccessGreen)
                        ) {
                            Text(text = "Finalizar y Volver al Menú", fontWeight = FontWeight.Bold, color = PosNavyDark)
                        }
                    }
                }
            } else if (isExpired) {
                // --- STEP 2C: EXPIRED SCREEN (TIEMPO AGOTADO) ---
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(24.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(PosWarningAmber)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(40.dp))
                                .background(PosWarningAmber.copy(alpha = 0.2f))
                                .border(2.dp, PosWarningAmber, RoundedCornerShape(40.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.TimerOff,
                                contentDescription = "Vencido",
                                tint = PosWarningAmberLight,
                                modifier = Modifier.size(48.dp)
                            )
                        }

                        Text(
                            text = "CÓDIGO QR VENCIDO",
                            style = MaterialTheme.typography.headlineSmall,
                            color = PosWarningAmberLight,
                            fontWeight = FontWeight.Black
                        )

                        Text(
                            text = "Se agotó el límite de 3 minutos sin recibir la confirmación de pago.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            text = CurrencyHelper.formatMicroUnits(
                                CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)
                            ),
                            style = MaterialTheme.typography.headlineMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Bold
                        )

                        HorizontalDivider(color = PosSlate800)

                        Button(
                            onClick = { viewModel.startQrCharge() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Generar Nuevo Código QR (3 Min)", fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = { viewModel.cancelQrCharge() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate200),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosSlate700)
                        ) {
                            Text("Cambiar Monto o Cancelar", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                // --- STEP 2A: LIVE QR CODE DISPLAY WITH COUNTDOWN TIMER & MULTISIG ---
                val remainingSeconds = uiState.qrRemainingSeconds
                val minutes = remainingSeconds / 60
                val seconds = remainingSeconds % 60
                val formattedTime = String.format("%02d:%02d", minutes, seconds)
                val initialSec = uiState.qrInitialSeconds.coerceAtLeast(180)
                val progressFraction = (remainingSeconds.toFloat() / initialSec.toFloat()).coerceIn(0f, 1f)

                val timerColor = when {
                    remainingSeconds <= 30 -> PosErrorRedLight
                    remainingSeconds <= 60 -> PosWarningAmberLight
                    else -> PosSuccessGreenLight
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(24.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(PosSlate700)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // --- COUNTDOWN TIMER BAR ---
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = timerColor.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, timerColor.copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.HourglassBottom,
                                            contentDescription = null,
                                            tint = timerColor,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = if (isMultisig) "Tiempo para esta firma:" else "Tiempo de validez:",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = PosSlate200,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }

                                    Text(
                                        text = formattedTime,
                                        style = MaterialTheme.typography.titleLarge,
                                        color = timerColor,
                                        fontWeight = FontWeight.Black
                                    )
                                }

                                LinearProgressIndicator(
                                    progress = { progressFraction },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = timerColor,
                                    trackColor = PosSlate800
                                )
                            }
                        }

                        // --- MULTI-SIGNATURE STATUS PANEL ---
                        if (isMultisig) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = PosPrimaryBlue.copy(alpha = 0.15f)),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, PosPrimaryLight.copy(alpha = 0.6f))
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Groups,
                                                contentDescription = null,
                                                tint = PosPrimaryLight,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(
                                                text = "Cobro Mancomunado",
                                                style = MaterialTheme.typography.titleSmall,
                                                color = PosSlate100,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }

                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = PosPrimaryLight.copy(alpha = 0.2f)
                                        ) {
                                            Text(
                                                text = "${uiState.qrCollectedSignatures} / ${uiState.qrRequiredSignatures} Firmas",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Black,
                                                color = PosPrimaryLight,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    // List of signatures
                                    val totalReq = uiState.qrRequiredSignatures.coerceAtLeast(1)
                                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        for (i in 1..totalReq) {
                                            val isSigned = i <= uiState.qrCollectedSignatures
                                            val isCurrent = i == uiState.qrCollectedSignatures + 1
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(
                                                        if (isSigned) PosSuccessGreen.copy(alpha = 0.12f)
                                                        else if (isCurrent) PosGold.copy(alpha = 0.12f)
                                                        else PosSlate800.copy(alpha = 0.3f),
                                                        RoundedCornerShape(8.dp)
                                                    )
                                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                if (isSigned) {
                                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PosSuccessGreenLight, modifier = Modifier.size(16.dp))
                                                    Text("Firma #$i: Confirmada y aprobada", style = MaterialTheme.typography.bodySmall, color = PosSuccessGreenLight, fontWeight = FontWeight.SemiBold)
                                                } else if (isCurrent) {
                                                    CircularProgressIndicator(color = PosGoldLight, modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                                                    Text("Firma #$i: Esperando escaneo/autorización...", style = MaterialTheme.typography.bodySmall, color = PosGoldLight, fontWeight = FontWeight.Bold)
                                                } else {
                                                    Icon(Icons.Default.RadioButtonUnchecked, contentDescription = null, tint = PosSlate600, modifier = Modifier.size(16.dp))
                                                    Text("Firma #$i: Pendiente", style = MaterialTheme.typography.bodySmall, color = PosSlate400)
                                                }
                                            }
                                        }
                                    }

                                    Text(
                                        text = "Cada firma recibida reinicia los 3 minutos para el siguiente firmante con este mismo código QR.",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = PosSlate300
                                    )
                                }
                            }
                        }

                        Text(
                            text = "ESCANEÉ PARA PAGAR",
                            style = MaterialTheme.typography.labelMedium,
                            color = PosPrimaryLight,
                            letterSpacing = 1.2.sp
                        )

                        Text(
                            text = CurrencyHelper.formatMicroUnits(
                                CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)
                            ),
                            style = MaterialTheme.typography.headlineLarge,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Black
                        )

                        // QR Code Image Container
                        Box(
                            modifier = Modifier
                                .size(240.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(PosWhite)
                                .padding(12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (qrBitmap != null) {
                                Image(
                                    bitmap = qrBitmap!!.asImageBitmap(),
                                    contentDescription = "Código QR de Cobro",
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                CircularProgressIndicator(color = PosNavyDark)
                            }
                        }

                        // Polling Status indicator
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(
                                color = PosPrimaryLight,
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (uiState.qrStatus == "partially_signed") {
                                    "Firma ${uiState.qrCollectedSignatures} recibida. Esperando siguiente..."
                                } else {
                                    "Esperando pago del cliente..."
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300
                            )
                        }

                        Text(
                            text = "El cliente debe escanear el QR con la cámara de su celular para autorizar.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate400,
                            textAlign = TextAlign.Center
                        )

                        // CANCEL BUTTON (Funcional y Directo)
                        Button(
                            onClick = {
                                viewModel.cancelQrCharge()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .testTag("cancel_qr_btn"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PosErrorRed.copy(alpha = 0.2f),
                                contentColor = PosErrorRedLight
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosErrorRed)
                        ) {
                            Icon(imageVector = Icons.Default.Cancel, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Cancelar Cobro QR", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

