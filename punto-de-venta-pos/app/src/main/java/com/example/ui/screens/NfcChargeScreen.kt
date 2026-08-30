package com.example.ui.screens

import androidx.activity.compose.BackHandler
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
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel
import com.example.ui.viewmodel.PosUiState
import com.example.data.api.DEFAULT_DOCUMENT_TYPES
import com.example.data.api.DocumentTypeItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NfcChargeScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val isPaymentApproved = (uiState.nfcPaymentResult?.status == "approved" || uiState.classicStep == "done")

    // Multi-signer sub-step for multisig: 1 (Doc) -> 2 (PIN) -> 3 (Card)
    var multisigSignerStep by remember { mutableIntStateOf(1) }

    // Tipos de documento dinamicos desde el servidor (userLookupResult)
    // Si el servidor envia document_types, usar esos; sino, usar DEFAULT_DOCUMENT_TYPES
    val availableDocTypes = uiState.userLookupResult?.documentTypes?.let { types ->
        types.map { code ->
            DEFAULT_DOCUMENT_TYPES.find { it.code == code } ?: DocumentTypeItem(code, code)
        }
    } ?: DEFAULT_DOCUMENT_TYPES

    LaunchedEffect(uiState.multisigCollectedSigs) {
        if (uiState.isMultisigActive) {
            multisigSignerStep = 1
        }
    }

    // Intercept physical and gesture back button for strict step-by-step retreat
    BackHandler {
        if (uiState.isMultisigActive) {
            if (multisigSignerStep > 1) {
                multisigSignerStep -= 1
            } else {
                viewModel.goBackNfcStep()
            }
        } else {
            viewModel.goBackNfcStep()
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
                            if (uiState.isMultisigActive && multisigSignerStep > 1) {
                                multisigSignerStep -= 1
                            } else {
                                viewModel.goBackNfcStep()
                            }
                        },
                        modifier = Modifier.testTag("nfc_back_btn")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver al paso anterior",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
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
                            text = "Para poder leer las tarjetas de los clientes, active la función NFC en los ajustes de Android.",
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

            // SERVER / ERROR BANNER
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
                                text = "Aviso de Transacción",
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

            // LIVE MULTISIG COUNTDOWN HEADER
            if (uiState.isMultisigActive) {
                MultisigCountdownHeader(
                    remainingSeconds = uiState.multisigRemainingSeconds,
                    requiredSignatures = uiState.multisigRequiredSigs,
                    collectedSignatures = uiState.multisigCollectedSigs
                )
            }

            if (isPaymentApproved) {
                // =========================================================================
                // SUCCESS RECEIPT SCREEN
                // =========================================================================
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
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
                            Text("Documento Identificado:", color = PosSlate300)
                            Text("${uiState.selectedDocType.uppercase()} ${uiState.idDocNumber}", color = PosSlate100, fontWeight = FontWeight.Bold)
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
            } else if (uiState.isMultisigActive) {
                // =========================================================================
                // MULTI-SIG RECURSIVE FLOW (Doc -> PIN -> Tap Card for next signer)
                // =========================================================================
                val nextSignerIndex = uiState.multisigCollectedSigs + 1

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosGold.copy(alpha = 0.5f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
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
                                text = "Firmante $nextSignerIndex de ${uiState.multisigRequiredSigs}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosSlate200,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Stepper indicator
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            listOf("1. Documento", "2. Clave Secreta", "3. Escanear Tarjeta").forEachIndexed { idx, sName ->
                                val active = (idx + 1) == multisigSignerStep
                                Surface(
                                    color = if (active) PosGold else PosSlate800,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = sName,
                                        color = if (active) PosNavyDark else PosSlate400,
                                        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }

                        when (multisigSignerStep) {
                            1 -> {
                                Text(
                                    text = "Documento del Firmante $nextSignerIndex (Vendedor)",
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )

                                KioskDocumentDisplay(
                                    docType = uiState.selectedDocType,
                                    documentNumber = uiState.idDocNumber,
                                    onDocTypeChange = { viewModel.setIdDocInfo(it, uiState.idDocNumber) },
                                    onClear = { viewModel.setIdDocInfo(uiState.selectedDocType, "") },
                                    accentColor = PosGoldLight,
                                    testTag = "multisig_signer_doc_input",
                                    availableDocTypes = availableDocTypes
                                )

                                KioskDocumentKeypad(
                                    documentNumber = uiState.idDocNumber,
                                    onDocumentChange = { viewModel.setIdDocInfo(uiState.selectedDocType, it) }
                                )

                                Button(
                                    onClick = {
                                        FeedbackHelper.playButtonClick(context)
                                        multisigSignerStep = 2
                                    },
                                    enabled = uiState.idDocNumber.isNotBlank(),
                                    modifier = Modifier.fillMaxWidth().height(54.dp).testTag("multisig_next_to_pin_btn"),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                ) {
                                    Text("Continuar a Clave Secreta", color = PosNavyDark, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(Icons.Default.ArrowForward, contentDescription = null, tint = PosNavyDark)
                                }
                            }

                            2 -> {
                                Text(
                                    text = "Clave Secreta del Firmante $nextSignerIndex (Comprador)",
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )

                                PinInputPad(
                                    pin = uiState.customerPin,
                                    onPinChange = { viewModel.setCustomerPin(it) },
                                    title = "PIN del Firmante $nextSignerIndex (4 dígitos)"
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            multisigSignerStep = 1
                                        },
                                        modifier = Modifier.weight(1f).height(52.dp),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                                    ) {
                                        Text("Volver a Doc.", fontSize = 13.sp)
                                    }

                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            multisigSignerStep = 3
                                        },
                                        enabled = uiState.customerPin.length == 4,
                                        modifier = Modifier.weight(1.2f).height(52.dp).testTag("multisig_next_to_tap_btn"),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                    ) {
                                        Text("Continuar a Tarjeta", color = PosNavyDark, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                }
                            }

                            3 -> {
                                Text(
                                    text = "Acerque la Tarjeta del Firmante $nextSignerIndex de ${uiState.multisigRequiredSigs}",
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center
                                )

                                NfcWaveAnimation(isCardDetected = false)

                                Text(
                                    text = "Coloque la tarjeta en el reverso del dispositivo para registrar la firma.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosSlate300,
                                    textAlign = TextAlign.Center
                                )

                                if (uiState.isDemoNode) {
                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            val simUid = if (uiState.multisigRequiredSigs == 3) {
                                                "CARD-MULTISIG-3F-FIRM$nextSignerIndex"
                                            } else {
                                                "CARD-MULTISIG-2F-FIRM$nextSignerIndex"
                                            }
                                            viewModel.submitMultisigSigner(
                                                cardUid = simUid,
                                                pin = uiState.customerPin,
                                                docType = uiState.selectedDocType,
                                                docNum = uiState.idDocNumber
                                            )
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(50.dp)
                                            .testTag("sim_next_signer_btn"),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosGold),
                                        enabled = !uiState.isLoading
                                    ) {
                                        if (uiState.isLoading) {
                                            CircularProgressIndicator(color = PosNavyDark, modifier = Modifier.size(24.dp))
                                        } else {
                                            Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "Simular Tarjeta Firmante $nextSignerIndex",
                                                color = PosNavyDark,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            multisigSignerStep = 2
                                        },
                                        modifier = Modifier.weight(1f).height(48.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                                    ) {
                                        Text("Cambiar Clave")
                                    }
                                }
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
            } else {
                // =========================================================================
                // STRICT 4-STEP PROGRESSIVE NFC CHARGE FLOW
                // Step 1: Monto (Vendedor)
                // Step 2: Documento de Identidad (Vendedor con teclado en pantalla)
                // Step 3: Clave Secreta (Comprador con teclado numérico PIN)
                // Step 4: Escanear Tarjeta NFC (SOLO DESPUÉS DE VALIDAR CLAVE Y PRE-AUTH)
                // =========================================================================
                val centavos = uiState.amountInput.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
                val hasAmount = centavos > 0

                // Progress Step Chips Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Step labels depend on whether document is required (Classic)
                    val stepLabels = if (uiState.requiresDocument) {
                        listOf("1. Monto", "2. Usuario", "3. Doc", "4. Clave", "5. Tarjeta")
                    } else {
                        listOf("1. Monto", "2. Usuario", "3. Clave", "4. Tarjeta")
                    }
                    stepLabels.forEachIndexed { index, name ->
                        val stepNumber = index + 1
                        val isCurrent = (stepNumber == uiState.nfcStep)
                        val isCompleted = (stepNumber < uiState.nfcStep)

                        Surface(
                            color = when {
                                isCurrent -> PosPrimaryLight
                                isCompleted -> PosSuccessGreen.copy(alpha = 0.25f)
                                else -> PosSlate800
                            },
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = name,
                                color = when {
                                    isCurrent -> PosNavyDark
                                    isCompleted -> PosSuccessGreenLight
                                    else -> PosSlate400
                                },
                                fontWeight = if (isCurrent || isCompleted) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                when (uiState.nfcStep) {
                    1 -> {
                        // -------------------------------------------------------------
                        // PASO 1: MONTO A COBRAR
                        // -------------------------------------------------------------
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
                                viewModel.setNfcStep(2)
                            },
                            enabled = hasAmount,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .testTag("nfc_confirm_amount_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Text("Continuar a Usuario", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(Icons.Default.ArrowForward, contentDescription = null)
                        }
                    }

                    2 -> {
                        // -------------------------------------------------------------
                        // PASO 2: USERNAME DEL CLIENTE (VENDEDOR)
                        // -------------------------------------------------------------
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Paso 2 • Usuario del Cliente (Vendedor)",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = CurrencyHelper.formatCentavos(CurrencyHelper.parseInputToCentavos(uiState.amountInput)),
                                style = MaterialTheme.typography.labelMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Black
                            )
                        }

                        // Username input display
                        Surface(
                            color = PosSlate800,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Nombre de usuario del cliente",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = PosSlate400
                                )
                                Text(
                                    text = uiState.customerUsername.ifBlank { "—" },
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = PosWhite,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 24.sp
                                )
                            }
                        }

                        // Alphanumeric keypad for username
                        KioskDocumentKeypad(
                            documentNumber = uiState.customerUsername,
                            onDocumentChange = { viewModel.setCustomerUsername(it) }
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setNfcStep(1)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                                    .testTag("nfc_back_to_amount_step_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Volver a Monto", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitUserLookup()
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(54.dp)
                                    .testTag("nfc_lookup_user_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                                enabled = uiState.customerUsername.isNotBlank() && !uiState.isLoading
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(22.dp))
                                } else {
                                    Text("Buscar Usuario", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }

                    3 -> {
                        // -------------------------------------------------------------
                        // PASO 3: DOCUMENTO DE IDENTIDAD (VENDEDOR) — solo si requiresDocument=true
                        // O PASO 3: CLAVE SECRETA (COMPRADOR) — si requiresDocument=false
                        // -------------------------------------------------------------
                        if (uiState.requiresDocument) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Paso 3 • Documento del Cliente (Vendedor)",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Usuario: ${uiState.customerUsername}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Black
                            )
                        }

                        // Compact single-line document display bar (56dp)
                        KioskDocumentDisplay(
                            docType = uiState.selectedDocType,
                            documentNumber = uiState.idDocNumber,
                            onDocTypeChange = { viewModel.setIdDocInfo(it, uiState.idDocNumber) },
                            onClear = { viewModel.setIdDocInfo(uiState.selectedDocType, "") },
                            accentColor = PosPrimaryLight,
                            testTag = "id_doc_number_input",
                            availableDocTypes = availableDocTypes
                        )

                        // Internal on-screen numeric/alphanumeric keypad
                        KioskDocumentKeypad(
                            documentNumber = uiState.idDocNumber,
                            onDocumentChange = { viewModel.setIdDocInfo(uiState.selectedDocType, it) }
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setNfcStep(2)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                                    .testTag("nfc_back_to_username_step_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Volver a Usuario", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setNfcStep(4)
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(54.dp)
                                    .testTag("nfc_go_to_pin_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                                enabled = uiState.idDocNumber.isNotBlank()
                            ) {
                                Text("Continuar a Clave", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                            }
                        }
                    } else {
                        // requiresDocument=false: este paso 3 es PIN (UID/DESFire)
                        // Mostrar el bloque de PIN aquí
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Paso 3 • Clave Secreta (Comprador)",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Usuario: ${uiState.customerUsername}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosSlate200,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        PinInputPad(
                            pin = uiState.customerPin,
                            onPinChange = { viewModel.setCustomerPin(it) },
                            title = "Clave Secreta del Comprador (4 dígitos)"
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setNfcStep(2)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                                    .testTag("nfc_back_to_username_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Volver a Usuario", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitUnifiedPreAuth()
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(54.dp)
                                    .testTag("nfc_auth_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                                enabled = !uiState.isLoading &&
                                        uiState.customerPin.length == 4 &&
                                        uiState.customerUsername.isNotBlank()
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(22.dp))
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.LockOpen,
                                        contentDescription = null,
                                        tint = PosWhite,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Validar y Continuar", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                        }
                    }
                    }

                    4 -> {
                        // -------------------------------------------------------------
                        // PASO 4: CLAVE SECRETA (COMPRADOR) — solo si requiresDocument=true
                        // O PASO 4: ESCANEAR TARJETA NFC — si requiresDocument=false
                        // -------------------------------------------------------------
                        if (uiState.requiresDocument) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Paso 4 • Clave Secreta (Comprador)",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${uiState.selectedDocType.uppercase()}: ${uiState.idDocNumber}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosSlate200,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // PIN Input Pad
                        PinInputPad(
                            pin = uiState.customerPin,
                            onPinChange = { viewModel.setCustomerPin(it) },
                            title = "Clave Secreta del Comprador (4 dígitos)"
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setNfcStep(3)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                                    .testTag("nfc_back_to_doc_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Volver a Doc.", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitUnifiedPreAuth()
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(54.dp)
                                    .testTag("nfc_auth_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                                enabled = !uiState.isLoading &&
                                        uiState.customerPin.length == 4 &&
                                        uiState.idDocNumber.isNotBlank()
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(22.dp))
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.LockOpen,
                                        contentDescription = null,
                                        tint = PosWhite,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Validar y Continuar", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                        }
                    } else {
                        // requiresDocument=false: este paso 4 es Tap Card (UID/DESFire)
                        // Mostrar el bloque de tap card aquí
                        // (duplicado del step 5 para Classic)
                        NfcTapCardContent(uiState, viewModel, context)
                    }
                    }

                    5 -> {
                        // -------------------------------------------------------------
                        // PASO 5: ESCANEAR TARJETA NFC (SOLO PARA CLASSIC)
                        // -------------------------------------------------------------
                        NfcTapCardContent(uiState, viewModel, context)
                    }

                    else -> {
                        viewModel.setNfcStep(1)
                    }
                }
            }
        }
    }
}

@Composable
fun NfcTapCardContent(
    uiState: PosUiState,
    viewModel: PosViewModel,
    context: android.content.Context
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = PosSlate900),
        shape = RoundedCornerShape(20.dp),
        border = androidx.compose.foundation.BorderStroke(2.dp, PosPrimaryLight.copy(alpha = 0.6f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Surface(
                color = PosSuccessGreen.copy(alpha = 0.15f),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, PosSuccessGreen.copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PosSuccessGreenLight, modifier = Modifier.size(16.dp))
                    Text("ACERQUE LA TARJETA NFC", color = PosSuccessGreenLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }

            // Transaction summary card
            Card(
                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Usuario:", color = PosSlate400, fontSize = 12.sp)
                        Text(uiState.customerUsername, color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    if (uiState.requiresDocument) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Documento Validado:", color = PosSlate400, fontSize = 12.sp)
                            Text("${uiState.selectedDocType.uppercase()}: ${uiState.idDocNumber}", color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Clave Secreta:", color = PosSlate400, fontSize = 12.sp)
                        Text("•••• (Correcta)", color = PosSuccessGreenLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    HorizontalDivider(color = PosSlate700, modifier = Modifier.padding(vertical = 2.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total a Cobrar:", color = PosSlate300, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text(
                            CurrencyHelper.formatCentavos(CurrencyHelper.parseInputToCentavos(uiState.amountInput)),
                            color = PosGoldLight,
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp
                        )
                    }
                }
            }

            NfcWaveAnimation(isCardDetected = false)

            Text(
                text = "ACERQUE LA TARJETA DEL CLIENTE",
                style = MaterialTheme.typography.titleLarge,
                color = PosPrimaryLight,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            Text(
                text = "Coloque la tarjeta del comprador en el reverso del dispositivo para procesar el débito.",
                style = MaterialTheme.typography.bodyMedium,
                color = PosSlate300,
                textAlign = TextAlign.Center
            )

            if (uiState.isLoading) {
                CircularProgressIndicator(color = PosPrimaryLight, modifier = Modifier.size(32.dp))
            }

            // DEMO MODE SIMULATION BUTTON
            if (uiState.isDemoNode) {
                val simCardUid = uiState.classicPreAuth?.cardUid ?: "DEMO-NFC-CARD"
                val simCardType = uiState.classicPreAuth?.cardType ?: "uid_only"
                val isSimDesfire = (simCardType == "desfire")

                Button(
                    onClick = {
                        FeedbackHelper.playButtonClick(context)
                        viewModel.onCardTapped(simCardUid, isDesfire = isSimDesfire)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("sim_card_btn"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosGold),
                    enabled = !uiState.isLoading
                ) {
                    Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Simular Tarjeta ($simCardType)",
                        color = PosNavyDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }

            // Mifare Classic dynamic certificates write progress
            if (uiState.isClassicFlow && uiState.isWritingCard) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(color = PosGoldLight, modifier = Modifier.size(36.dp))
                        Text(
                            text = uiState.writeProgress.ifBlank { "Escribiendo certificados..." },
                            style = MaterialTheme.typography.titleMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "NO RETIRE LA TARJETA",
                            style = MaterialTheme.typography.labelSmall,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            OutlinedButton(
                onClick = {
                    FeedbackHelper.playButtonClick(context)
                    viewModel.goBackNfcStep()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag("nfc_back_to_pin_btn"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Volver a Clave Secreta", fontSize = 13.sp)
            }
        }
    }
}
