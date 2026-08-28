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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.api.DEFAULT_DOCUMENT_TYPES
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NfcChargeScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val isCardDetected = !uiState.detectedCardUid.isNullOrBlank()
    val isPaymentApproved = (uiState.nfcPaymentResult?.status == "approved")

    var docTypeExpanded by remember { mutableStateOf(false) }

    // NFC flow steps: amount_input → confirm → tap_card
    // Only show "tap card" AFTER the operator confirms the amount
    var nfcStep by remember { mutableStateOf("amount_input") }

    // Reset step when entering screen or after payment completes
    LaunchedEffect(isPaymentApproved, isCardDetected) {
        if (isPaymentApproved) {
            nfcStep = "amount_input"
        }
        // If card is detected, we must be in tap_card step
        if (isCardDetected && nfcStep != "tap_card") {
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
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
                            text = CurrencyHelper.formatMicroUnits(
                                CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)
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

                        Button(
                            onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .testTag("nfc_done_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosSuccessGreen)
                        ) {
                            Text("Finalizar y Volver", color = PosNavyDark, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else if (!isCardDetected) {
                // --- NFC FLOW: 3 steps ---
                // Step 1: amount_input → Step 2: confirm → Step 3: tap_card
                val centimos = uiState.amountInput.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
                val hasAmount = centimos > 0

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
                            onClick = { nfcStep = "confirm" },
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
                                onClick = { nfcStep = "amount_input" },
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
                                onClick = { nfcStep = "tap_card" },
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
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { viewModel.onCardTapped("AABBCCDDEEFF", isDesfire = true) },
                                            modifier = Modifier
                                                .weight(1f)
                                                .testTag("sim_desfire_card_btn"),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
                                        ) {
                                            Text("Simular DESFire", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }

                                        OutlinedButton(
                                            onClick = { viewModel.onCardTapped("112233445566", isDesfire = false) },
                                            modifier = Modifier
                                                .weight(1f)
                                                .testTag("sim_uid_card_btn"),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
                                        ) {
                                            Text("Simular UID Clásica", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

                        // Back button to return to amount input
                        OutlinedButton(
                            onClick = { nfcStep = "amount_input" },
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
                        brush = androidx.compose.ui.graphics.SolidColor(PosPrimaryLight)
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
                                Icon(imageVector = Icons.Default.CreditCard, contentDescription = null, tint = PosPrimaryLight)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = "Tarjeta: ${uiState.detectedCardUid}",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (uiState.detectedCardType == "desfire") "DESFire EV3 (Segura Criptográfica)" else "UID Estándar",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (uiState.detectedCardType == "desfire") PosSuccessGreenLight else PosWarningAmberLight
                                    )
                                }
                            }

                            TextButton(
                                onClick = { viewModel.navigateTo(PosScreen.NfcCharge) }
                            ) {
                                Text("Cambiar", color = PosSlate300)
                            }
                        }

                        // ID DOCUMENT VERIFICATION (SECTION 12)
                        if (uiState.requireIdVerification) {
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
                                        text = "Verificación de Identidad Requerida (Tarjeta UID)",
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
                            title = if (uiState.isMultisigActive) "PIN del Firmante Autorizado" else "PIN del Cliente"
                        )

                        Button(
                            onClick = {
                                if (uiState.isMultisigActive) {
                                    viewModel.submitMultisigSigner(
                                        cardUid = uiState.detectedCardUid ?: "",
                                        pin = uiState.customerPin,
                                        docType = if (uiState.requireIdVerification) uiState.selectedDocType else null,
                                        docNum = if (uiState.requireIdVerification) uiState.idDocNumber else null
                                    )
                                } else {
                                    viewModel.submitNfcPayment()
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(58.dp)
                                .testTag("process_nfc_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                            enabled = !uiState.isLoading && uiState.customerPin.length == 4
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                            } else {
                                Icon(imageVector = Icons.Default.Lock, contentDescription = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = if (uiState.isMultisigActive) "Registrar Firma" else "Procesar Cobro Cifrado",
                                    style = MaterialTheme.typography.titleMedium,
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
