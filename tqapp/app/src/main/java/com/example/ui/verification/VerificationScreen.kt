package com.example.ui.verification

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DevicesOther
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.repository.VerificationUiState
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenPrimary

/**
 * Element-style device verification dialog (SAS emoji comparison). Works in both
 * directions: this device can ask others to verify it, and it can accept
 * verification requests coming from Element/other Matrix clients.
 */
@Composable
fun VerificationScreen(
    state: VerificationUiState,
    onAcceptRequest: () -> Unit,
    onDeclineRequest: () -> Unit,
    onApproveEmojis: () -> Unit,
    onDeclineEmojis: () -> Unit,
    onCancel: () -> Unit,
    onDismiss: () -> Unit
) {
    // Incoming requests are shown as a non-blocking banner in MainScreen
    // instead of a modal dialog that covers the chat list.
    if (state == VerificationUiState.Idle || state is VerificationUiState.IncomingRequest) return

    Dialog(onDismissRequest = onCancel) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                when (state) {
                    is VerificationUiState.IncomingRequest -> {
                        Icon(
                            imageVector = Icons.Default.DevicesOther,
                            contentDescription = null,
                            tint = WhatsAppGreenPrimary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Solicitud de verificación",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "${state.deviceDisplayName} (${state.deviceId}) quiere verificar este dispositivo. Al verificarlo, podrás leer tus mensajes cifrados en todos tus dispositivos.",
                            fontSize = 13.sp,
                            color = Color(0xFF667781),
                            textAlign = TextAlign.Center,
                            lineHeight = 18.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            TextButton(onClick = onDeclineRequest) {
                                Text("Rechazar", color = Color(0xFFE53935))
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = onAcceptRequest,
                                colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen)
                            ) {
                                Text("Verificar")
                            }
                        }
                    }

                    VerificationUiState.RequestAccepted,
                    VerificationUiState.SasStarted -> {
                        CircularProgressIndicator(color = WhatsAppGreenPrimary, modifier = Modifier.size(40.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Preparando verificación…",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Acepta la solicitud en tu otro dispositivo (Element, etc.) si aún no lo has hecho.",
                            fontSize = 12.sp,
                            color = Color(0xFF667781),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        TextButton(onClick = onCancel) { Text("Cancelar") }
                    }

                    is VerificationUiState.ShowEmojis -> {
                        Icon(
                            imageVector = Icons.Default.VerifiedUser,
                            contentDescription = null,
                            tint = WhatsAppGreenPrimary,
                            modifier = Modifier.size(44.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Compara los emojis",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Confirma que aparecen los mismos emojis en el otro dispositivo, en el mismo orden.",
                            fontSize = 12.sp,
                            color = Color(0xFF667781),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(4),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(((state.emojis.size / 4 + 1) * 56).dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(state.emojis) { (symbol, description) ->
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFF0F5F3)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(text = symbol, fontSize = 20.sp)
                                    }
                                    Text(
                                        text = description,
                                        fontSize = 8.sp,
                                        color = Color(0xFF667781),
                                        maxLines = 1,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = onDeclineEmojis,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("No coinciden", fontSize = 12.sp, color = Color(0xFFE53935))
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = onApproveEmojis,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Coinciden", fontSize = 12.sp)
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        TextButton(onClick = onCancel) { Text("Cancelar") }
                    }

                    VerificationUiState.Verified -> {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = WhatsAppBadgeGreen,
                            modifier = Modifier.size(52.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "¡Dispositivo verificado!",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Este dispositivo ya puede leer y enviar mensajes cifrados de extremo a extremo.",
                            fontSize = 13.sp,
                            color = Color(0xFF667781),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen)
                        ) {
                            Text("Listo")
                        }
                    }

                    VerificationUiState.Cancelled -> {
                        VerificationResultBlock(
                            title = "Verificación cancelada",
                            body = "La verificación se canceló. Puedes intentarlo de nuevo cuando quieras.",
                            onDismiss = onDismiss
                        )
                    }

                    is VerificationUiState.Failed -> {
                        VerificationResultBlock(
                            title = "No se pudo verificar",
                            body = state.message,
                            onDismiss = onDismiss
                        )
                    }

                    VerificationUiState.Idle -> {}
                }
            }
        }
    }
}

@Composable
private fun VerificationResultBlock(title: String, body: String, onDismiss: () -> Unit) {
    Icon(
        imageVector = Icons.Default.Error,
        contentDescription = null,
        tint = Color(0xFFE53935),
        modifier = Modifier.size(48.dp)
    )
    Spacer(modifier = Modifier.height(12.dp))
    Text(
        text = title,
        fontWeight = FontWeight.Bold,
        fontSize = 17.sp,
        color = MaterialTheme.colorScheme.onSurface
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
        text = body,
        fontSize = 13.sp,
        color = Color(0xFF667781),
        textAlign = TextAlign.Center
    )
    Spacer(modifier = Modifier.height(14.dp))
    Button(
        onClick = onDismiss,
        colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary)
    ) {
        Text("Cerrar")
    }
}
