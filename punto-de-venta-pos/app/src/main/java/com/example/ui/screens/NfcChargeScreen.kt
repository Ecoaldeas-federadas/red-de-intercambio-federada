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

    // NFC flow steps: amount_input → confirm → credentials → tap_card
    // Unified flow: doc + PIN are entered BEFORE tapping the card
    var nfcStep by remember { mutableStateOf("amount_input") }

    // Reset step when entering screen or after payment completes
    LaunchedEffect(isPaymentApproved) {
        if (isPaymentApproved) {
            nfcStep = "amount_input"
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
            } else if (!isCardDetected && uiState.classicStep != "tap_card") {
                // --- NFC FLOW: 4 steps (unified) ---
                // Step 1: amount_input → Step 2: confirm → Step 3: credentials → Step 4: tap_card
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
                                nfcStep = "confirm"
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

                    "confirm" -> {
                        // STEP 2: Confirm amount before asking for card
                        KioskAmountDisplay(
                            amountInput = uiState.amountInput,
                            label = "Confirme el Monto"
                        )

                        Text(
                            text = "¿Es correcto este monto?",
                            style = MaterialTheme.typography.bodyLarge,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
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
                                    .testTag("nfc_cancel_confirm_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Cancelar", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    nfcStep = "credentials"
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_proceed_tap_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                            ) {
                                Text("Confirmar", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }

                    "credentials" -> {
                        // STEP 2.5: Enter document + PIN BEFORE tapping card
                        // This is the unified flow: doc + PIN first for ALL card types
                        KioskAmountDisplay(
                            amountInput = uiState.amountInput,
                            label = "Monto a Pagar"
                        )

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = PosSlate900),
                            shape = RoundedCornerShape(20.dp),
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(PosPrimaryLight)
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    text = "Verificación de Identidad",
                                    style = MaterialTheme.typography.titleMedium,
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

                                // PIN Input Pad
                                PinInputPad(
                                    pin = uiState.customerPin,
                                    onPinChange = { viewModel.setCustomerPin(it) },
                                    title = "PIN del Cliente"
                                )
                            }
                        }

                        // Botones: Cancelar y Procesar
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
                                Text("Cancelar", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitClassicPayment()
                                },
                                enabled = uiState.idDocNumber.isNotBlank() && uiState.customerPin.length >= 4,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(56.dp)
                                    .testTag("nfc_process_unified_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                            ) {
                                Text("Procesar", fontWeight = FontWeight.Bold, fontSize = 16.sp)
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

                                // SIMULATION BUTTONS - ONLY ON DEMO NODE (/demo)
                                if (uiState.isDemoNode) {
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            OutlinedButton(
                                                onClick = {
                                                    FeedbackHelper.playButtonClick(context)
                                                    viewModel.onCardTapped("AABBCCDDEEFF", isDesfire = true)
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .testTag("sim_desfire_card_btn"),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
                                            ) {
                                                Text("1 Firma DESFire", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }

                                            OutlinedButton(
                                                onClick = {
                                                    FeedbackHelper.playButtonClick(context)
                                                    viewModel.onCardTapped("112233445566", isDesfire = false)
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .testTag("sim_uid_card_btn"),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
                                            ) {
                                                Text("1 Firma UID Clásica", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            OutlinedButton(
                                                onClick = {
                                                    FeedbackHelper.playButtonClick(context)
                                                    viewModel.onCardTapped("CARD-MULTISIG-2F-FIRM1", isDesfire = true)
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .testTag("sim_multisig_2f_btn"),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGold)
                                            ) {
                                                Icon(Icons.Default.Group, contentDescription = null, modifier = Modifier.size(14.dp), tint = PosGold)
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Multifirma (2 Firmas)", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }

                                            OutlinedButton(
                                                onClick = {
                                                    FeedbackHelper.playButtonClick(context)
                                                    viewModel.onCardTapped("CARD-MULTISIG-3F-FIRM1", isDesfire = true)
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .testTag("sim_multisig_3f_btn"),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGold)
                                            ) {
                                                Icon(Icons.Default.Group, contentDescription = null, modifier = Modifier.size(14.dp), tint = PosGold)
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Multifirma (3 Firmas)", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Back button to return to amount input
                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
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
            } else {
                // --- STEP 2: CARD DETECTED -> ENTER PIN & ID DOC (IF REQUIRED) ---
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(20.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(if (uiState.isMultisigActive) PosGold else PosPrimaryLight)
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
                                Icon(
                                    imageVector = if (uiState.isMultisigActive) Icons.Default.Group else Icons.Default.CreditCard,
                                    contentDescription = null,
                                    tint = if (uiState.isMultisigActive) PosGoldLight else PosPrimaryLight
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = if (uiState.isMultisigActive) {
                                            "Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}"
                                        } else if (uiState.classicStep == "tap_card") {
                                            "Esperando tarjeta del cliente"
                                        } else {
                                            "Tarjeta: ${uiState.detectedCardUid}"
                                        },
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (uiState.isMultisigActive) {
                                            "UID: ${uiState.detectedCardUid}"
                                        } else if (uiState.detectedCardType == "desfire") {
                                            "DESFire EV3 (Segura Criptográfica)"
                                        } else {
                                            "UID Estándar"
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (uiState.isMultisigActive) PosGoldLight else if (uiState.detectedCardType == "desfire") PosSuccessGreenLight else PosWarningAmberLight
                                    )
                                }
                            }

                            TextButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    if (uiState.isMultisigActive) {
                                        viewModel.resetNfcPaymentState()
                                    } else if (uiState.isClassicFlow) {
                                        viewModel.cancelClassicPayment("Operación cancelada")
                                    } else {
                                        viewModel.navigateTo(PosScreen.NfcCharge)
                                    }
                                }
                            ) {
                                Text("Cancelar", color = PosSlate300)
                            }
                        }

                        // ===== TAP CARD STATE (Classic y UID/DESFire unificado) =====
                        if ((uiState.isClassicFlow || uiState.isWaitingCardVerify) && uiState.classicStep == "tap_card") {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosGold),
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
                                    Icon(
                                        imageVector = Icons.Default.Nfc,
                                        contentDescription = null,
                                        tint = PosNavyDark,
                                        modifier = Modifier.size(48.dp)
                                    )
                                    Text(
                                        text = "ACERQUE SU TARJETA",
                                        style = MaterialTheme.typography.headlineSmall,
                                        color = PosNavyDark,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (uiState.isClassicFlow) {
                                            "No retire la tarjeta hasta que termine"
                                        } else {
                                            "Tarjeta del cliente para verificar identidad"
                                        },
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = PosNavyDark
                                    )
                                    Text(
                                        text = "Tiempo restante: ${uiState.classicRemainingSeconds}s",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosNavyDark
                                    )
                                }
                            }
                        }

                        // SIMULATION BUTTONS FOR DEMO NODE - TAP CARD STATE
                        if (uiState.isDemoNode && (uiState.isClassicFlow || uiState.isWaitingCardVerify) && uiState.classicStep == "tap_card") {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "Simulación Demo",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = PosGoldLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (uiState.isClassicFlow) {
                                        Button(
                                            onClick = {
                                                FeedbackHelper.playButtonClick(context)
                                                val preAuth = uiState.classicPreAuth
                                                if (preAuth != null && preAuth.cardUid != null) {
                                                    // Simular escritura exitosa de sectores
                                                    viewModel.simulateClassicTapDemo()
                                                }
                                            },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .testTag("sim_classic_tap_btn"),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                        ) {
                                            Icon(Icons.Default.Nfc, contentDescription = null, modifier = Modifier.size(18.dp), tint = PosNavyDark)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Simular Tap Classic", color = PosNavyDark, fontWeight = FontWeight.Bold)
                                        }
                                    } else if (uiState.isWaitingCardVerify) {
                                        Button(
                                            onClick = {
                                                FeedbackHelper.playButtonClick(context)
                                                val expectedUid = uiState.expectedCardUid ?: ""
                                                val isDesfire = uiState.preAuthCardType == "desfire"
                                                viewModel.onCardTappedForVerification(expectedUid, isDesfire)
                                            },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .testTag("sim_verify_tap_btn"),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                                        ) {
                                            Icon(Icons.Default.Nfc, contentDescription = null, modifier = Modifier.size(18.dp), tint = PosWhite)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Simular Tap ${uiState.preAuthCardType ?: "UID"}", color = PosWhite, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

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

                        // ID DOCUMENT VERIFICATION (SECTION 12)
                        // Para tarjetas Classic con certificados dinamicos, el documento
                        // es SIEMPRE obligatorio (no configurable).
                        // Para uid_only legacy, depende de la configuracion del nodo.
                        // Solo mostrar si NO estamos esperando tap (el doc + PIN ya se pidio antes)
                        if (uiState.classicStep != "tap_card") {
                        val showDocSection = uiState.requireIdVerification || uiState.isClassicFlow
                        if (showDocSection) {
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
                                        text = if (uiState.isClassicFlow) {
                                            "Verificación de Identidad (OBLIGATORIO — Tarjeta Classic)"
                                        } else {
                                            "Verificación de Identidad Requerida (Tarjeta UID)"
                                        },
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
                        }

                        // PIN Input Pad
                        PinInputPad(
                            pin = uiState.customerPin,
                            onPinChange = { viewModel.setCustomerPin(it) },
                            title = if (uiState.isMultisigActive) {
                                "PIN del Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}"
                            } else {
                                "PIN del Cliente"
                            }
                        )

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                if (uiState.isMultisigActive) {
                                    viewModel.submitMultisigSigner(
                                        cardUid = uiState.detectedCardUid ?: "",
                                        pin = uiState.customerPin,
                                        docType = if (uiState.requireIdVerification) uiState.selectedDocType else null,
                                        docNum = if (uiState.requireIdVerification) uiState.idDocNumber else null
                                    )
                                } else if (uiState.isClassicFlow) {
                                    viewModel.submitClassicPayment()
                                } else {
                                    viewModel.submitNfcPayment()
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(58.dp)
                                .testTag("process_nfc_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (uiState.isMultisigActive) PosGold else PosPrimaryBlue
                            ),
                            enabled = !uiState.isLoading && uiState.customerPin.length == 4 &&
                                (!showDocSection || uiState.idDocNumber.isNotBlank())
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                            } else {
                                Icon(
                                    imageVector = if (uiState.isMultisigActive) Icons.Default.VpnKey else Icons.Default.Lock,
                                    contentDescription = null,
                                    tint = if (uiState.isMultisigActive) PosNavyDark else PosWhite
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = if (uiState.isMultisigActive) {
                                        if (uiState.multisigCollectedSigs + 1 < uiState.multisigRequiredSigs) {
                                            "Validar Firma ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}"
                                        } else {
                                            "Validar Firma Final y Aprobar Pago"
                                        }
                                    } else if (uiState.isClassicFlow) {
                                        "Autenticar y Preparar Pago"
                                    } else {
                                        "Procesar Cobro Cifrado"
                                    },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (uiState.isMultisigActive) PosNavyDark else PosWhite,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        } // fin if (classicStep != "tap_card")
                    }
                }
            }
        }
    }
}
