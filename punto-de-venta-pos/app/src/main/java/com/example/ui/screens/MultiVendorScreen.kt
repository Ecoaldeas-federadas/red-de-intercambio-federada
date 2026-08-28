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
fun MultiVendorScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
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
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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

            when (uiState.mvStep) {
                1 -> {
                    // --- PASO 1: TAP VENDOR CARD ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            NfcWaveAnimation()

                            Text(
                                text = "PASO 1: ACERQUE TARJETA DEL VENDEDOR",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosGoldLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "La persona que recibirá el dinero (vendedor) debe acercar su tarjeta para identificarse.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300,
                                textAlign = TextAlign.Center
                            )

                            // Quick simulation button for tests - ONLY ON DEMO NODE
                            if (uiState.isDemoNode) {
                                OutlinedButton(
                                    onClick = { viewModel.onMultiVendorSellerTapped("SELLER_CARD_88") },
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
                        onClick = { viewModel.onMultiVendorAmountSet() },
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
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            NfcWaveAnimation()

                            Text(
                                text = "PASO 3: ACERQUE TARJETA DEL CLIENTE",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "Monto a cobrar: ${CurrencyHelper.formatMicroUnits(CurrencyHelper.parseInputToMicroUnits(uiState.amountInput))}\nVendedor: ${uiState.sellerName}",
                                style = MaterialTheme.typography.bodyLarge,
                                color = PosSlate100,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )

                            // Quick simulation button for tests - ONLY ON DEMO NODE
                            if (uiState.isDemoNode) {
                                OutlinedButton(
                                    onClick = { viewModel.onMultiVendorBuyerTapped("BUYER_CARD_99") },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("sim_buyer_tap_btn"),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
                                ) {
                                    Text("Simular Tarjeta Cliente (BUYER_99)")
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
                            Text(
                                text = "Comprador: ${uiState.buyerCardUid}",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosSlate100,
                                fontWeight = FontWeight.Bold
                            )

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
                                            text = "Verificación de Identidad del Comprador (UID)",
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
                                                            viewModel.setIdDocInfo(doc.code, uiState.buyerDocNumber)
                                                            buyerDocExpanded = false
                                                        }
                                                    )
                                                }
                                            }
                                        }

                                        OutlinedTextField(
                                            value = uiState.buyerDocNumber,
                                            onValueChange = { viewModel.setIdDocInfo(uiState.buyerDocType, it) },
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
                                    // Update buyer pin
                                    viewModel.setCustomerPin(pin)
                                    // Also sync in state
                                },
                                title = "PIN del Comprador (4 dígitos)"
                            )

                            Button(
                                onClick = { viewModel.submitMultiVendorPayment() },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(58.dp)
                                    .testTag("mv_submit_payment_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosSuccessGreen)
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosNavyDark, modifier = Modifier.size(24.dp))
                                } else {
                                    Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = PosNavyDark)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text("Ejecutar Pago Comunitario", color = PosNavyDark, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
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
                                onClick = { viewModel.resetMultiVendorSale() },
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
                                onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
