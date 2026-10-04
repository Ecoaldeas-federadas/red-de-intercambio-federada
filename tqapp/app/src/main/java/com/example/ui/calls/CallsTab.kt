package com.example.ui.calls

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallMissed
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.local.CallEntity
import com.example.ui.ActiveCallInfo
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun CallsTab(
    calls: List<CallEntity>,
    onStartCall: (String, Boolean) -> Unit,
    onNewCallClick: () -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 80.dp)
        ) {
            // "Crear enlace de llamada" Item
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNewCallClick() }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .clip(CircleShape)
                            .background(WhatsAppBadgeGreen),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Link,
                            contentDescription = "Enlace de llamada",
                            tint = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Crear enlace de llamada",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Comparte un enlace para tu llamada Matrix",
                            fontSize = 13.sp,
                            color = Color(0xFF667781)
                        )
                    }
                }
            }

            // Recientes Header
            item {
                Text(
                    text = "RECIENTES",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF667781),
                    modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp)
                )
            }

            // Call history items
            if (calls.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "No hay llamadas recientes",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF667781)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Para llamar a contactos en Matrix, pulsa el botón de llamada abajo.",
                            fontSize = 13.sp,
                            color = Color(0xFF8696A0),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                items(calls, key = { it.id }) { call ->
                    CallHistoryItem(
                        call = call,
                        onCallback = {
                            val roomId = call.roomId
                            if (roomId != null) {
                                onStartCall(roomId, call.callType == "VIDEO")
                            } else {
                                android.widget.Toast.makeText(
                                    context,
                                    "Esta llamada es de antes de esta versión, no se puede volver a llamar directamente",
                                    android.widget.Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    )
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 76.dp),
                        color = DividerDefaults.color.copy(alpha = 0.2f)
                    )
                }
            }
        }

        // FAB to start call
        FloatingActionButton(
            onClick = onNewCallClick,
            containerColor = WhatsAppBadgeGreen,
            contentColor = Color.White,
            shape = CircleShape,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
                .testTag("fab_new_call")
        ) {
            Icon(imageVector = Icons.Default.Call, contentDescription = "Nueva llamada")
        }
    }
}

@Composable
fun CallHistoryItem(
    call: CallEntity,
    onCallback: () -> Unit
) {
    val timeFormatter = remember { SimpleDateFormat("dd MMMM, HH:mm", Locale("es", "ES")) }
    val formattedTime = remember(call.timestamp) { timeFormatter.format(Date(call.timestamp)) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCallback() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WhatsAppAvatar(name = call.contactName, size = 50.dp)

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = call.contactName,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (call.direction == "MISSED") Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(3.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                val (icon, tint) = when (call.direction) {
                    "INCOMING" -> Icons.AutoMirrored.Filled.CallReceived to WhatsAppBadgeGreen
                    "OUTGOING" -> Icons.AutoMirrored.Filled.CallMade to WhatsAppBadgeGreen
                    else -> Icons.AutoMirrored.Filled.CallMissed to Color(0xFFE53935)
                }

                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = tint,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = formattedTime,
                    fontSize = 13.sp,
                    color = Color(0xFF667781)
                )
            }
        }

        IconButton(onClick = onCallback) {
            Icon(
                imageVector = if (call.callType == "VIDEO") Icons.Default.Videocam else Icons.Default.Call,
                contentDescription = "Llamar",
                tint = WhatsAppGreenPrimary
            )
        }
    }
}

@Composable
fun ActiveCallScreen(
    callInfo: ActiveCallInfo,
    onEndCall: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleSpeaker: () -> Unit
) {
    val durationText = remember(callInfo.durationSeconds) {
        val m = callInfo.durationSeconds / 60
        val s = callInfo.durationSeconds % 60
        String.format("%02d:%02d", m, s)
    }

    Dialog(
        onDismissRequest = onEndCall,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0F1A1C))
                .padding(24.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Info
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 48.dp)
                ) {
                    Text(
                        text = callInfo.contactName,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (callInfo.durationSeconds == 0) "Conectando llamada Matrix..." else durationText,
                        fontSize = 15.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    WhatsAppAvatar(
                        name = callInfo.contactName,
                        size = 110.dp,
                        backgroundColor = WhatsAppGreenDark
                    )
                }

                // Bottom Call Controls
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(bottom = 32.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Speaker Toggle
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(if (callInfo.isSpeakerOn) Color.White else Color.White.copy(alpha = 0.2f))
                                .clickable { onToggleSpeaker() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.VolumeUp,
                                contentDescription = "Altavoz",
                                tint = if (callInfo.isSpeakerOn) Color.Black else Color.White
                            )
                        }

                        // Video Toggle
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(if (callInfo.isVideo) Color.White else Color.White.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Videocam,
                                contentDescription = "Video",
                                tint = if (callInfo.isVideo) Color.Black else Color.White
                            )
                        }

                        // Mute Toggle
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(if (callInfo.isMuted) Color.White else Color.White.copy(alpha = 0.2f))
                                .clickable { onToggleMute() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (callInfo.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                                contentDescription = "Silenciar",
                                tint = if (callInfo.isMuted) Color.Black else Color.White
                            )
                        }

                        // Red Hang-up Button
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFE53935))
                                .clickable { onEndCall() }
                                .testTag("btn_end_call"),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CallEnd,
                                contentDescription = "Colgar",
                                tint = Color.White,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
