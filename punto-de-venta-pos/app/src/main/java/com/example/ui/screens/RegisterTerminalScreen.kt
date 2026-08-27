package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterTerminalScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val terminalConfig by viewModel.terminalConfig.collectAsState()

    var nodeUrlInput by remember(uiState.serverUrl) { mutableStateOf(uiState.serverUrl) }
    var terminalIdInput by remember(terminalConfig?.terminalId) { mutableStateOf(terminalConfig?.terminalId ?: "TERM-POS-001") }
    var regTokenInput by remember { mutableStateOf("") }

    // Method tab state: 0 = Token, 1 = Emparejamiento rapido
    var selectedMethodTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Registro de Punto de Venta (POS)",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                actions = {
                    if (terminalConfig?.isRegistered == true) {
                        TextButton(
                            onClick = { viewModel.navigateTo(PosScreen.Login) },
                            modifier = Modifier.testTag("goto_login_top_btn")
                        ) {
                            Text("Ir al Login", color = PosPrimaryLight, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = PosPrimaryLight)
                        }
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
            // STATUS BANNER
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (terminalConfig?.isRegistered == true) PosSuccessGreen.copy(alpha = 0.15f) else PosWarningAmber.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (terminalConfig?.isRegistered == true) PosSuccessGreen else PosWarningAmber
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (terminalConfig?.isRegistered == true) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (terminalConfig?.isRegistered == true) PosSuccessGreenLight else PosWarningAmberLight,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = if (terminalConfig?.isRegistered == true) "Terminal Registrado Criptográficamente" else "Terminal Pendiente de Registro",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (terminalConfig?.isRegistered == true) PosSuccessGreenLight else PosWarningAmberLight
                        )
                        Text(
                            text = if (terminalConfig?.isRegistered == true)
                                "El terminal ya cuenta con clave pública del servidor autorizada para transacciones mutuas."
                            else
                                "Para que el punto de venta funcione con datos reales, configure la URL del nodo y complete el registro.",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate200
                        )
                    }
                }
            }

            // ALERTS
            if (uiState.errorMessage != null) {
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
                        Icon(Icons.Default.Error, contentDescription = null, tint = PosErrorRedLight)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = uiState.errorMessage ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosErrorRedLight
                        )
                    }
                }
            }

            if (uiState.successMessage != null) {
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
                        Icon(Icons.Default.Check, contentDescription = null, tint = PosSuccessGreenLight)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = uiState.successMessage ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = PosSuccessGreenLight
                        )
                    }
                }
            }

            // PASO 1: URL DEL SERVIDOR / NODO
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "1. Configurar Servidor / Nodo",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = PosSlate100
                        )
                    }
                    Text(
                        text = "Ingrese la dirección del nodo comunitario o nodo federado donde operará este POS.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    OutlinedTextField(
                        value = nodeUrlInput,
                        onValueChange = { nodeUrlInput = it },
                        label = { Text("URL del Nodo Servidor") },
                        placeholder = { Text("https://feria.loanstly.com/demo") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("reg_node_url_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100
                        )
                    )

                    Card(
                        colors = CardDefaults.cardColors(containerColor = PosSlate800),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Dominio de cabecera federada (X-Node-Domain):", style = MaterialTheme.typography.labelSmall, color = PosSlate300)
                            Text(uiState.nodeDomain, style = MaterialTheme.typography.bodySmall, color = PosPrimaryLight, fontWeight = FontWeight.Bold)
                        }
                    }

                    Button(
                        onClick = {
                            viewModel.updateServerUrl(nodeUrlInput)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("save_node_url_btn"),
                        colors = ButtonDefaults.buttonColors(containerColor = PosSlate700),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Language, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Actualizar y Conectar Nodo")
                    }
                }
            }

            // PASO 2: IDENTIDAD CRIPTOGRÁFICA DEL TERMINAL (PARA EL NODO)
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
                        text = "2. Identidad Criptográfica del Terminal",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                    Text(
                        text = "Estos son los parámetros criptográficos únicos de este hardware. Se utilizan para el protocolo de mutua autenticación Ed25519 + Curve25519 con el nodo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    // Terminal ID
                    OutlinedTextField(
                        value = terminalIdInput,
                        onValueChange = {
                            terminalIdInput = it
                            viewModel.updateTerminalId(it)
                        },
                        label = { Text("ID del Terminal (Identificador)") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("terminal_id_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PosSlate100,
                            unfocusedTextColor = PosSlate100
                        )
                    )

                    // Terminal Ed25519 Public Key
                    Card(
                        colors = CardDefaults.cardColors(containerColor = PosSlate800),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "CLAVE PÚBLICA ED25519 (Hex, 32 bytes):",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PosSlate300,
                                    fontWeight = FontWeight.Bold
                                )
                                IconButton(
                                    onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        val clip = ClipData.newPlainText("Terminal Public Key", terminalConfig?.terminalPublicKeyHex ?: "")
                                        clipboard.setPrimaryClip(clip)
                                        Toast.makeText(context, "Clave pública copiada al portapapeles", Toast.LENGTH_SHORT).show()
                                    },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = "Copiar", tint = PosPrimaryLight, modifier = Modifier.size(16.dp))
                                }
                            }
                            SelectionContainer {
                                Text(
                                    text = terminalConfig?.terminalPublicKeyHex ?: "Generando claves...",
                                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                    color = PosGoldLight,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    // Server Public Key (if registered)
                    if (terminalConfig?.serverPublicKeyHex != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PosSlate800),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "CLAVE PÚBLICA DEL NODO SERVIDOR:",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PosSuccessGreenLight,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = terminalConfig?.serverPublicKeyHex ?: "",
                                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                    color = PosSlate200,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            // PASO 3: COMPLETAR REGISTRO EN EL NODO
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
                        text = "3. Registrar en el Nodo",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )

                    // Method selector tabs
                    TabRow(
                        selectedTabIndex = selectedMethodTab,
                        containerColor = PosSlate800,
                        contentColor = PosSlate100,
                        modifier = Modifier.clip(RoundedCornerShape(12.dp))
                    ) {
                        Tab(
                            selected = (selectedMethodTab == 0),
                            onClick = { selectedMethodTab = 0 },
                            text = { Text("Con Token de Registro", fontWeight = FontWeight.Bold) }
                        )
                        Tab(
                            selected = (selectedMethodTab == 1),
                            onClick = { selectedMethodTab = 1 },
                            text = { Text("Emparejamiento Rápido", fontWeight = FontWeight.Bold) }
                        )
                    }

                    if (selectedMethodTab == 0) {
                        Text(
                            text = "Ingrese el token de registro (UUID) generado en el panel de administración del nodo para este terminal:",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate300
                        )

                        OutlinedTextField(
                            value = regTokenInput,
                            onValueChange = { regTokenInput = it },
                            label = { Text("Token de Registro (UUID)") },
                            placeholder = { Text("ej. 550e8400-e29b-41d4-a716-446655440000") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("reg_token_input"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PosSlate100,
                                unfocusedTextColor = PosSlate100
                            )
                        )

                        Button(
                            onClick = {
                                viewModel.completeRegistrationWithToken(regTokenInput)
                            },
                            enabled = !uiState.isLoading && regTokenInput.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .testTag("complete_registration_btn"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(color = PosSlate100, modifier = Modifier.size(24.dp))
                            } else {
                                Icon(Icons.Default.VpnKey, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Completar Registro con el Nodo", fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        // Emparejamiento por codigo corto (sin credenciales de admin)
                        val pairingCode = uiState.pairingCode
                        val pairingStatus = uiState.pairingStatus
                        val remainingSecs = uiState.pairingRemainingSeconds

                        if (pairingCode == null) {
                            // Estado inicial: boton para iniciar
                            Text(
                                text = "Genere un codigo corto de 6 digitos y pida al administrador que lo apruebe desde su panel web. No necesita credenciales de administrador en este terminal.",
                                style = MaterialTheme.typography.bodySmall,
                                color = PosSlate300
                            )
                            Button(
                                onClick = { viewModel.startPairing() },
                                enabled = !uiState.isLoading,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .testTag("start_pairing_btn"),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                            ) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = PosSlate100, modifier = Modifier.size(24.dp))
                                } else {
                                    Icon(Icons.Default.QrCode, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Iniciar Emparejamiento", fontWeight = FontWeight.Bold)
                                }
                            }
                        } else if (pairingStatus == "pending") {
                            // Mostrar codigo grande + cuenta regresiva
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosSlate800),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        "CODIGO DE EMPAREJAMIENTO",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = PosSlate300
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = pairingCode,
                                        style = MaterialTheme.typography.displayLarge.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        ),
                                        color = PosGoldLight,
                                        fontSize = 56.sp
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    // Cuenta regresiva
                                    val mins = remainingSecs / 60
                                    val secs = remainingSecs % 60
                                    Text(
                                        text = "Tiempo restante: %02d:%02d".format(mins, secs),
                                        style = MaterialTheme.typography.titleMedium,
                                        color = if (remainingSecs <= 10) PosErrorRedLight else PosSlate100,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        text = "Pida al administrador que apruebe este codigo en su panel del nodo.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosSlate300,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(16.dp))
                                    OutlinedButton(
                                        onClick = { viewModel.cancelPairing() },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                                    ) {
                                        Text("Cancelar Emparejamiento")
                                    }
                                }
                            }
                        } else if (pairingStatus == "expired") {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.15f)),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(
                                        Icons.Default.Timer,
                                        contentDescription = null,
                                        tint = PosErrorRedLight,
                                        modifier = Modifier.size(48.dp)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        "Tiempo Agotado",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = PosErrorRedLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        "El codigo expiro. Genere uno nuevo.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosSlate300
                                    )
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Button(
                                        onClick = { viewModel.startPairing() },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                                    ) {
                                        Text("Reintentar", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        } else if (pairingStatus == "rejected") {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.15f)),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(
                                        Icons.Default.Block,
                                        contentDescription = null,
                                        tint = PosErrorRedLight,
                                        modifier = Modifier.size(48.dp)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        "Solicitud Rechazada",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = PosErrorRedLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        "El administrador rechazo la solicitud.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosSlate300
                                    )
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Button(
                                        onClick = { viewModel.startPairing() },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                                    ) {
                                        Text("Reintentar", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // BUTTON TO GO TO LOGIN OR RESET
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        viewModel.resetTerminalRegistration()
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                        .testTag("reset_registration_btn"),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Reiniciar Claves", fontSize = 13.sp)
                }

                Button(
                    onClick = {
                        viewModel.navigateTo(PosScreen.Login)
                    },
                    modifier = Modifier
                        .weight(1.3f)
                        .height(48.dp)
                        .testTag("go_to_login_btn"),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                ) {
                    Text("Iniciar Sesión Comercio", color = PosNavyDark, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = PosNavyDark, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}
