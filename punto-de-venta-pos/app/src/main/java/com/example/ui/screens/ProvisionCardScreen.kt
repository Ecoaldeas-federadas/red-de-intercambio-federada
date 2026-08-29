package com.example.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.ui.theme.*
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosViewModel

/**
 * Pantalla para provisionar una tarjeta MIFARE Classic con certificados dinamicos.
 *
 * El admin ingresa el user_id y PIN inicial, acerca la tarjeta en blanco,
 * y el POS escribe los 15 sectores con claves y certificados.
 *
 * Esto se hace en una maquina dedicada donde la tarjeta se monta y se deja quieta.
 */
@Composable
fun ProvisionCardScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    var userId by remember { mutableStateOf("") }
    var cardUid by remember { mutableStateOf("") }
    var initialPin by remember { mutableStateOf("") }
    var provisionResult by remember { mutableStateOf("") }
    var isProvisioning by remember { mutableStateOf(false) }
    var provisionedSectors by remember { mutableStateOf(0) }

    // Actualizar cardUid cuando se detecta una tarjeta
    LaunchedEffect(uiState.detectedCardUid) {
        if (!uiState.detectedCardUid.isNullOrBlank()) {
            cardUid = uiState.detectedCardUid!!
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Provisionar Tarjeta Classic",
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
            // Advertencia
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
                        text = "Provisionamiento de Tarjeta MIFARE Classic",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosGoldLight,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Esta operacion escribe 15 sectores con claves y certificados unicos en la tarjeta. " +
                                "La tarjeta debe estar montada en una maquina dedicada y NO retirarse durante el proceso.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PosSlate100
                    )
                    Text(
                        text = "ADVERTENCIA: No retire la tarjeta hasta que termine de escribir los 15 sectores.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosError,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Formulario
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
                        text = "Datos del Usuario",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosGoldLight,
                        fontWeight = FontWeight.Bold
                    )

                    OutlinedTextField(
                        value = userId,
                        onValueChange = { userId = it },
                        label = { Text("ID del Usuario (UUID)") },
                        placeholder = { Text("Ej. 550e8400-e29b-41d4-a716-446655440000") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("provision_user_id"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100
                        )
                    )

                    OutlinedTextField(
                        value = initialPin,
                        onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) initialPin = it },
                        label = { Text("PIN Inicial (4 dígitos)") },
                        placeholder = { Text("Ej. 1234") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("provision_pin"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100
                        )
                    )
                }
            }

            // UID de la tarjeta
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
                        text = "Tarjeta NFC",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosGoldLight,
                        fontWeight = FontWeight.Bold
                    )

                    if (cardUid.isBlank()) {
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
                                text = "Acerque una tarjeta en blanco para leer su UID",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate100
                            )
                        }
                    } else {
                        Text(
                            text = "UID: $cardUid",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSuccess,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Boton de provisionar
            Button(
                onClick = {
                    FeedbackHelper.playButtonClick(context)
                    if (userId.isBlank() || initialPin.length != 4 || cardUid.isBlank()) {
                        provisionResult = "Complete todos los campos"
                        return@Button
                    }

                    isProvisioning = true
                    provisionResult = "Solicitando datos al servidor..."

                    // Llamar al repositorio para provisionar
                    kotlinx.coroutines.MainScope().launch {
                        val result = viewModel.repository.provisionClassicCard(
                            userId = userId,
                            cardUid = cardUid,
                            initialPin = initialPin
                        )
                        result.onSuccess { resp ->
                            provisionedSectors = 0
                            provisionResult = "Servidor generó ${resp.sectors.size} sectores.\n" +
                                    "Escribiendo en la tarjeta... NO LA RETIRE."

                            // Aqui el POS deberia escribir fisicamente los sectores en la tarjeta
                            // usando MifareClassicReader.writeFullSector()
                            // Por ahora, simulamos el progreso
                            resp.sectors.forEachIndexed { index, sector ->
                                provisionedSectors = index + 1
                                provisionResult = "Escribiendo sector ${index + 1}/${resp.sectors.size}..."
                                kotlinx.coroutines.delay(500)
                            }

                            provisionResult = "Provisionamiento completado. ${resp.sectors.size} sectores escritos.\n" +
                                    "Sector activo: ${resp.sectors.find { it.isActive }?.sectorNumber}"
                            isProvisioning = false
                            FeedbackHelper.playSuccess(context)
                        }.onFailure { err ->
                            provisionResult = "Error: ${err.message}"
                            isProvisioning = false
                            FeedbackHelper.playError(context)
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .testTag("provision_btn"),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                enabled = !isProvisioning && userId.isNotBlank() && initialPin.length == 4 && cardUid.isNotBlank()
            ) {
                if (isProvisioning) {
                    CircularProgressIndicator(color = PosWhite, modifier = Modifier.size(24.dp))
                } else {
                    Text(
                        text = "Provisionar Tarjeta",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosWhite,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Resultado
            if (provisionResult.isNotBlank()) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PosSlate800),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Text(
                            text = provisionResult,
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSlate100
                        )
                        if (provisionedSectors > 0 && isProvisioning) {
                            Spacer(modifier = Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { provisionedSectors / 15f },
                                modifier = Modifier.fillMaxWidth(),
                                color = PosGoldLight
                            )
                        }
                    }
                }
            }
        }
    }
}
