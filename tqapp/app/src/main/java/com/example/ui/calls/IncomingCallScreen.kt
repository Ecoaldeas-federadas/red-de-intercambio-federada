package com.example.ui.calls

import android.media.RingtoneManager
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.repository.MatrixRepository

private val WhatsAppDarkGreen = Color(0xFF0B141A)
private val WhatsAppGreen = Color(0xFF00A884)
private val DeclineRed = Color(0xFFEA0038)

/** Full-screen incoming call UI styled like WhatsApp: dark green backdrop,
 * caller avatar/name centered, red decline and green answer actions, and the
 * system ringtone playing while it rings. */
@Composable
fun IncomingCallScreen(
    incoming: MatrixRepository.IncomingCallInfo,
    onAnswer: () -> Unit,
    onDecline: () -> Unit
) {
    val context = LocalContext.current

    // Play the default system ringtone while the incoming call is shown.
    DisposableEffect(Unit) {
        val ringtone = try {
            RingtoneManager.getRingtone(
                context,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            )?.apply {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    isLooping = true
                }
                play()
            }
        } catch (_: Exception) {
            null
        }
        onDispose { try { ringtone?.stop() } catch (_: Exception) {} }
    }

    Dialog(
        onDismissRequest = onDecline,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(WhatsAppDarkGreen)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(80.dp))

            Box(
                modifier = Modifier
                    .size(120.dp)
                    .background(WhatsAppGreen.copy(alpha = 0.25f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = incoming.callerName.firstOrNull()?.uppercase() ?: "?",
                    color = Color.White,
                    fontSize = 48.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Text(
                incoming.callerName,
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (incoming.isVideo) "Videollamada entrante" else "Llamada de voz entrante",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 16.sp
            )
            if (!incoming.isDirect) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    incoming.roomName,
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 48.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    IconButton(
                        onClick = onDecline,
                        modifier = Modifier
                            .size(72.dp)
                            .background(DeclineRed, CircleShape)
                    ) {
                        Icon(
                            Icons.Default.CallEnd,
                            contentDescription = "Rechazar",
                            tint = Color.White,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Rechazar", color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    IconButton(
                        onClick = onAnswer,
                        modifier = Modifier
                            .size(72.dp)
                            .background(WhatsAppGreen, CircleShape)
                    ) {
                        Icon(
                            if (incoming.isVideo) Icons.Default.Videocam else Icons.Default.Call,
                            contentDescription = "Contestar",
                            tint = Color.White,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Contestar", color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
                }
            }
        }
    }
}
