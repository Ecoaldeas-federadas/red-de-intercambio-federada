package com.example.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.api.DEFAULT_DOCUMENT_TYPES
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NfcChargeScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val isCardDetected = !uiState.detectedCardUid.isNullOrBlank()
    val isPaymentApproved = (uiState.nfcPaymentResult?.status == "approved")

    var docTypeExpanded by remember { mutableStateOf(false) }

    // NFC flow steps: amount_input → confirm → tap_card
    // Only show "tap card" AFTER the operator confirms the amount
    var nfcStep by remember { mutableStateOf("amount_input") }

    // Reset step when entering screen or after payment completes
    LaunchedEffect(isPaymentApproved, isCardDetected, uiState.classicStep) {
        if (isPaymentApproved || uiState.classicStep == "done") {
            nfcStep = "amount_input"
        }
        // Si el pre-auth fue aprobado, ir a tap_card
        if (uiState.classicStep == "tap_card") {
            nfcStep = "tap_card"
        }
        // If card is detected, we must be in tap_card step
        if (isCardDetected && nfcStep != "tap_card" && uiState.classicStep == "tap_card") {
            nfcStep = "tap_card"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (uiState.isMultisigActive) "Cobro Multi-Firma" else "Terminal NFC",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.resetNfcPaymentState()
                            viewModel.navigateTo(PosScreen.Dashboard)
                        },
                        modifier = Modifier.testTag("nfc_back_btn")
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
            // NFC HARDWARE / ENABLED WARNING BANNER
            if (!uiState.hasNfcHardware) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosWarningAmber.copy(alpha = 0.15f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosWarningAmber)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = PosWarningAmberLight)
                        Text(
                            text = "Este dispositivo no cuenta con lector NFC integrado. Se requiere lector externo Bluetooth / Arduino.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosWarningAmberLight
                        )
                    }
                }
            } else if (!uiState.isNfcEnabled) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosWarningAmber.copy(alpha = 0.15f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosWarningAmber)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Nfc, contentDescription = null, tint = PosWarningAmberLight)
                            Text(
                                text = "El NFC del teléfono está desactivado",
                                style = MaterialTheme.typography.titleSmall,
                                color = PosWarningAmberLight,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = "Para poder leer las tarjetas de los clientes, debe activar la función NFC en los ajustes de Android.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate200
                        )
                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                try {
                                    val intent = android.content.Intent(android.provider.Settings.ACTION_NFC_SETTINGS)
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    val intent = android.content.Intent(android.provider.Settings.ACTION_SETTINGS)
                                    context.startActivity(intent)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = PosWarningAmber),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Settings, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Activar NFC en Ajustes", color = PosNavyDark, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // SERVER ERROR BANNER
            if (!uiState.errorMessage.isNullOrBlank() && !isPaymentApproved) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.2f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosErrorRed)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = PosErrorRedLight)
                            Text(
                                text = "No se pudo procesar el cobro",
                                style = MaterialTheme.typography.titleSmall,
                                color = PosErrorRedLight,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = uiState.errorMessage ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate100
                        )
                    }
                }
            }

            // MULTI-SIG LIVE COUNTDOWN HEADER
            if (uiState.isMultisigActive) {
                MultisigCountdownHeader(
                    remainingSeconds = uiState.multisigRemainingSeconds,
                    requiredSignatures = uiState.multisigRequiredSigs,
                    collectedSignatures = uiState.multisigCollectedSigs
                )
            }

            if (isPaymentApproved) {
                // --- SUCCESS RECEIPT SCREEN ---
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
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(76.dp)
                                .clip(RoundedCornerShape(38.dp))
                                .background(PosSuccessGreen.copy(alpha = 0.2f))
                                .border(2.dp, PosSuccessGreen, RoundedCornerShape(38.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Aprobado",
                                tint = PosSuccessGreenLight,
                                modifier = Modifier.size(44.dp)
                            )
                        }

                        Text(
                            text = "¡TRANSACCIÓN APROBADA!",
                            style = MaterialTheme.typography.titleLarge,
                            color = PosSuccessGreenLight,
                            fontWeight = FontWeight.Black
                        )

                        Text(
                            text = CurrencyHelper.formatCentavos(
                                CurrencyHelper.parseInputToCentavos(uiState.amountInput)
                            ),
                            style = MaterialTheme.typography.displayMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Black
                        )

                        HorizontalDivider(color = PosSlate800)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Tarjeta NFC:", color = PosSlate300)
                            Text(uiState.detectedCardUid ?: "NFC-CARD", color = PosSlate100, fontWeight = FontWeight.Bold)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Tipo de Tarjeta:", color = PosSlate300)
                            Text(
                                text = if (uiState.detectedCardType == "desfire") "DESFire EV3 Criptográfica" else "UID Estándar",
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Comprobante:", color = PosSlate300)
                            Text(
                                text = "NFC-${(uiState.nfcPaymentResult?.transactionId ?: "OK").take(8).uppercase()}",
                                color = PosSlate100,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.resetNfcPaymentState()
                                    nfcStep = "amount_input"
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_new_charge_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
                            ) {
                                Text("Nuevo Cobro", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.resetNfcPaymentState()
                                    viewModel.navigateTo(PosScreen.Dashboard)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_done_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosSuccessGreen)
                            ) {
                                Text("Finalizar", color = PosNavyDark, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else if (uiState.isMultisigActive && !isCardDetected) {
                // --- MULTI-SIG WAITING FOR NEXT SIGNER CARD ---
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosGold.copy(alpha = 0.5f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Header info
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Group, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "CUENTA MULTI-FIRMA",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = "Firma ${uiState.multisigCollectedSigs} de ${uiState.multisigRequiredSigs}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosSlate200,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Countdown
                        val min = uiState.multisigRemainingSeconds / 60
                        val sec = uiState.multisigRemainingSeconds % 60
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PosSlate800),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Timer, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Tiempo restante: ${String.format("%02d:%02d", min, sec)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }

                        NfcWaveAnimation(isCardDetected = false)

                        Text(
                            text = "ACERQUE LA TARJETA DEL FIRMANTE ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            text = "La firma anterior fue validada por el servidor. Coloque la tarjeta del siguiente titular o firmante autorizado en el reverso del dispositivo.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
                        )

                        // SIMULATION BUTTON FOR NEXT SIGNER (DEMO NODE)
                        if (uiState.isDemoNode) {
                            val nextSignerIndex = uiState.multisigCollectedSigs + 1
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    val simUid = if (uiState.multisigRequiredSigs == 3) {
                                        "CARD-MULTISIG-3F-FIRM$nextSignerIndex"
                                    } else {
                                        "CARD-MULTISIG-2F-FIRM$nextSignerIndex"
                                    }
                                    viewModel.onCardTapped(simUid, isDesfire = true)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .testTag("sim_next_signer_btn"),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                            ) {
                                Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Simular Tarjeta Firmante $nextSignerIndex de ${uiState.multisigRequiredSigs}",
                                    color = PosNavyDark,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.resetNfcPaymentState()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("nfc_cancel_multisig_btn"),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                        ) {
                            Text("Cancelar Pago Multi-Firma")
                        }
                    }
                }
            } else if (!isCardDetected) {
                // --- NFC FLOW: 3 steps ---
                // Step 1: amount_input → Step 2: confirm → Step 3: tap_card
                val centavos = uiState.amountInput.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
                val hasAmount = centavos > 0

                when (nfcStep) {
                    "amount_input" -> {
                        // STEP 1: Enter amount
                        KioskAmountDisplay(
                            amountInput = uiState.amountInput,
                            label = "Monto a Cobrar por NFC"
                        )

                        KioskNumericKeypad(
                            currentInput = uiState.amountInput,
                            onInputChange = { viewModel.setAmountInput(it) }
                        )

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                nfcStep = "credentials"
                            },
                            enabled = hasAmount,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .testTag("nfc_confirm_amount_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Text("Cobrar", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                    }

                    "credentials" -> {
                        // STEP 2: Documento + PIN (SIEMPRE obligatorio para NFC)
                        // El servidor pre-autentica y retorna el tipo de tarjeta
                        KioskAmountDisplay(
                            amountInput = uiState.amountInput,
                            label = "Monto a Pagar"
                        )

                        // Seccion de documento (SIEMPRE visible)
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PosSlate800),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Verificación de Identidad (OBLIGATORIO)",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold
                                )

                                // Document type selector
                                ExposedDropdownMenuBox(
                                    expanded = docTypeExpanded,
                                    onExpandedChange = { docTypeExpanded = !docTypeExpanded }
                                ) {
                                    OutlinedTextField(
                                        value = DEFAULT_DOCUMENT_TYPES.find { it.code == uiState.selectedDocType }?.spanishName ?: "Cédula",
                                        onValueChange = {},
                                        readOnly = true,
                                        label = { Text("Tipo de Documento") },
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = docTypeExpanded) },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .menuAnchor(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = PosSlate100,
                                            unfocusedTextColor = PosSlate100
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = docTypeExpanded,
                                        onDismissRequest = { docTypeExpanded = false }
                                    ) {
                                        DEFAULT_DOCUMENT_TYPES.forEach { doc ->
                                            DropdownMenuItem(
                                                text = { Text(doc.spanishName) },
                                                onClick = {
                                                    viewModel.setIdDocInfo(doc.code, uiState.idDocNumber)
                                                    docTypeExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = uiState.idDocNumber,
                                    onValueChange = { viewModel.setIdDocInfo(uiState.selectedDocType, it) },
                                    label = { Text("Número de Documento") },
                                    placeholder = { Text("Ej. 12345678") },
                                    singleLine = true,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("id_doc_number_input"),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = PosSlate100,
                                        unfocusedTextColor = PosSlate100
                                    )
                                )
                            }
                        }

                        // PIN Input Pad
                        PinInputPad(
                            pin = uiState.customerPin,
                            onPinChange = { viewModel.setCustomerPin(it) },
                            title = "PIN del Cliente"
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    nfcStep = "amount_input"
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_cancel_credentials_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Cambiar Monto", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitUnifiedPreAuth()
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_auth_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                                enabled = !uiState.isLoading &&
                                    uiState.customerPin.length == 4 &&
                                    uiState.idDocNumber.isNotBlank()
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Lock,
                                        contentDescription = null,
                                        tint = PosWhite
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Autenticar", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }
                        }
                    }

                    else -> {
                        // STEP 3: tap_card - NOW ask for the NFC card
                        // Show the amount so the customer can see it
                        KioskAmountDisplay(
                            amountInput = uiState.amountInput,
                            label = "Monto a Pagar"
                        )

                        // NFC Pulsing Wave Visualizer
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = PosSlate900),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                NfcWaveAnimation(isCardDetected = false)

                                Text(
                                    text = "ACERQUE LA TARJETA NFC",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = PosPrimaryLight,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                Text(
                                    text = "Coloque la tarjeta del cliente en el reverso del celular.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosSlate300,
                                    textAlign = TextAlign.Center
                                )

                                // SIMULATION BUTTON - ONLY ON DEMO NODE (/demo)
                                // Un solo boton: usa el card_uid del pre-auth
                                if (uiState.isDemoNode) {
                                    val simCardUid = uiState.classicPreAuth?.cardUid ?: ""
                                    val simCardType = uiState.classicPreAuth?.cardType ?: "uid_only"
                                    val isSimDesfire = (simCardType == "desfire")
                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            viewModel.onCardTapped(simCardUid, isDesfire = isSimDesfire)
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(48.dp)
                                            .testTag("sim_card_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                    ) {
                                        Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Simular Tarjeta (${simCardType})",
                                            color = PosNavyDark,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        // CLASSIC WRITING STATE: mostrar progreso de escritura
                        if (uiState.isClassicFlow && uiState.isWritingCard) {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    CircularProgressIndicator(
                                        color = PosGoldLight,
                                        modifier = Modifier.size(48.dp)
                                    )
                                    Text(
                                        text = uiState.writeProgress.ifBlank { "Procesando..." },
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosGoldLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "NO RETIRE LA TARJETA",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        // Back button to return to amount input
                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.resetNfcPaymentState()
                                nfcStep = "amount_input"
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("nfc_back_to_amount_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Cambiar Monto")
                        }
                    }
                }
            } else if (uiState.isMultisigActive && isCardDetected) {
                // --- MULTI-SIG: CARD DETECTED -> ENTER PIN FOR NEXT SIGNER ---
                // Solo para multi-sig: el PIN del firmante se pide despues de tap
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(20.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(PosGold)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Group, contentDescription = null, tint = PosGoldLight)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = "Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "UID: ${uiState.detectedCardUid}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosGoldLight
                                    )
                                }
                            }

                            TextButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.resetNfcPaymentState()
                                }
                            ) {
                                Text("Cancelar", color = PosSlate300)
                            }
                        }

                        // PIN Input Pad para el firmante
                        PinInputPad(
                            pin = uiState.customerPin,
                            onPinChange = { viewModel.setCustomerPin(it) },
                            title = "PIN del Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}"
                        )

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.submitMultisigSigner(
                                    cardUid = uiState.detectedCardUid ?: "",
                                    pin = uiState.customerPin,
                                    docType = uiState.selectedDocType,
                                    docNum = uiState.idDocNumber
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(58.dp)
                                .testTag("process_nfc_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosGold),
                            enabled = !uiState.isLoading && uiState.customerPin.length == 4
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(color = PosNavyDark, modifier = Modifier.size(24.dp))
                            } else {
                                Icon(Icons.Default.VpnKey, contentDescription = null, tint = PosNavyDark)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = if (uiState.multisigCollectedSigs + 1 < uiState.multisigRequiredSigs) {
                                        "Validar Firma ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}"
                                    } else {
                                        "Validar Firma Final y Aprobar Pago"
                                    },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = PosNavyDark,
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
