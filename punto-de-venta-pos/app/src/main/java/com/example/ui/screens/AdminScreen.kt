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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val terminalConfig by viewModel.terminalConfig.collectAsState()

    var regTokenInput by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Administración de Terminal",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
                        modifier = Modifier.testTag("admin_back_btn")
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
            // TERMINAL ED25519 IDENTITY CARD
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ESTADO CRIPTOGRÁFICO",
                            style = MaterialTheme.typography.labelSmall,
                            color = PosSlate300,
                            letterSpacing = 1.sp
                        )
                        AssistChip(
                            onClick = {},
                            label = {
                                Text(
                                    text = if (terminalConfig?.isRegistered == true) "Registrado Ed25519" else "Pendiente de Registro",
                                    color = if (terminalConfig?.isRegistered == true) PosSuccessGreenLight else PosWarningAmberLight,
                                    fontWeight = FontWeight.Bold
                                )
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (terminalConfig?.isRegistered == true) PosSuccessGreen.copy(alpha = 0.15f) else PosWarningAmber.copy(alpha = 0.15f)
                            )
                        )
                    }

                    Text(
                        text = "Terminal ID: ${terminalConfig?.terminalId ?: "TERM-POS-001"}",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )

                    Column {
                        Text("Clave Pública Ed25519 (Terminal):", style = MaterialTheme.typography.labelSmall, color = PosSlate300)
                        Text(
                            text = terminalConfig?.terminalPublicKeyHex?.take(32)?.plus("...") ?: "Generando...",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosPrimaryLight
                        )
                    }

                    Column {
                        Text("Clave Pública del Servidor:", style = MaterialTheme.typography.labelSmall, color = PosSlate300)
                        Text(
                            text = terminalConfig?.serverPublicKeyHex?.take(32)?.plus("...") ?: "(Se sincroniza al completar registro)",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosSlate300
                        )
                    }
                }
            }

            // REGISTRATION TOKEN INPUT
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
                        text = "Completar Registro con el Nodo",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Ingrese el token de registro emitido en el panel de administración web del nodo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    OutlinedTextField(
                        value = regTokenInput,
                        onValueChange = { regTokenInput = it },
                        label = { Text("Registration Token (UUID)") },
                        placeholder = { Text("Ej. 550e8400-e29b-41d4-a716-446655440000") },
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
                        enabled = regTokenInput.isNotBlank(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("submit_reg_token_btn"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                    ) {
                        Icon(imageVector = Icons.Default.VpnKey, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Registrar Criptográficamente", fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = {
                            viewModel.navigateTo(PosScreen.RegisterTerminal)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_goto_register_screen_btn"),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PosGoldLight)
                    ) {
                        Icon(Icons.Default.Security, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Abrir Asistente de Registro Completo")
                    }
                }
            }

            // NODE CARD TYPE CONFIGURATION STATUS
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
                    Text(
                        text = "Configuración de Tarjetas del Nodo",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )

                    val cfg = uiState.cardTypeConfig
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Modo de Tarjetas:", color = PosSlate300)
                        Text((cfg?.cardTypeMode ?: "dual").uppercase(), color = PosPrimaryLight, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Requiere Criptografía DESFire:", color = PosSlate300)
                        Text(if (cfg?.requireCrypto == true) "SÍ (Estricto)" else "NO (Acepta UID)", color = PosSlate100)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Verificación ID para UID:", color = PosSlate300)
                        Text(if (cfg?.requireIdDocumentForUidOnly == true) "ACTIVADA (Requerida)" else "DESACTIVADA", color = if (cfg?.requireIdDocumentForUidOnly == true) PosGoldLight else PosSlate300, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Rotación Automática de Claves:", color = PosSlate300)
                        Text(if (cfg?.autoRotateKey == true) "ACTIVADA" else "DESACTIVADA", color = PosSlate100)
                    }
                }
            }
        }
    }
}
