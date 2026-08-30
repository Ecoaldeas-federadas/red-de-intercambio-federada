package com.example.ui.screens

import androidx.activity.compose.BackHandler
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
fun MultiVendorScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var buyerDocExpanded by remember { mutableStateOf(false) }
    var multisigDocExpanded by remember { mutableStateOf(false) }

    // Multi-signer step for multisig flow: doc_input → pin_input → tap_card
    var multisigSignerStep by remember { mutableStateOf("doc_input") }

    BackHandler {
        viewModel.goBackMultiVendorStep()
    }

    LaunchedEffect(uiState.multisigCollectedSigs) {
        if (uiState.isMultisigActive) {
            multisigSignerStep = "doc_input"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Modo Multi-Vendedor (Feria)",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.goBackMultiVendorStep()
                        },
                        modifier = Modifier.testTag("mv_back_btn")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver al paso anterior",
                            tint = PosSlate100
                        )
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.resetMultiVendorSale()
                            viewModel.navigateTo(PosScreen.Dashboard)
                        },
                        modifier = Modifier.testTag("exit_mv_btn")
                    ) {
                        Text("Salir del Modo", color = PosErrorRedLight, fontWeight = FontWeight.Bold)
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
            // ERROR MODAL FOR SAME CARD ERROR (Seller and Buyer same person/card)
            if (uiState.isSameCardError) {
                AlertDialog(
                    onDismissRequest = { viewModel.dismissSameCardError() },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = PosErrorRedLight,
                            modifier = Modifier.size(36.dp)
                        )
                    },
                    title = {
                        Text(
                            text = "¡Error: Tarjetas Duplicadas!",
                            fontWeight = FontWeight.Bold,
                            color = PosSlate100,
                            textAlign = TextAlign.Center
                        )
                    },
                    text = {
                        Text(
                            text = uiState.errorMessage
                                ?: "El vendedor y el comprador no pueden ser la misma persona ni la misma tarjeta. Por favor acerque una tarjeta diferente para el cliente.",
                            color = PosSlate300,
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.dismissSameCardError()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = PosErrorRed),
                            modifier = Modifier.testTag("dismiss_same_card_error_btn")
                        ) {
                            Text("Entendido", color = PosWhite, fontWeight = FontWeight.Bold)
                        }
                    },
                    containerColor = PosSlate900,
                    shape = RoundedCornerShape(20.dp)
                )
            }

            // Normal Error Messages
            if (!uiState.errorMessage.isNullOrBlank() && !uiState.isSameCardError) {
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

            // Success Messages
            if (!uiState.successMessage.isNullOrBlank() && uiState.mvStep != 6) {
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

            // NFC STATUS BANNER
            if (!uiState.hasNfcHardware) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosWarningAmber.copy(alpha = 0.15f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosWarningAmber)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = PosWarningAmberLight)
                        Text(
                            text = "Este dispositivo no cuenta con lector NFC integrado.",
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
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Nfc, contentDescription = null, tint = PosWarningAmberLight)
                            Text(
                                text = "NFC desactivado en el teléfono",
                                style = MaterialTheme.typography.titleSmall,
                                color = PosWarningAmberLight,
                                fontWeight = FontWeight.Bold
                            )
                        }
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
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Activar NFC en Ajustes", color = PosNavyDark, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // STEP PROGRESS INDICATOR (6 STEPS: Vendedor, Monto, Documento, Clave, Tarjeta, Fin)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val steps = listOf("Vendedor", "Monto", "Doc", "Clave", "Tarjeta", "Fin")
                steps.forEachIndexed { index, stepName ->
                    val stepNum = index + 1
                    val isDone = uiState.mvStep > stepNum
                    val isCurrent = uiState.mvStep == stepNum

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    when {
                                        isDone -> PosSuccessGreen
                                        isCurrent -> PosPrimaryLight
                                        else -> PosSlate800
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isDone) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = PosNavyDark,
                                    modifier = Modifier.size(16.dp)
                                )
                            } else {
                                Text(
                                    text = "$stepNum",
                                    color = if (isCurrent) PosNavyDark else PosSlate300,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = stepName,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isCurrent) PosPrimaryLight else PosSlate600,
                            fontSize = 10.sp
                        )
                    }
                }
            }

            HorizontalDivider(color = PosSlate800)

            // --- MULTI-SIG ACTIVE: Sequential Signer Flow (Doc -> Clave Secreta -> Escanear Tarjeta) ---
            if (uiState.isMultisigActive) {
                val nextSignerIdx = uiState.multisigCollectedSigs + 1

                MultisigCountdownHeader(
                    remainingSeconds = uiState.multisigRemainingSeconds,
                    requiredSignatures = uiState.multisigRequiredSigs,
                    collectedSignatures = uiState.multisigCollectedSigs,
                    modifier = Modifier.fillMaxWidth()
                )

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(2.dp, PosGold)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Groups, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(22.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "CUENTA MANCOMUNADA",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = "Firmante $nextSignerIdx de ${uiState.multisigRequiredSigs}",
                                style = MaterialTheme.typography.labelMedium,
                                color = PosSlate200,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Stepper indicator for signer cycle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val subSteps = listOf("1. Documento", "2. Clave Secreta", "3. Escanear Tarjeta")
                            subSteps.forEachIndexed { idx, sName ->
                                val active = when (idx) {
                                    0 -> multisigSignerStep == "doc_input"
                                    1 -> multisigSignerStep == "pin_input"
                                    else -> multisigSignerStep == "tap_card"
                                }
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
                            "doc_input" -> {
                                Surface(
                                    color = PosGold.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Badge, contentDescription = null, tint = PosGoldLight)
                                        Column {
                                            Text(
                                                text = "Paso 1 de 3 • Documento del Firmante $nextSignerIdx (Vendedor)",
                                                color = PosGoldLight,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                            Text(
                                                text = "El vendedor ingresa el documento del firmante con el teclado",
                                                color = PosSlate300,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }

                                KioskDocumentDisplay(
                                    docType = uiState.selectedDocType,
                                    documentNumber = uiState.idDocNumber,
                                    onDocTypeChange = { viewModel.setIdDocInfo(it, uiState.idDocNumber) },
                                    onClear = { viewModel.setIdDocInfo(uiState.selectedDocType, "") },
                                    label = "Documento del Firmante $nextSignerIdx",
                                    accentColor = PosGoldLight,
                                    testTag = "mv_multisig_signer_doc_input"
                                )

                                KioskDocumentKeypad(
                                    documentNumber = uiState.idDocNumber,
                                    onDocumentChange = { viewModel.setIdDocInfo(uiState.selectedDocType, it) }
                                )

                                Button(
                                    onClick = {
                                        FeedbackHelper.playButtonClick(context)
                                        multisigSignerStep = "pin_input"
                                    },
                                    enabled = uiState.idDocNumber.isNotBlank(),
                                    modifier = Modifier.fillMaxWidth().height(54.dp).testTag("mv_multisig_to_pin_btn"),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                ) {
                                    Text("Continuar a Clave Secreta", color = PosNavyDark, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(Icons.Default.ArrowForward, contentDescription = null, tint = PosNavyDark)
                                }
                            }

                            "pin_input" -> {
                                Surface(
                                    color = PosGold.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Lock, contentDescription = null, tint = PosGoldLight)
                                        Column {
                                            Text(
                                                text = "Paso 2 de 3 • Clave Secreta del Firmante $nextSignerIdx (Comprador)",
                                                color = PosGoldLight,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                            Text(
                                                text = "El firmante ingresa su clave secreta confidencialmente",
                                                color = PosSlate300,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }

                                PinInputPad(
                                    pin = uiState.customerPin,
                                    onPinChange = { viewModel.setCustomerPin(it) },
                                    title = "PIN del Firmante $nextSignerIdx de ${uiState.multisigRequiredSigs}"
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            multisigSignerStep = "doc_input"
                                        },
                                        modifier = Modifier.weight(1f).height(52.dp),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                                    ) {
                                        Text("Volver a Doc", fontSize = 13.sp)
                                    }

                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            multisigSignerStep = "tap_card"
                                        },
                                        enabled = uiState.customerPin.length == 4,
                                        modifier = Modifier.weight(1f).height(52.dp).testTag("mv_multisig_to_tap_btn"),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                    ) {
                                        Text("Continuar a Tarjeta", color = PosNavyDark, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                }
                            }

                            "tap_card" -> {
                                Surface(
                                    color = PosGold.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Contactless, contentDescription = null, tint = PosGoldLight)
                                        Column {
                                            Text(
                                                text = "Paso 3 de 3 • Escanear Tarjeta del Firmante $nextSignerIdx",
                                                color = PosGoldLight,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                            Text(
                                                text = "Acerque la tarjeta física al reverso del dispositivo",
                                                color = PosSlate300,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }

                                NfcWaveAnimation(isCardDetected = false)

                                Text(
                                    text = "ACERQUE LA TARJETA DEL FIRMANTE $nextSignerIdx de ${uiState.multisigRequiredSigs}",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )

                                Text(
                                    text = "Coloque la tarjeta del siguiente titular en el reverso del teléfono para registrar su firma.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosSlate300,
                                    textAlign = TextAlign.Center
                                )

                                if (uiState.isDemoNode) {
                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            val simUid = if (uiState.multisigRequiredSigs == 3) {
                                                "BUYER_MULTISIG_3F_FIRM$nextSignerIdx"
                                            } else {
                                                "BUYER_MULTISIG_2F_FIRM$nextSignerIdx"
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
                                            .height(52.dp)
                                            .testTag("sim_mv_next_signer_btn"),
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
                                                "Simular Tarjeta Firmante $nextSignerIdx de ${uiState.multisigRequiredSigs}",
                                                color = PosNavyDark,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }

                                OutlinedButton(
                                    onClick = {
                                        FeedbackHelper.playButtonClick(context)
                                        multisigSignerStep = "pin_input"
                                    },
                                    modifier = Modifier.fillMaxWidth().height(48.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                                ) {
                                    Text("Cambiar Clave Secreta")
                                }
                            }
                        }

                        TextButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.resetMultiVendorSale()
                            },
                            colors = ButtonDefaults.textButtonColors(contentColor = PosErrorRedLight)
                        ) {
                            Text("Cancelar Pago Multi-Firma")
                        }
                    }
                }
            } else when (uiState.mvStep) {
                1 -> {
                    // --- PASO 1: TAP VENDOR CARD ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, PosGold.copy(alpha = 0.6f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Surface(
                                color = PosGold.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, PosGold.copy(alpha = 0.4f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.Storefront, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(18.dp))
                                    Text("PASO 1 • IDENTIFICAR VENDEDOR", color = PosGoldLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(130.dp)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(
                                        androidx.compose.ui.graphics.Brush.linearGradient(
                                            listOf(androidx.compose.ui.graphics.Color(0xFFB45309), androidx.compose.ui.graphics.Color(0xFFF59E0B))
                                        )
                                    )
                                    .padding(16.dp)
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    verticalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(Icons.Default.Storefront, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(24.dp))
                                            Text("TARJETA VENDEDOR", color = PosNavyDark, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                        }
                                        Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(26.dp))
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Bottom
                                    ) {
                                        Column {
                                            Text("Puesto / Comercio", color = PosNavyDark.copy(alpha = 0.8f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Text("RECEPTOR DE FONDOS", color = PosNavyDark, fontSize = 14.sp, fontWeight = FontWeight.Black)
                                        }
                                        Icon(Icons.Default.AccountBalance, contentDescription = null, tint = PosNavyDark.copy(alpha = 0.5f), modifier = Modifier.size(32.dp))
                                    }
                                }
                            }

                            NfcWaveAnimation()

                            Text(
                                text = "Acerque la Tarjeta del VENDEDOR",
                                style = MaterialTheme.typography.titleLarge,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "La persona dueña del puesto o producto que recibirá el pago debe pasar primero su tarjeta.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300,
                                textAlign = TextAlign.Center
                            )

                            if (uiState.isDemoNode) {
                                OutlinedButton(
                                    onClick = {
                                        FeedbackHelper.playButtonClick(context)
                                        viewModel.onMultiVendorSellerTapped("SELLER_CARD_88")
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("sim_seller_tap_btn"),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
                                ) {
                                    Text("Simular Tarjeta Vendedor (SELLER_88)")
                                }
                            }
                        }
                    }
                }

                2 -> {
                    // --- PASO 2: VENDOR ENTERS AMOUNT ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate800),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(imageVector = Icons.Default.Storefront, contentDescription = null, tint = PosGoldLight)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text("Vendedor identificado:", style = MaterialTheme.typography.labelSmall, color = PosSlate300)
                                Text(uiState.sellerName ?: "Vendedor", style = MaterialTheme.typography.titleMedium, color = PosSlate100, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    KioskAmountDisplay(
                        amountInput = uiState.amountInput,
                        label = "Monto a cobrar al cliente"
                    )

                    KioskNumericKeypad(
                        currentInput = uiState.amountInput,
                        onInputChange = { viewModel.setAmountInput(it) }
                    )

                    Button(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.onMultiVendorAmountSet()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .testTag("mv_amount_confirm_btn"),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                        enabled = uiState.amountInput.isNotBlank() && uiState.amountInput != "0"
                    ) {
                        Text("Confirmar Monto y Continuar a Documento", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    }
                }

                3 -> {
                    // --- PASO 3: BUYER DOCUMENT ID (Vendedor escribe documento de identidad del comprador) ---
                    Surface(
                        color = PosPrimaryLight.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Badge, contentDescription = null, tint = PosPrimaryLight, modifier = Modifier.size(24.dp))
                            Column {
                                Text(
                                    text = "PASO 3 • DOCUMENTO DEL COMPRADOR (VENDEDOR)",
                                    color = PosPrimaryLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = "El vendedor ingresa el tipo y número de documento de identidad del cliente usando el teclado en pantalla.",
                                    color = PosSlate300,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    // Document Display (Non-editable container: no phone keyboard popup)
                    KioskDocumentDisplay(
                        docType = uiState.buyerDocType,
                        documentNumber = uiState.buyerDocNumber,
                        onDocTypeChange = { viewModel.setBuyerDocInfo(it, uiState.buyerDocNumber) },
                        onClear = { viewModel.setBuyerDocInfo(uiState.buyerDocType, "") },
                        label = "Documento del Cliente • Monto: ${CurrencyHelper.formatCentavos(CurrencyHelper.parseInputToCentavos(uiState.amountInput))}",
                        accentColor = PosPrimaryLight,
                        testTag = "buyer_doc_input"
                    )

                    // TECLADO EN PANTALLA (NUMERICO Y ALFANUMERICO)
                    KioskDocumentKeypad(
                        documentNumber = uiState.buyerDocNumber,
                        onDocumentChange = { viewModel.setBuyerDocInfo(uiState.buyerDocType, it) }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.setMvStep(2)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                        ) {
                            Text("Volver a Monto", fontSize = 14.sp)
                        }

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.onMultiVendorDocSet()
                            },
                            modifier = Modifier
                                .weight(1.3f)
                                .height(56.dp)
                                .testTag("mv_doc_next_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                            enabled = uiState.buyerDocNumber.isNotBlank()
                        ) {
                            Text("Continuar a Clave Secreta", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                4 -> {
                    // --- PASO 4: BUYER SECRET PIN (Comprador ingresa su clave secreta en privado) ---
                    Surface(
                        color = PosPrimaryLight.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = PosPrimaryLight, modifier = Modifier.size(24.dp))
                            Column {
                                Text(
                                    text = "PASO 4 • CLAVE SECRETA DEL COMPRADOR (CLIENTE)",
                                    color = PosPrimaryLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = "Por seguridad, el cliente debe ingresar su clave secreta (PIN de 4 dígitos) de manera privada.",
                                    color = PosSlate300,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    PinInputPad(
                        pin = uiState.buyerPin,
                        onPinChange = { pin ->
                            viewModel.setBuyerPin(pin)
                        },
                        title = "Clave Secreta del Comprador (4 dígitos)"
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.setMvStep(3)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                        ) {
                            Text("Volver a Documento", fontSize = 14.sp)
                        }

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.onMultiVendorPinSet()
                            },
                            modifier = Modifier
                                .weight(1.3f)
                                .height(56.dp)
                                .testTag("mv_pin_next_btn"),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                            enabled = uiState.buyerPin.length == 4
                        ) {
                            Text("Continuar a Escanear Tarjeta", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                5 -> {
                    // --- PASO 5: ESCANEAR TARJETA DEL CLIENTE (SOLO DESPUES DE DOCUMENTO Y PIN) ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, PosPrimaryLight.copy(alpha = 0.6f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Surface(
                                color = PosPrimaryLight.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, PosPrimaryLight.copy(alpha = 0.4f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.Contactless, contentDescription = null, tint = PosPrimaryLight, modifier = Modifier.size(18.dp))
                                    Text("PASO 5 • ESCANEAR TARJETA DEL CLIENTE", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }

                            // Summary card of transaction
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Cobro para Vendedor:", color = PosSlate400, fontSize = 12.sp)
                                        Text(uiState.sellerName ?: "Vendedor", color = PosGoldLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Documento Cliente:", color = PosSlate400, fontSize = 12.sp)
                                        Text("${uiState.buyerDocType.uppercase()}: ${uiState.buyerDocNumber}", color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Clave Secreta:", color = PosSlate400, fontSize = 12.sp)
                                        Text("•••• (Ingresada)", color = PosSuccessGreenLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                    HorizontalDivider(color = PosSlate700, modifier = Modifier.padding(vertical = 2.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Total a debitar:", color = PosSlate300, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                        Text(
                                            CurrencyHelper.formatCentavos(CurrencyHelper.parseInputToCentavos(uiState.amountInput)),
                                            color = PosGoldLight,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 16.sp
                                        )
                                    }
                                }
                            }

                            NfcWaveAnimation()

                            Text(
                                text = "Acerque la Tarjeta del CLIENTE",
                                style = MaterialTheme.typography.titleLarge,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "Coloque la tarjeta del comprador en el reverso del dispositivo para procesar el pago.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300,
                                textAlign = TextAlign.Center
                            )

                            if (uiState.isLoading) {
                                CircularProgressIndicator(color = PosPrimaryLight, modifier = Modifier.size(32.dp))
                            }

                            // Simulation buttons in demo mode
                            if (uiState.isDemoNode) {
                                Text(
                                    text = "Simulaciones de Prueba (Modo Demo):",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PosSlate400,
                                    fontWeight = FontWeight.Bold
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            viewModel.onMultiVendorBuyerTapped("BUYER_1SIG_DESFIRE", isMultisig = false, isDesfire = true)
                                        },
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("sim_buyer_1sig_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight),
                                        enabled = !uiState.isLoading
                                    ) {
                                        Text("1 Firma (DESFire)", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            viewModel.onMultiVendorBuyerTapped("BUYER_MULTISIG_2F_CARD", isMultisig = true, requiredSigs = 2, isDesfire = true)
                                        },
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("sim_buyer_multisig_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight),
                                        enabled = !uiState.isLoading
                                    ) {
                                        Text("Multifirma (2 Firmas)", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                    }
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            viewModel.onMultiVendorBuyerTapped("BUYER_MULTISIG_3F_CARD", isMultisig = true, requiredSigs = 3, isDesfire = true)
                                        },
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("sim_buyer_multisig_3f_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGold),
                                        enabled = !uiState.isLoading
                                    ) {
                                        Text("Multifirma (3 Firmas)", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            viewModel.onMultiVendorBuyerTapped(uiState.sellerCardUid ?: "DEMO_SELLER_01")
                                        },
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("sim_buyer_same_card_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight),
                                        enabled = !uiState.isLoading
                                    ) {
                                        Text("Probar Misma Tarjeta", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                    }
                                }
                            }

                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.setMvStep(4)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Modificar Clave Secreta o Documento")
                            }
                        }
                    }
                }

                6 -> {
                    // --- PASO 6: FIN / COMPROBANTE DE VENTA EXITOSA ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
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
                                    imageVector = Icons.Default.DoneAll,
                                    contentDescription = "Éxito",
                                    tint = PosSuccessGreenLight,
                                    modifier = Modifier.size(44.dp)
                                )
                            }

                            Text(
                                text = "¡VENTA COMUNITARIA EXITOSA!",
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
                                Text("Acreditado a:", color = PosSlate300)
                                Text(uiState.sellerName ?: "Vendedor", color = PosSlate100, fontWeight = FontWeight.Bold)
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Debitado de:", color = PosSlate300)
                                Text("${uiState.buyerDocType.uppercase()}: ${uiState.buyerDocNumber}", color = PosSlate100, fontWeight = FontWeight.Bold)
                            }

                            if (!uiState.buyerCardUid.isNullOrBlank()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Tarjeta Cliente:", color = PosSlate300)
                                    Text(uiState.buyerCardUid ?: "", color = PosSlate100, fontWeight = FontWeight.Bold)
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.resetMultiVendorSale()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .testTag("mv_next_sale_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                            ) {
                                Icon(imageVector = Icons.Default.AddShoppingCart, contentDescription = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text("Siguiente Venta Multi-Vendedor", fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.resetMultiVendorSale()
                                    viewModel.navigateTo(PosScreen.Dashboard)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSlate300)
                            ) {
                                Text("Salir al Menú Principal")
                            }
                        }
                    }
                }
            }
        }
    }
}
