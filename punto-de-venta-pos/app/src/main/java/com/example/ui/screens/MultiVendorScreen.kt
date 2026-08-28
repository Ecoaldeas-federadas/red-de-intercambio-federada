package com.example.ui.screens

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
                            viewModel.navigateTo(PosScreen.Dashboard)
                        },
                        modifier = Modifier.testTag("mv_back_btn")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = PosSlate100
                        )
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
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
            // ERROR MODAL FOR SAME CARD ERROR
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

            // Alerts / Normal Error Messages
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

            if (!uiState.successMessage.isNullOrBlank() && uiState.mvStep != 5) {
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

            // STEP PROGRESS INDICATOR
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val steps = listOf("Vendedor", "Monto", "Cliente", "PIN", "Fin")
                steps.forEachIndexed { index, stepName ->
                    val stepNum = index + 1
                    val isDone = uiState.mvStep > stepNum
                    val isCurrent = uiState.mvStep == stepNum

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
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
                                    modifier = Modifier.size(18.dp)
                                )
                            } else {
                                Text(
                                    text = "$stepNum",
                                    color = if (isCurrent) PosNavyDark else PosSlate300,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = stepName,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isCurrent) PosPrimaryLight else PosSlate600,
                            fontSize = 11.sp
                        )
                    }
                }
            }

            HorizontalDivider(color = PosSlate800)

            // --- MULTI-SIG ACTIVE: Mostrar UI de firma secuencial real ---
            // Cuando el servidor responde pending_multisig, entramos en este flujo
            // que reutiliza el mismo patron que NfcChargeScreen.
            if (uiState.isMultisigActive) {
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
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "Cuenta Mancomunada",
                            style = MaterialTheme.typography.titleLarge,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = uiState.multisigMessage
                                ?: "Acerque la tarjeta del firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate300,
                            textAlign = TextAlign.Center
                        )

                        if (!uiState.isNfcWaitingCard && uiState.detectedCardUid != null) {
                            // Tarjeta detectada - mostrar campo de PIN
                            Text(
                                text = "Tarjeta: ${uiState.detectedCardUid}",
                                style = MaterialTheme.typography.bodySmall,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold
                            )
                            PinInputPad(
                                pin = uiState.customerPin,
                                onPinChange = { viewModel.setCustomerPin(it) },
                                title = "PIN del Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}",
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitMultisigSigner(
                                        cardUid = uiState.detectedCardUid ?: "",
                                        pin = uiState.customerPin,
                                        docType = if (uiState.requireIdVerification) uiState.selectedDocType else null,
                                        docNum = if (uiState.requireIdVerification) uiState.idDocNumber else null
                                    )
                                },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
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
                                            "Aprobar Pago Multi-Firma"
                                        },
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosNavyDark,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        } else {
                            // Esperando tarjeta del siguiente firmante
                            NfcWaveAnimation()
                            Text(
                                text = "Acerque la tarjeta del Firmante ${uiState.multisigCollectedSigs + 1} de ${uiState.multisigRequiredSigs}",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
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
                            // Banner distintivo Vendedor
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

                            // Grafico Ilustrativo de Tarjeta de Vendedor
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

                            // Quick simulation button for tests - ONLY ON DEMO NODE
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
                        Text("Confirmar Monto y Pasar al Cliente", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    }
                }

                3 -> {
                    // --- PASO 3: TAP BUYER (CUSTOMER) CARD ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, PosPrimaryLight.copy(alpha = 0.6f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Banner distintivo Comprador
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
                                    Icon(Icons.Default.CreditCard, contentDescription = null, tint = PosPrimaryLight, modifier = Modifier.size(18.dp))
                                    Text("PASO 3 • COBRO AL CLIENTE", color = PosPrimaryLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }

                            // Grafico Ilustrativo de Tarjeta de Comprador / Cliente
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(130.dp)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(
                                        androidx.compose.ui.graphics.Brush.linearGradient(
                                            listOf(androidx.compose.ui.graphics.Color(0xFF0284C7), androidx.compose.ui.graphics.Color(0xFF38BDF8))
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
                                            Icon(Icons.Default.Person, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(24.dp))
                                            Text("TARJETA CLIENTE / COMPRADOR", color = PosNavyDark, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                        }
                                        Icon(Icons.Default.Contactless, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(26.dp))
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Bottom
                                    ) {
                                        Column {
                                            Text("Monto a Pagar", color = PosNavyDark.copy(alpha = 0.8f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Text(
                                                CurrencyHelper.formatMicroUnits(CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)),
                                                color = PosNavyDark,
                                                fontSize = 18.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                        }
                                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = PosNavyDark.copy(alpha = 0.5f), modifier = Modifier.size(32.dp))
                                    }
                                }
                            }

                            NfcWaveAnimation()

                            Text(
                                text = if (uiState.isMultiVendorMultisig && uiState.mvMultisigCollected > 0) {
                                    "Acerque la Tarjeta del FIRMANTE ${uiState.mvMultisigCollected + 1} de ${uiState.mvMultisigRequired}"
                                } else {
                                    "Acerque la Tarjeta del CLIENTE"
                                },
                                style = MaterialTheme.typography.titleLarge,
                                color = if (uiState.isMultiVendorMultisig && uiState.mvMultisigCollected > 0) PosGoldLight else PosPrimaryLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )

                            if (uiState.isMultiVendorMultisig && uiState.mvMultisigCollected > 0) {
                                Text(
                                    text = "La firma ${uiState.mvMultisigCollected} de ${uiState.mvMultisigRequired} fue aprobada. Acerque la tarjeta del siguiente titular al reverso del teléfono.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosSlate300,
                                    textAlign = TextAlign.Center
                                )
                            }

                            // Resumen de la operacion
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Cobro para el Vendedor:", color = PosSlate400, fontSize = 12.sp)
                                        Text(uiState.sellerName ?: "Vendedor", color = PosGoldLight, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Total a debitar:", color = PosSlate400, fontSize = 12.sp)
                                        Text(
                                            CurrencyHelper.formatMicroUnits(CurrencyHelper.parseInputToMicroUnits(uiState.amountInput)),
                                            color = PosSlate100,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp
                                        )
                                    }
                                }
                            }

                            // Quick simulation buttons for tests - ONLY ON DEMO NODE
                            if (uiState.isDemoNode) {
                                Text(
                                    text = "Simulaciones de Prueba (Modo Demo):",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PosSlate400,
                                    fontWeight = FontWeight.Bold
                                )

                                if (uiState.isMultiVendorMultisig && uiState.mvMultisigCollected > 0) {
                                    val nextSignerIdx = uiState.mvMultisigCollected + 1
                                    Button(
                                        onClick = {
                                            FeedbackHelper.playButtonClick(context)
                                            val simUid = "BUYER_MULTISIG_FIRM$nextSignerIdx"
                                            viewModel.onMultiVendorBuyerTapped(simUid, isMultisig = true, requiredSigs = uiState.mvMultisigRequired, isDesfire = true)
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(48.dp)
                                            .testTag("sim_buyer_next_signer_btn"),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                                    ) {
                                        Icon(Icons.Default.Groups, contentDescription = null, tint = PosNavyDark)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            "Simular Tarjeta Firmante $nextSignerIdx de ${uiState.mvMultisigRequired}",
                                            color = PosNavyDark,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                } else {
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
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
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
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
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
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGold)
                                        ) {
                                            Text("Multifirma (3 Firmas)", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                        }

                                        // Button to test same card validation error
                                        OutlinedButton(
                                            onClick = {
                                                FeedbackHelper.playButtonClick(context)
                                                viewModel.onMultiVendorBuyerTapped(uiState.sellerCardUid ?: "DEMO_SELLER_01")
                                            },
                                            modifier = Modifier
                                                .weight(1f)
                                                .testTag("sim_buyer_same_card_btn"),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                                        ) {
                                            Text("Probar Misma Tarjeta", fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                4 -> {
                    // --- PASO 4: BUYER PIN & ID VERIFICATION ---
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
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "Comprador: ${uiState.buyerCardUid}",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (uiState.isMultiVendorMultisig) {
                                        Text(
                                            text = "Cuenta Mancomunada (${uiState.mvMultisigCollected} / ${uiState.mvMultisigRequired} firmas)",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = PosGoldLight,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                TextButton(
                                    onClick = {
                                        FeedbackHelper.playButtonClick(context)
                                        viewModel.navigateTo(PosScreen.MultiVendor)
                                    }
                                ) {
                                    Text("Reiniciar", color = PosSlate400, fontSize = 12.sp)
                                }
                            }

                            if (uiState.isMultiVendorMultisig) {
                                Surface(
                                    color = PosGold.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(10.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, PosGold.copy(alpha = 0.5f)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Groups, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(18.dp))
                                        Text(
                                            text = if (uiState.mvMultisigCollected == 0) {
                                                "Firmante 1 de 2: Ingrese PIN de autorización"
                                            } else {
                                                "Firmante 2 de 2: Ingrese PIN del segundo autorizador"
                                            },
                                            style = MaterialTheme.typography.bodySmall,
                                            color = PosGoldLight,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

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
                                            text = "Verificación de Identidad del Comprador (Tarjeta Clásica)",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = PosGoldLight,
                                            fontWeight = FontWeight.Bold
                                        )

                                        ExposedDropdownMenuBox(
                                            expanded = buyerDocExpanded,
                                            onExpandedChange = { buyerDocExpanded = !buyerDocExpanded }
                                        ) {
                                            OutlinedTextField(
                                                value = DEFAULT_DOCUMENT_TYPES.find { it.code == uiState.buyerDocType }?.spanishName ?: "Cédula",
                                                onValueChange = {},
                                                readOnly = true,
                                                label = { Text("Tipo de Documento") },
                                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = buyerDocExpanded) },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .menuAnchor(),
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedTextColor = PosSlate100,
                                                    unfocusedTextColor = PosSlate100
                                                )
                                            )
                                            ExposedDropdownMenu(
                                                expanded = buyerDocExpanded,
                                                onDismissRequest = { buyerDocExpanded = false }
                                            ) {
                                                DEFAULT_DOCUMENT_TYPES.forEach { doc ->
                                                    DropdownMenuItem(
                                                        text = { Text(doc.spanishName) },
                                                        onClick = {
                                                            viewModel.setBuyerDocInfo(doc.code, uiState.buyerDocNumber)
                                                            buyerDocExpanded = false
                                                        }
                                                    )
                                                }
                                            }
                                        }

                                        OutlinedTextField(
                                            value = uiState.buyerDocNumber,
                                            onValueChange = { viewModel.setBuyerDocInfo(uiState.buyerDocType, it) },
                                            label = { Text("Número de Documento del Cliente") },
                                            placeholder = { Text("Ej. 98765432") },
                                            singleLine = true,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .testTag("buyer_doc_input"),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedTextColor = PosSlate100,
                                                unfocusedTextColor = PosSlate100
                                            )
                                        )
                                    }
                                }
                            }

                            PinInputPad(
                                pin = uiState.buyerPin,
                                onPinChange = { pin ->
                                    viewModel.setBuyerPin(pin)
                                },
                                title = if (uiState.isMultiVendorMultisig) {
                                    "PIN del Firmante ${uiState.mvMultisigCollected + 1} de ${uiState.mvMultisigRequired}"
                                } else {
                                    "PIN del Comprador (4 dígitos)"
                                }
                            )

                            val isIntermediateSignature = (uiState.isMultiVendorMultisig && uiState.mvMultisigCollected < uiState.mvMultisigRequired - 1)

                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.submitMultiVendorPayment()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(58.dp)
                                    .testTag("mv_submit_payment_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isIntermediateSignature) PosGold else PosSuccessGreen
                                )
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosNavyDark, modifier = Modifier.size(24.dp))
                                } else {
                                    Icon(
                                        imageVector = if (isIntermediateSignature) Icons.Default.Groups else Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = PosNavyDark
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = if (isIntermediateSignature) {
                                            "Validar Firma ${uiState.mvMultisigCollected + 1} de ${uiState.mvMultisigRequired}"
                                        } else {
                                            "Aprobar y Transferir al Vendedor"
                                        },
                                        color = PosNavyDark,
                                        fontWeight = FontWeight.Black,
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                }
                            }
                        }
                    }
                }

                5 -> {
                    // --- PASO 5: SUCCESS RECEIPT & NEXT SALE ---
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
                                Text("Acreditado a:", color = PosSlate300)
                                Text(uiState.sellerName ?: "Vendedor", color = PosSlate100, fontWeight = FontWeight.Bold)
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Debitado de:", color = PosSlate300)
                                Text("Cliente ${uiState.buyerCardUid}", color = PosSlate100, fontWeight = FontWeight.Bold)
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
