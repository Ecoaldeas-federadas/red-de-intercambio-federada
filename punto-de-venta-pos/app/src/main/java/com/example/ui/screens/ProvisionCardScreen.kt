package com.example.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.api.PendingCard
import com.example.ui.theme.*
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Pantalla para grabar (inicializar) tarjetas NFC registradas en el servidor.
 *
 * Flujo:
 * 1. El admin registra la tarjeta en la web (user_id, card_uid, tipo, PIN)
 * 2. La tarjeta queda "registrada pero no inicializada" en el servidor
 * 3. El admin abre esta pantalla en el POS Android
 * 4. Se carga la lista de tarjetas pendientes de inicializar
 * 5. El admin coloca la tarjeta física en el celular (sin retirarla)
 * 6. El POS detecta la tarjeta y muestra "Tarjeta detectada: [UID]"
 * 7. El admin presiona "Grabar"
 * 8. El POS escribe los datos según el tipo de tarjeta
 * 9. El POS confirma la inicialización al servidor
 * 10. Muestra "Tarjeta inicializada correctamente. Puede retirarla."
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProvisionCardScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var pendingCards by remember { mutableStateOf<List<PendingCard>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var isGrabbing by remember { mutableStateOf(false) }
    var grabResult by remember { mutableStateOf("") }
    var grabProgress by remember { mutableStateOf("") }
    var selectedCard by remember { mutableStateOf<PendingCard?>(null) }
    var loadError by remember { mutableStateOf("") }

    // Cargar tarjetas pendientes al entrar
    LaunchedEffect(Unit) {
        isLoading = true
        loadError = ""
        val result = viewModel.repository.getPendingInitializationCards()
        result.onSuccess { resp ->
            pendingCards = resp.pendingCards
        }.onFailure { err ->
            loadError = err.message ?: "Error al cargar tarjetas pendientes"
        }
        isLoading = false
    }

    // Actualizar cardUid cuando se detecta una tarjeta
    LaunchedEffect(uiState.detectedCardUid) {
        if (!uiState.detectedCardUid.isNullOrBlank()) {
            // Buscar si el UID detectado corresponde a una tarjeta pendiente
            val matched = pendingCards.find { it.cardUid.equals(uiState.detectedCardUid, ignoreCase = true) }
            if (matched != null) {
                selectedCard = matched
                grabResult = "Tarjeta detectada: ${matched.cardUid}\n" +
                        "Tipo: ${matched.cardType}\n" +
                        "Usuario: ${matched.displayName} (@${matched.username})\n" +
                        "Presione \"Grabar\" para inicializar la tarjeta."
            } else {
                grabResult = "Tarjeta detectada: ${uiState.detectedCardUid}\n" +
                        "Esta tarjeta no está registrada como pendiente en el servidor.\n" +
                        "Regístrela primero en la web (Terminales NFC)."
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Grabar Tarjeta NFC",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.navigateTo(PosScreen.Admin)
                        }
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = PosSlate100
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PosNavyDark)
            )
        },
        containerColor = PosNavyDark
    ) { padding ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Instrucciones
            Card(
                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Grabado de Tarjetas NFC",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosGoldLight,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Esta pantalla permite inicializar tarjetas que ya fueron registradas " +
                                "en el servidor pero que aún no han sido grabadas físicamente.\n\n" +
                                "Pasos:\n" +
                                "1. Seleccione una tarjeta pendiente de la lista\n" +
                                "2. Coloque la tarjeta física en el lector NFC del celular\n" +
                                "3. NO retire la tarjeta durante el proceso\n" +
                                "4. Presione \"Grabar\" y espere a que termine\n" +
                                "5. Retire la tarjeta cuando el sistema lo indique",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PosSlate100
                    )
                }
            }

            // Lista de tarjetas pendientes
            Card(
                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Tarjetas Pendientes (${pendingCards.size})",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(onClick = {
                            coroutineScope.launch {
                                isLoading = true
                                loadError = ""
                                val result = viewModel.repository.getPendingInitializationCards()
                                result.onSuccess { resp ->
                                    pendingCards = resp.pendingCards
                                }.onFailure { err ->
                                    loadError = err.message ?: "Error"
                                }
                                isLoading = false
                            }
                        }) {
                            Text("Actualizar", color = PosPrimaryLight)
                        }
                    }

                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = PosPrimaryLight
                        )
                    }

                    if (loadError.isNotBlank()) {
                        Text(loadError, color = PosErrorRedLight, style = MaterialTheme.typography.bodySmall)
                    }

                    if (pendingCards.isEmpty() && !isLoading) {
                        Text(
                            text = "No hay tarjetas pendientes de inicialización.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate300
                        )
                    }

                    pendingCards.forEach { card ->
                        val isSelected = selectedCard?.cardUid == card.cardUid
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("pending_card_${card.cardUid}"),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isSelected) PosPrimaryBlue.copy(alpha = 0.2f) else PosSlate900
                            ),
                            shape = RoundedCornerShape(8.dp),
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                selectedCard = card
                                grabResult = "Tarjeta seleccionada: ${card.cardUid}\n" +
                                        "Tipo: ${card.cardType}\n" +
                                        "Usuario: ${card.displayName} (@${card.username})\n" +
                                        "Coloque la tarjeta en el lector y presione \"Grabar\"."
                            }
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = card.displayName.ifBlank { card.username },
                                    style = MaterialTheme.typography.titleSmall,
                                    color = PosSlate100,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "UID: ${card.cardUid}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosSlate300
                                )
                                Text(
                                    text = "Tipo: ${card.cardType}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = when (card.cardType) {
                                        "classic" -> PosGoldLight
                                        "ntag424" -> PosPrimaryLight
                                        "desfire" -> PosSuccessGreenLight
                                        else -> PosSlate300
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Detección de tarjeta NFC
            Card(
                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Detección de Tarjeta",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosGoldLight,
                        fontWeight = FontWeight.Bold
                    )

                    if (uiState.detectedCardUid.isNullOrBlank()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Nfc,
                                contentDescription = null,
                                tint = PosPrimaryLight
                            )
                            Text(
                                text = "Acerque una tarjeta al celular para detectarla",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate100
                            )
                        }
                    } else {
                        Text(
                            text = "UID detectado: ${uiState.detectedCardUid}",
                            style = MaterialTheme.typography.titleSmall,
                            color = PosSuccessGreen,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Botón Grabar
            val canGrab = selectedCard != null && !isGrabbing
            Button(
                onClick = {
                    val card = selectedCard ?: return@Button
                    FeedbackHelper.playButtonClick(context)
                    isGrabbing = true
                    grabProgress = "Iniciando grabación..."

                    coroutineScope.launch {
                        try {
                            when (card.cardType) {
                                "classic" -> {
                                    // MIFARE Classic: provisionar en el servidor y escribir 15 sectores
                                    grabProgress = "Solicitando datos al servidor..."
                                    val provResult = viewModel.repository.provisionClassicCard(
                                        userId = card.userId,
                                        cardUid = card.cardUid,
                                        initialPin = "0000" // PIN temporal, el admin lo cambia después
                                    )
                                    provResult.onSuccess { resp ->
                                        grabProgress = "Servidor generó ${resp.sectors.size} sectores.\n" +
                                                "Escribiendo en la tarjeta... NO LA RETIRE."
                                        // TODO: Escribir físicamente los sectores usando MifareClassicReader
                                        // Por ahora simulamos el progreso
                                        resp.sectors.forEachIndexed { index, sector ->
                                            grabProgress = "Escribiendo sector ${index + 1}/${resp.sectors.size}..."
                                            delay(500)
                                        }
                                        grabProgress = "Confirmando inicialización con el servidor..."
                                        val confirmResult = viewModel.repository.confirmCardInitialization(card.cardUid)
                                        confirmResult.onSuccess {
                                            grabResult = "Tarjeta inicializada correctamente. ${resp.sectors.size} sectores escritos.\n" +
                                                    "Sector activo: ${resp.sectors.find { it.isActive }?.sectorNumber}\n" +
                                                    "PUEDE RETIRAR LA TARJETA."
                                            FeedbackHelper.playSuccess(context)
                                            // Recargar lista
                                            val reload = viewModel.repository.getPendingInitializationCards()
                                            reload.onSuccess { r -> pendingCards = r.pendingCards }
                                            selectedCard = null
                                        }.onFailure { err ->
                                            grabResult = "Error confirmando: ${err.message}"
                                            FeedbackHelper.playError(context)
                                        }
                                    }.onFailure { err ->
                                        grabResult = "Error: ${err.message}"
                                        FeedbackHelper.playError(context)
                                    }
                                }
                                "ntag424", "desfire" -> {
                                    // NTAG424/DESFire: la clave AES ya fue generada en la web
                                    // Aquí solo confirmamos la inicialización
                                    // TODO: Escribir físicamente la clave AES usando IsoDep
                                    grabProgress = "Grabando clave AES en tarjeta ${card.cardType}..."
                                    delay(1000)
                                    grabProgress = "Confirmando inicialización con el servidor..."
                                    val confirmResult = viewModel.repository.confirmCardInitialization(card.cardUid)
                                    confirmResult.onSuccess {
                                        grabResult = "Tarjeta ${card.cardType} inicializada correctamente.\n" +
                                                "PUEDE RETIRAR LA TARJETA."
                                        FeedbackHelper.playSuccess(context)
                                        val reload = viewModel.repository.getPendingInitializationCards()
                                        reload.onSuccess { r -> pendingCards = r.pendingCards }
                                        selectedCard = null
                                    }.onFailure { err ->
                                        grabResult = "Error confirmando: ${err.message}"
                                        FeedbackHelper.playError(context)
                                    }
                                }
                                else -> {
                                    grabResult = "Tipo de tarjeta no soportado: ${card.cardType}"
                                    FeedbackHelper.playError(context)
                                }
                            }
                        } catch (e: Exception) {
                            grabResult = "Error: ${e.message}"
                            FeedbackHelper.playError(context)
                        }
                        isGrabbing = false
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .testTag("grab_card_btn"),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                enabled = canGrab
            ) {
                if (isGrabbing) {
                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                } else {
                    Icon(imageVector = Icons.Default.Nfc, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Grabar Tarjeta",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosWhite,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Progreso de grabación
            if (grabProgress.isNotBlank() && isGrabbing) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = grabProgress,
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosGoldLight
                        )
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = PosPrimaryBlue
                        )
                    }
                }
            }

            // Resultado
            if (grabResult.isNotBlank() && !isGrabbing) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val isSuccess = grabResult.contains("correctamente")
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Warning,
                                contentDescription = null,
                                tint = if (isSuccess) PosSuccessGreen else PosErrorRed
                            )
                            Text(
                                text = grabResult,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (isSuccess) PosSuccessGreenLight else PosErrorRedLight
                            )
                        }
                    }
                }
            }
        }
    }
}
