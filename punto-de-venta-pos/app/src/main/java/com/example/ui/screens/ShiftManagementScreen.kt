package com.example.ui.screens

import androidx.compose.foundation.clickable
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
import com.example.data.api.ShiftHistoryItem
import com.example.ui.components.KioskNumericKeypad
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
    var isOfflineMode by remember { mutableStateOf(false) }
    var hasPendingClose by remember { mutableStateOf(false) }
    var shiftInitialAmount by remember { mutableStateOf("") }
    var pinError by remember { mutableStateOf<String?>(null) }
    var pinNotConfigured by remember { mutableStateOf(false) }
    var checkingPin by remember { mutableStateOf(true) }

    // Shift history state
    var showHistory by remember { mutableStateOf(false) }
    var shiftHistory by remember { mutableStateOf<List<ShiftHistoryItem>>(emptyList()) }
    var fromDate by remember { mutableStateOf("") }
    var toDate by remember { mutableStateOf("") }
    var selectedShift by remember { mutableStateOf<ShiftHistoryItem?>(null) }
    var historyLoading by remember { mutableStateOf(false) }

    // Al entrar, consultar si el dueño ha configurado el PIN en el backend
    // y verificar si hay un cierre pendiente de sincronizar
    LaunchedEffect(Unit) {
        // Primero intentar sincronizar cierre pendiente si hay conexión
        viewModel.hasPendingSyncShift { hasPending ->
            if (hasPending) {
                hasPendingClose = true
                // Intentar sincronizar
                viewModel.syncPendingClose { synced ->
                    if (synced) {
                        hasPendingClose = false
                    }
                }
            } else {
                // No hay cierre pendiente — verificar si el backend ya cerró
                // el turno que el POS tiene abierto localmente
                viewModel.checkBackendShiftStatus { updated ->
                    // Si el backend cerró, el estado local se actualizó
                }
            }
        }
        viewModel.hasShiftPin { hasPin ->
            checkingPin = false
            if (!hasPin) {
                pinNotConfigured = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (showHistory) "Historial de Turnos" else "Abrir / Cerrar Punto",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            if (showHistory) {
                                showHistory = false
                                selectedShift = null
                            } else {
                                viewModel.navigateTo(PosScreen.Settings)
                            }
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
                actions = {
                    if (pinVerified && !showHistory) {
                        TextButton(onClick = {
                            FeedbackHelper.playButtonClick(context)
                            showHistory = true
                            historyLoading = true
                            val f = if (fromDate.isBlank()) null else fromDate
                            val t = if (toDate.isBlank()) null else toDate
                            viewModel.loadShiftHistory(f, t) { items ->
                                shiftHistory = items
                                historyLoading = false
                            }
                        }) {
                            Icon(Icons.Default.History, contentDescription = "Historial", tint = PosGoldLight)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Historial", color = PosGoldLight)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PosSlate900)
            )
        },
        containerColor = PosNavyDark
    ) { padding ->
        // --- Vista de Historial ---
        if (showHistory) {
            ShiftHistoryContent(
                shifts = shiftHistory,
                selectedShift = selectedShift,
                onSelectShift = { selectedShift = it },
                fromDate = fromDate,
                toDate = toDate,
                onFromDateChange = { fromDate = it },
                onToDateChange = { toDate = it },
                onSearch = {
                    historyLoading = true
                    val f = if (fromDate.isBlank()) null else fromDate
                    val t = if (toDate.isBlank()) null else toDate
                    viewModel.loadShiftHistory(f, t) { items ->
                        shiftHistory = items
                        historyLoading = false
                        selectedShift = null
                    }
                },
                historyLoading = historyLoading,
                modifier = modifier.padding(padding)
            )
            return@Scaffold
        }

        // --- Contenido principal ---
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Indicador modo offline
            if (isOfflineMode && pinVerified) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.WifiOff, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(20.dp))
                        Text(
                            "Modo sin conexión — puede cerrar el punto y ver transacciones. No puede abrir punto hasta sincronizar.",
                            color = PosGoldLight,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Aviso de cierre pendiente de sincronizar
            if (hasPendingClose && pinVerified) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null, tint = PosGoldLight, modifier = Modifier.size(20.dp))
                            Text(
                                "Cierre pendiente de sincronizar",
                                color = PosGoldLight,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            "El último cierre se hizo sin conexión. No puede abrir un nuevo turno hasta que se sincronice con el servidor.",
                            color = PosSlate300,
                            fontSize = 12.sp
                        )
                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.syncPendingClose { synced ->
                                    if (synced) {
                                        hasPendingClose = false
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Sincronizar ahora")
                        }
                    }
                }
            }

            // Cargando verificacion de PIN
            if (checkingPin) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = PosGoldLight)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Verificando configuración...", color = PosSlate300)
                    }
                }
            }

            // PIN no configurado por el dueño
            else if (pinNotConfigured) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = PosErrorRedLight,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "PIN del turno no configurado",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "El dueño del terminal debe configurar el PIN del turno desde su panel web (Mis Terminales → PIN Turno). Mientras no esté configurado, no se puede abrir ni cerrar punto.",
                            color = PosSlate300,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                checkingPin = true
                                pinNotConfigured = false
                                viewModel.hasShiftPin { hasPin ->
                                    checkingPin = false
                                    if (!hasPin) {
                                        pinNotConfigured = true
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Reintentar")
                        }
                    }
                }
            }

            // PIN verificado — mostrar gestion de turno
            else if (pinVerified) {
                if (isShiftOpen) {
                    // Turno abierto — mostrar resumen y opcion de cerrar
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

                            // Pedir PIN para cerrar
                            Text("Ingrese el PIN del turno para cerrar:", color = PosSlate300, fontSize = 13.sp)
                            OutlinedTextField(
                                value = pinInput,
                                onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) pinInput = it },
                                label = { Text("PIN del turno") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                visualTransformation = PasswordVisualTransformation(),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            if (pinError != null) {
                                Text(pinError!!, color = PosErrorRedLight, fontSize = 12.sp)
                            }
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    if (pinInput.length != 4) {
                                        pinError = "Ingrese el PIN de 4 dígitos"
                                        return@Button
                                    }
                                    viewModel.closeShift(pinInput, null, "Cierre de punto")
                                    pinInput = ""
                                    pinVerified = false
                                },
                                enabled = pinInput.length == 4,
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
                    // No hay turno abierto — mostrar apertura
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

                            // PIN del turno para abrir
                            Text("Ingrese el PIN del turno para abrir:", color = PosSlate300, fontSize = 13.sp)
                            OutlinedTextField(
                                value = pinInput,
                                onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) pinInput = it },
                                label = { Text("PIN del turno") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                visualTransformation = PasswordVisualTransformation(),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            if (pinError != null) {
                                Text(pinError!!, color = PosErrorRedLight, fontSize = 12.sp)
                            }
                            Button(
                                onClick = {
                                    FeedbackHelper.playButtonClick(context)
                                    if (pinInput.length != 4) {
                                        pinError = "Ingrese el PIN de 4 dígitos"
                                        return@Button
                                    }
                                    val micro = CurrencyHelper.parseInputToCentavos(shiftInitialAmount)
                                    viewModel.openShift(micro, pinInput, "Apertura de punto")
                                    shiftInitialAmount = ""
                                    pinInput = ""
                                    pinVerified = false
                                },
                                enabled = centavos > 0 && pinInput.length == 4 && !hasPendingClose && !isOfflineMode,
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

            // Pedir PIN para entrar (el PIN configurado por el dueño en el backend)
            else {
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
                            text = "Ingrese el PIN del turno",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Este PIN lo configura el dueño del terminal desde el panel web.",
                            color = PosSlate400,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                        OutlinedTextField(
                            value = pinInput,
                            onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) pinInput = it },
                            label = { Text("PIN (4 dígitos)") },
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
                                viewModel.verifyShiftPin(pinInput) { success, error, offline ->
                                    if (success) {
                                        pinVerified = true
                                        isOfflineMode = offline
                                        pinError = null
                                        pinInput = ""
                                    } else {
                                        pinError = error ?: "PIN incorrecto"
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
            }

            // Mostrar errores del ViewModel
            uiState.errorMessage?.let { msg ->
                if (!checkingPin && !pinNotConfigured) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = PosSlate800),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            msg,
                            color = PosErrorRedLight,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            // Mostrar exito
            uiState.successMessage?.let { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        msg,
                        color = PosSuccessGreen,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }
    }
}

// ============================================
// Vista de Historial de Turnos
// ============================================

@Composable
private fun ShiftHistoryContent(
    shifts: List<ShiftHistoryItem>,
    selectedShift: ShiftHistoryItem?,
    onSelectShift: (ShiftHistoryItem?) -> Unit,
    fromDate: String,
    toDate: String,
    onFromDateChange: (String) -> Unit,
    onToDateChange: (String) -> Unit,
    onSearch: () -> Unit,
    historyLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Filtro de fechas
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = PosSlate900),
            shape = RoundedCornerShape(14.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Filtrar por rango de fechas", color = PosSlate100, fontWeight = FontWeight.Bold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = fromDate,
                        onValueChange = onFromDateChange,
                        label = { Text("Desde (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100,
                            focusedLabelColor = PosGoldLight,
                            unfocusedLabelColor = PosSlate400
                        )
                    )
                    OutlinedTextField(
                        value = toDate,
                        onValueChange = onToDateChange,
                        label = { Text("Hasta (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100,
                            focusedLabelColor = PosGoldLight,
                            unfocusedLabelColor = PosSlate400
                        )
                    )
                }
                Button(
                    onClick = onSearch,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Buscar")
                }
            }
        }

        // Detalle de turno seleccionado
        if (selectedShift != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Detalle del Turno", color = PosSlate100, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        TextButton(onClick = { onSelectShift(null) }) {
                            Text("Volver", color = PosGoldLight)
                        }
                    }
                    HorizontalDivider(color = PosSlate800)
                    ShiftDetailRow("Usuario", selectedShift.userName ?: "—")
                    ShiftDetailRow("Estado", if (selectedShift.status == "closed") "Cerrado" else "Abierto")
                    ShiftDetailRow("Apertura", formatDate(selectedShift.openedAt))
                    if (selectedShift.closedAt != null) {
                        ShiftDetailRow("Cierre", formatDate(selectedShift.closedAt))
                    }
                    ShiftDetailRow("Monto apertura", CurrencyHelper.formatCentavos(selectedShift.openingAmount))
                    if (selectedShift.closingAmount != null) {
                        ShiftDetailRow("Monto cierre", CurrencyHelper.formatCentavos(selectedShift.closingAmount))
                    }
                    ShiftDetailRow("Ventas totales", CurrencyHelper.formatCentavos(selectedShift.totalSales))
                    ShiftDetailRow("Transacciones", "${selectedShift.transactionsCount}")
                    if (selectedShift.notes != null) {
                        ShiftDetailRow("Notas", selectedShift.notes)
                    }
                }
            }
        }

        // Cargando
        if (historyLoading) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(color = PosGoldLight)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Cargando historial...", color = PosSlate300)
                }
            }
        }

        // Lista vacia
        else if (shifts.isEmpty() && selectedShift == null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.History, contentDescription = null, tint = PosSlate600, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No hay turnos en el rango seleccionado", color = PosSlate400, textAlign = TextAlign.Center)
                }
            }
        }

        // Lista de turnos
        else if (selectedShift == null) {
            shifts.forEach { shift ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectShift(shift) },
                    colors = CardDefaults.cardColors(containerColor = PosSlate900),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                shift.userName ?: "—",
                                color = PosSlate100,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = if (shift.status == "closed") PosSuccessGreen.copy(alpha = 0.15f) else PosGoldLight.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    if (shift.status == "closed") "Cerrado" else "Abierto",
                                    color = if (shift.status == "closed") PosSuccessGreen else PosGoldLight,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            formatDate(shift.openedAt) + (shift.closedAt?.let { " → ${formatDate(it)}" } ?: ""),
                            color = PosSlate400,
                            fontSize = 12.sp
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Ventas: ${CurrencyHelper.formatCentavos(shift.totalSales)}",
                                color = PosGoldLight,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "${shift.transactionsCount} trans.",
                                color = PosSlate400,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShiftDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = PosSlate300, fontSize = 13.sp)
        Text(value, color = PosSlate100, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

private fun formatDate(isoString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val date = inputFormat.parse(isoString) ?: return isoString
        outputFormat.format(date)
    } catch (e: Exception) {
        isoString
    }
}
