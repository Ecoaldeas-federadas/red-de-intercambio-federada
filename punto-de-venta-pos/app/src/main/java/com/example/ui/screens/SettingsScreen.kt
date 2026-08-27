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
    var urlInput by remember(uiState.serverUrl) { mutableStateOf(uiState.serverUrl) }

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
                        onClick = { viewModel.navigateTo(PosScreen.Dashboard) },
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
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Servidor / Nodo de Trueque",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Ingrese la URL completa del nodo de la comunidad o nodo de demostración.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = { urlInput = it },
                        label = { Text("URL del Servidor") },
                        placeholder = { Text("https://feria.loanstly.com/demo") },
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
                            viewModel.updateServerUrl(urlInput)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("save_server_url_btn"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                    ) {
                        Icon(imageVector = Icons.Default.Save, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Guardar y Conectar con el Nodo", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // TERMINAL REGISTRATION LINK
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
                        text = "Identidad y Registro Criptográfico (Ed25519)",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Vincule o registre este terminal de punto de venta con las claves criptográficas autorizadas en el nodo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    Button(
                        onClick = { viewModel.navigateTo(PosScreen.RegisterTerminal) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("settings_goto_registration_btn"),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosGold)
                    ) {
                        Icon(Icons.Default.VpnKey, contentDescription = null, tint = PosNavyDark)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Ver Claves y Registro del Terminal", color = PosNavyDark, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // FEEDBACK SOUND & HAPTIC TEST
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
                        text = "Prueba de Sonido y Vibración Kiosco",
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Verifique la respuesta sonora y háptica del terminal de punto de venta.",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { FeedbackHelper.playCardDetected(viewModel.getApplication()) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Bip Tarjeta", fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playSuccess(viewModel.getApplication()) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosSuccessGreenLight)
                        ) {
                            Text("Bip Éxito", fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { FeedbackHelper.playError(viewModel.getApplication()) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PosErrorRedLight)
                        ) {
                            Text("Bip Error", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
