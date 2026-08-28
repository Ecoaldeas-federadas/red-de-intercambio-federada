package com.example.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val terminalConfig by viewModel.terminalConfig.collectAsState()
    var urlInput by remember(uiState.serverUrl) { mutableStateOf(uiState.serverUrl) }
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Configuración del Nodo",
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
                        modifier = Modifier.testTag("settings_back_btn")
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
            // ALERTS
            if (!uiState.successMessage.isNullOrBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosSuccessGreen.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosSuccessGreen)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = PosSuccessGreenLight)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.successMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            if (!uiState.errorMessage.isNullOrBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosErrorRed)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(imageVector = Icons.Default.Error, contentDescription = null, tint = PosErrorRedLight)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = uiState.errorMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            // SERVER URL CONFIGURATION
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Servidor / Modo de Operación",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (uiState.isDemoNode) PosGold.copy(alpha = 0.2f) else PosPrimaryBlue.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (uiState.isDemoNode) PosGold else PosPrimaryLight
                            )
                        ) {
                            Text(
                                text = if (uiState.isDemoNode) "MODO DEMO" else "PRODUCCIÓN",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = if (uiState.isDemoNode) PosGoldLight else PosPrimaryLight,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Text(
                        text = "Seleccione el modo de operación rápido o escriba la URL personalizada del nodo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    // PRESET SHORTCUT BUTTONS
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                urlInput = "https://feria.loanstly.com/main"
                                viewModel.updateServerUrl("https://feria.loanstly.com/main")
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (!uiState.isDemoNode && urlInput.contains("/main")) PosPrimaryBlue.copy(alpha = 0.2f) else androidx.compose.ui.graphics.Color.Transparent,
                                contentColor = PosSlate100
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (!uiState.isDemoNode && urlInput.contains("/main")) PosPrimaryLight else PosSlate700
                            )
                        ) {
                            Icon(Icons.Default.CloudQueue, contentDescription = null, modifier = Modifier.size(16.dp), tint = PosPrimaryLight)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Modo Main", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                urlInput = "https://feria.loanstly.com/demo"
                                viewModel.updateServerUrl("https://feria.loanstly.com/demo")
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (uiState.isDemoNode || urlInput.contains("/demo")) PosGold.copy(alpha = 0.2f) else androidx.compose.ui.graphics.Color.Transparent,
                                contentColor = PosSlate100
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (uiState.isDemoNode || urlInput.contains("/demo")) PosGold else PosSlate700
                            )
                        ) {
                            Icon(Icons.Default.Science, contentDescription = null, modifier = Modifier.size(16.dp), tint = PosGoldLight)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Modo Demo", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = { urlInput = it },
                        label = { Text("URL del Servidor / Nodo") },
                        placeholder = { Text("https://feria.loanstly.com/main o /demo") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("server_url_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100
                        )
                    )

                    // Node domain preview
                    Card(
                        colors = CardDefaults.cardColors(containerColor = PosSlate800),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Dominio de cabecera (X-Node-Domain):", style = MaterialTheme.typography.labelSmall, color = PosSlate300)
                            Text(uiState.nodeDomain, style = MaterialTheme.typography.bodySmall, color = PosPrimaryLight, fontWeight = FontWeight.Bold)
                        }
                    }

                    Button(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.updateServerUrl(urlInput)
                        },
                        enabled = !uiState.isLoading && urlInput.isNotBlank(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("save_server_url_btn"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(color = PosSlate100, modifier = Modifier.size(22.dp))
                        } else {
                            Icon(imageVector = Icons.Default.Save, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Guardar y Conectar con el Nodo", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // TERMINAL IDENTITY & SHIFT MANAGEMENT
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Gestión del Terminal y Turno",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )

                    if (terminalConfig?.isRegistered == true) {
                        // Estado registrado
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PosSuccessGreen.copy(alpha = 0.12f)),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosSuccessGreen.copy(alpha = 0.5f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PosSuccessGreenLight, modifier = Modifier.size(28.dp))
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text("Terminal Vinculado y Autorizado", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = PosSuccessGreenLight)
                                    Text("ID: ${terminalConfig?.terminalId}", style = MaterialTheme.typography.bodySmall, color = PosSlate300)
                                }
                            }
                        }
                    } else {
                        // No registrado aún
                        Text(
                            text = "Vincule este terminal con el nodo mediante emparejamiento para habilitar transacciones.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate300
                        )

                        Button(
                            onClick = {
                                FeedbackHelper.playButtonClick(context)
                                viewModel.navigateTo(PosScreen.RegisterTerminal)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("settings_goto_registration_btn"),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                        ) {
                            Icon(Icons.Default.VpnKey, contentDescription = null, tint = PosNavyDark)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Emparejar y Registrar Terminal", color = PosNavyDark, fontWeight = FontWeight.Bold)
                        }
                    }

                    // ABRIR/CERRAR PUNTO - protegido con PIN
                    Button(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.navigateTo(PosScreen.ShiftManagement)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("settings_shift_mgmt_btn"),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                    ) {
                        Icon(Icons.Default.PointOfSale, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Abrir / Cerrar Punto", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // FORMAT SETTINGS (received from server, read-only display)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Ajustes de Formato",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            imageVector = Icons.Default.Language,
                            contentDescription = null,
                            tint = PosPrimaryLight,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Text(
                        text = "Estos ajustes se sincronizan con el servidor.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    val cfg = terminalConfig
                    val fmtRow: @Composable (String, String) -> Unit = { label, value ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate300
                            )
                            Text(
                                text = value,
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosSlate100,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    fmtRow("Idioma (locale):", cfg?.fmtLocale ?: "es")
                    fmtRow("Formato numérico:", cfg?.fmtNumberLocale ?: "es-VE")
                    fmtRow("Formato de fecha:", cfg?.fmtDateFormat ?: "DD/MM/YYYY")
                    fmtRow("Formato de hora:", cfg?.fmtTimeFormat ?: "24h")
                    fmtRow("Primer día de la semana:", when (cfg?.fmtFirstDayOfWeek ?: 1) {
                        0 -> "Domingo"
                        1 -> "Lunes"
                        6 -> "Sábado"
                        else -> (cfg?.fmtFirstDayOfWeek ?: 1).toString()
                    })
                    fmtRow("Zona horaria:", cfg?.fmtTimezone ?: "America/Caracas")
                }
            }

            // FEEDBACK SOUND & HAPTIC CONFIGURATION & TEST
            var soundOn by remember { mutableStateOf(FeedbackHelper.isSoundEnabled) }
            var soundVol by remember { mutableFloatStateOf(FeedbackHelper.soundVolume.toFloat()) }
            var vibOn by remember { mutableStateOf(FeedbackHelper.isVibrationEnabled) }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "Sonido y Vibración del Terminal",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Configure el volumen y la retroalimentación sonora para las teclas numéricas, botones de navegación y transacciones.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    // Sound Toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Icon(
                                imageVector = if (soundOn && soundVol > 0) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                                contentDescription = null,
                                tint = if (soundOn && soundVol > 0) PosPrimaryLight else PosSlate600
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Sonido al presionar botones", style = MaterialTheme.typography.bodyMedium, color = PosSlate100, fontWeight = FontWeight.SemiBold)
                                Text("Emite tonos en teclado numérico y botones generales", style = MaterialTheme.typography.bodySmall, color = PosSlate400)
                            }
                        }
                        Switch(
                            checked = soundOn,
                            onCheckedChange = {
                                soundOn = it
                                FeedbackHelper.setSoundEnabled(context, it)
                                if (it) FeedbackHelper.playKeyClick(context)
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = PosPrimaryBlue,
                                checkedTrackColor = PosPrimaryBlue.copy(alpha = 0.5f)
                            )
                        )
                    }

                    // Volume Slider (Enabled if sound is ON)
                    if (soundOn) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        imageVector = when {
                                            soundVol <= 0f -> Icons.Default.VolumeMute
                                            soundVol < 50f -> Icons.Default.VolumeDown
                                            else -> Icons.Default.VolumeUp
                                        },
                                        contentDescription = null,
                                        tint = PosPrimaryLight,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Text(
                                        text = "Volumen del teclado y alertas",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosSlate200,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                Text(
                                    text = "${soundVol.toInt()}%",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosPrimaryLight,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Slider(
                                value = soundVol,
                                onValueChange = { newVal ->
                                    soundVol = newVal
                                    FeedbackHelper.setSoundVolume(context, newVal.toInt())
                                },
                                onValueChangeFinished = {
                                    FeedbackHelper.playKeyClick(context)
                                },
                                valueRange = 0f..100f,
                                steps = 19,
                                colors = SliderDefaults.colors(
                                    thumbColor = PosPrimaryLight,
                                    activeTrackColor = PosPrimaryBlue,
                                    inactiveTrackColor = PosSlate700
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    HorizontalDivider(color = PosSlate800)

                    // Vibration Toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Icon(
                                imageVector = if (vibOn) Icons.Default.Vibration else Icons.Default.Smartphone,
                                contentDescription = null,
                                tint = if (vibOn) PosGoldLight else PosSlate600
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Vibración háptica al presionar", style = MaterialTheme.typography.bodyMedium, color = PosSlate100, fontWeight = FontWeight.SemiBold)
                                Text("Vibra suavemente al tocar teclas y botones", style = MaterialTheme.typography.bodySmall, color = PosSlate400)
                            }
                        }
                        Switch(
                            checked = vibOn,
                            onCheckedChange = {
                                vibOn = it
                                FeedbackHelper.setVibrationEnabled(context, it)
                                if (it) FeedbackHelper.playKeyClick(context)
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = PosGold,
                                checkedTrackColor = PosGold.copy(alpha = 0.5f)
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Probar Sonidos y Vibraciones del Sistema:", style = MaterialTheme.typography.labelMedium, color = PosSlate300, fontWeight = FontWeight.Bold)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { FeedbackHelper.playKeyClick(context) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Clic Teclado", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playButtonClick(context) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosPrimaryLight)
                        ) {
                            Text("Clic Botón", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playCardDetected(context) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Bip Tarjeta", fontSize = 11.sp)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { FeedbackHelper.playCardScanError(context) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
                        ) {
                            Text("Error Tarjeta", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playPaymentApprovedCoins(context) },
                            modifier = Modifier.weight(1.2f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSuccessGreenLight)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp), tint = PosSuccessGreenLight)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Pago (Monedas)", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playPaymentError(context) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                        ) {
                            Icon(Icons.Default.Error, contentDescription = null, modifier = Modifier.size(14.dp), tint = PosErrorRedLight)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Error Pago", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
