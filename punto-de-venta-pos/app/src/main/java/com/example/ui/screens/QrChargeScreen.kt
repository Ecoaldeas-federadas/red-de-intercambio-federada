package com.example.ui.screens

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
                    placeholder = { Text("Ej. Compra de verduras") },
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
                            text = "Generar Código QR",
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
                        .padding(vertical = 20.dp),
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

                        Text(
                            text = "El cliente ha completado el pago desde su dispositivo de forma exitosa.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
                        )

                        HorizontalDivider(color = PosSlate800)

                        Button(
                            onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
            } else {
                // --- STEP 2A: LIVE QR CODE DISPLAY ---
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
                                text = "Esperando confirmación del cliente...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300
                            )
                        }

                        Text(
                            text = "El cliente debe escanear el QR con la cámara de su celular o ingresar al enlace.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate600,
                            textAlign = TextAlign.Center
                        )

                        OutlinedButton(
                            onClick = { viewModel.cancelQrCharge() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .testTag("cancel_qr_btn"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = PosErrorRedLight
                            ),
                            border = ButtonDefaults.outlinedButtonBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(PosErrorRed)
                            )
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
