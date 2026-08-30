package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.KioskNumericKeypad
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShiftManagementScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val latestShift by viewModel.latestShift.collectAsState()
    val isShiftOpen = latestShift?.status == "open"
    val context = LocalContext.current

    var pinInput by remember { mutableStateOf("") }
    var pinVerified by remember { mutableStateOf(false) }
    var shiftInitialAmount by remember { mutableStateOf("") }
    var showCreatePinDialog by remember { mutableStateOf(false) }
    var pinError by remember { mutableStateOf<String?>(null) }

    // Check if PIN exists on enter
    LaunchedEffect(Unit) {
        viewModel.hasShiftPin { hasPin ->
            if (!hasPin) {
                showCreatePinDialog = true
            }
        }
    }

    if (showCreatePinDialog) {
        var newPin by remember { mutableStateOf("") }
        var confirmPin by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreatePinDialog = false },
            title = { Text("Crear PIN de Punto", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Cree un PIN de 4 dígitos para proteger el acceso a Abrir/Cerrar Punto.")
                    OutlinedTextField(
                        value = newPin,
                        onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) newPin = it },
                        label = { Text("PIN (4 dígitos)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = confirmPin,
                        onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) confirmPin = it },
                        label = { Text("Confirmar PIN") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true
                    )
                    if (pinError != null) {
                        Text(pinError!!, color = PosErrorRedLight, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        FeedbackHelper.playButtonClick(context)
                        if (newPin.length != 4) {
                            pinError = "El PIN debe tener 4 dígitos"
                            return@Button
                        }
                        if (newPin != confirmPin) {
                            pinError = "Los PINs no coinciden"
                            return@Button
                        }
                        viewModel.setShiftPin(newPin) {
                            showCreatePinDialog = false
                            pinError = null
                            pinVerified = true
                        }
                    }
                ) { Text("Crear") }
            },
            dismissButton = {
                TextButton(onClick = {
                    FeedbackHelper.playButtonClick(context)
                    showCreatePinDialog = false
                    viewModel.navigateTo(PosScreen.Settings)
                }) { Text("Cancelar") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Abrir / Cerrar Punto",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.navigateTo(PosScreen.Settings)
                        },
                        modifier = Modifier.testTag("shift_mgmt_back_btn")
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!pinVerified) {
                // PIN verification
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = PosGoldLight,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "Ingrese PIN para continuar",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                        OutlinedTextField(
                            value = pinInput,
                            onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) pinInput = it },
                            label = { Text("PIN") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.testTag("shift_pin_input")
                        )
                        if (pinError != null) {
                            Text(pinError!!, color = PosErrorRedLight, fontSize = 12.sp)
                        }
                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.verifyShiftPin(pinInput) { success ->
                                    if (success) {
                                        pinVerified = true
                                        pinError = null
                                        pinInput = ""
                                    } else {
                                        pinError = "PIN incorrecto"
                                        pinInput = ""
                                    }
                                }
                            },
                            enabled = pinInput.length == 4,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("shift_pin_verify_btn"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Text("Verificar", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                // PIN verified - show shift management
                if (isShiftOpen) {
                    // Shift is open - show close option
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "PUNTO ABIERTO",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold
                            )
                            HorizontalDivider(color = PosSlate800)
                            val shift = latestShift!!
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Apertura:", color = PosSlate300)
                                Text(
                                    CurrencyHelper.formatCentavos(shift.openingAmount),
                                    color = PosSlate100,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Ventas del turno:", color = PosSlate300)
                                Text(
                                    CurrencyHelper.formatCentavos(shift.totalSales),
                                    color = PosGoldLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Transacciones:", color = PosSlate300)
                                Text(
                                    "${shift.transactionsCount}",
                                    color = PosSlate100,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Cierre esperado:", color = PosSlate300)
                                Text(
                                    CurrencyHelper.formatCentavos(shift.openingAmount + shift.totalSales),
                                    color = PosPrimaryLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    viewModel.closeShift(null, "Cierre de punto")
                                    pinVerified = false
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .testTag("close_shift_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosErrorRed)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Cerrar Punto", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                } else {
                    // No shift open - show open option
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate900),
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "ABRIR PUNTO",
                                style = MaterialTheme.typography.titleMedium,
                                color = PosPrimaryLight,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Ingrese el monto inicial de caja (efectivo para vueltos).",
                                style = MaterialTheme.typography.bodySmall,
                                color = PosSlate300
                            )
                            // POS-style amount display
                            val centavos = shiftInitialAmount.replace(Regex("[^0-9]"), "").ifEmpty { "0" }.toLong()
                            Text(
                                text = CurrencyHelper.formatCentavos(centavos),
                                style = MaterialTheme.typography.headlineLarge,
                                color = if (centavos > 0) PosPrimaryLight else PosSlate600,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                            KioskNumericKeypad(
                                currentInput = shiftInitialAmount,
                                onInputChange = { shiftInitialAmount = it }
                            )
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    val micro = CurrencyHelper.parseInputToCentavos(shiftInitialAmount)
                                    viewModel.openShift(micro, "Apertura de punto")
                                    shiftInitialAmount = ""
                                    pinVerified = false
                                },
                                enabled = centavos > 0,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .testTag("open_shift_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Abrir Punto", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
