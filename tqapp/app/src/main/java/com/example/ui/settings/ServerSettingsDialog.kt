package com.example.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.model.UserSessionEntity
import com.example.data.repository.MatrixRepository
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import org.matrix.rustcomponents.sdk.BackupState
import org.matrix.rustcomponents.sdk.VerificationState

@Composable
fun ServerSettingsDialog(
    session: UserSessionEntity?,
    deviceVerification: VerificationState = VerificationState.UNKNOWN,
    backupState: BackupState = BackupState.UNKNOWN,
    notificationPrefs: MatrixRepository.NotificationPrefs? = null,
    ignoredUsers: List<String> = emptyList(),
    sessionKeys: Pair<String?, String?> = null to null,
    sendTypingEnabled: Boolean = true,
    sendReadReceiptsEnabled: Boolean = true,
    enterToSend: Boolean = false,
    onDismiss: () -> Unit,
    onLogout: () -> Unit,
    onUpdateDisplayName: ((String) -> Unit)? = null,
    onUpdateAvatarUrl: ((String) -> Unit)? = null,
    onUploadAvatar: ((android.net.Uri) -> Unit)? = null,
    onNotificationPrefsChange: ((MatrixRepository.NotificationPrefs) -> Unit)? = null,
    onUnignoreUser: ((String) -> Unit)? = null,
    onToggleTyping: ((Boolean) -> Unit)? = null,
    onToggleReceipts: ((Boolean) -> Unit)? = null,
    onToggleEnterToSend: ((Boolean) -> Unit)? = null,
    onClearCache: (((Boolean) -> Unit) -> Unit)? = null,
    onAccountManagement: ((Boolean, (String?) -> Unit) -> Unit)? = null,
    onStartVerification: (() -> Unit)? = null,
    onEnableBackup: (() -> Unit)? = null,
    onRestoreKey: ((String) -> Unit)? = null,
    onResetRecoveryKey: (((String?) -> Unit) -> Unit)? = null
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Cuenta", "Notificaciones", "Seguridad", "Preferencias", "Avanzado")

    var editName by remember(session?.displayName) { mutableStateOf(session?.displayName ?: "") }
    var editAvatar by remember(session?.avatarUrl) { mutableStateOf(session?.avatarUrl ?: "") }
    var isEditingProfile by remember { mutableStateOf(false) }

    var recoveryKeyInput by remember { mutableStateOf("") }
    var generatedRecoveryKey by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Header Profile Summary
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    WhatsAppAvatar(
                        name = session?.displayName ?: "Usuario",
                        avatarUrl = session?.avatarUrl,
                        size = 58.dp,
                        backgroundColor = WhatsAppGreenDark
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = session?.displayName ?: "Usuario Matrix",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = session?.userId ?: "@anonimo:matrix.org",
                            fontSize = 12.sp,
                            color = Color(0xFF667781)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Tabs Navigation
                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    edgePadding = 0.dp,
                    containerColor = Color.Transparent,
                    contentColor = WhatsAppGreenPrimary,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Text(
                                    text = title,
                                    fontSize = 13.sp,
                                    fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Tab Content
                when (selectedTab) {
                    0 -> {
                        // Perfil y Cuenta
                        Column(modifier = Modifier.fillMaxWidth()) {
                            if (!isEditingProfile) {
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(14.dp)) {
                                        Text(
                                            text = "Nombre mostrado:",
                                            fontSize = 12.sp,
                                            color = Color(0xFF667781)
                                        )
                                        Text(
                                            text = session?.displayName ?: "No asignado",
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color(0xFF111B21)
                                        )

                                        Spacer(modifier = Modifier.height(8.dp))

                                        Text(
                                            text = "Matrix ID (MXID):",
                                            fontSize = 12.sp,
                                            color = Color(0xFF667781)
                                        )
                                        Text(
                                            text = session?.userId ?: "",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF111B21)
                                        )

                                        Spacer(modifier = Modifier.height(8.dp))

                                        Text(
                                            text = "Foto de perfil (URL/MXC):",
                                            fontSize = 12.sp,
                                            color = Color(0xFF667781)
                                        )
                                        Text(
                                            text = session?.avatarUrl?.ifBlank { "Sin foto configurada" } ?: "Sin foto configurada",
                                            fontSize = 12.sp,
                                            color = Color(0xFF667781),
                                            maxLines = 1
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Button(
                                    onClick = { isEditingProfile = true },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("btn_edit_profile"),
                                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Cambiar Nombre y Foto")
                                }
                                // Foto de perfil real — sube bytes al
                                // homeserver via Client.uploadAvatar
                                val avatarPicker = rememberLauncherForActivityResult(
                                    ActivityResultContracts.GetContent()
                                ) { uri -> if (uri != null) onUploadAvatar?.invoke(uri) }
                                Spacer(modifier = Modifier.height(10.dp))
                                OutlinedButton(
                                    onClick = { avatarPicker.launch("image/*") },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Subir foto de perfil")
                                }

                                // Gestión de cuenta del homeserver (MSC2965):
                                // el SDK resuelve la URL de account management;
                                // en servidores sin soporte devuelve null.
                                val acctCtx = LocalContext.current
                                var mgmtUnavailable by remember { mutableStateOf(false) }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = {
                                        onAccountManagement?.invoke(false) { url ->
                                            if (url != null) {
                                                acctCtx.startActivity(
                                                    android.content.Intent(
                                                        android.content.Intent.ACTION_VIEW,
                                                        android.net.Uri.parse(url)
                                                    )
                                                )
                                            } else {
                                                mgmtUnavailable = true
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Public, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Gestionar cuenta (web)")
                                }
                                if (mgmtUnavailable) {
                                    Text(
                                        text = "Tu homeserver no expone gestión de cuenta web",
                                        fontSize = 11.sp,
                                        color = Color(0xFF667781),
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }

                                // Borrar caché local del SDK (media/eventos)
                                var cacheCleared by remember { mutableStateOf(false) }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = {
                                        onClearCache?.invoke { ok -> cacheCleared = ok }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text(if (cacheCleared) "✓ Caché borrada" else "Borrar caché de medios")
                                }
                            } else {
                                OutlinedTextField(
                                    value = editName,
                                    onValueChange = { editName = it },
                                    label = { Text("Nombre mostrado") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = editAvatar,
                                    onValueChange = { editAvatar = it },
                                    label = { Text("URL o MXC de foto") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    TextButton(onClick = { isEditingProfile = false }) {
                                        Text("Cancelar")
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Button(
                                        onClick = {
                                            if (editName.isNotBlank()) onUpdateDisplayName?.invoke(editName)
                                            if (editAvatar.isNotBlank()) onUpdateAvatarUrl?.invoke(editAvatar)
                                            isEditingProfile = false
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen)
                                    ) {
                                        Text("Guardar")
                                    }
                                }
                            }
                        }
                    }

                    1 -> {
                        // Notificaciones — push rules reales del homeserver
                        // (NotificationSettings del SDK, igual que Element X).
                        Column(modifier = Modifier.fillMaxWidth()) {
                            val prefs = notificationPrefs
                            if (prefs == null) {
                                Text(
                                    text = "Cargando ajustes de notificaciones…",
                                    fontSize = 13.sp,
                                    color = Color(0xFF667781)
                                )
                            } else {
                                SettingsToggleRow(
                                    title = "Menciones a mí (@usuario)",
                                    subtitle = "Notificar cuando alguien me mencione",
                                    checked = prefs.userMentions
                                ) {
                                    onNotificationPrefsChange?.invoke(prefs.copy(userMentions = it))
                                }
                                SettingsToggleRow(
                                    title = "Menciones de sala (@room)",
                                    subtitle = "Notificar @room / @everyone en grupos",
                                    checked = prefs.roomMentions
                                ) {
                                    onNotificationPrefsChange?.invoke(prefs.copy(roomMentions = it))
                                }
                                SettingsToggleRow(
                                    title = "Invitaciones a salas",
                                    subtitle = "Notificar cuando me inviten a una sala",
                                    checked = prefs.invites
                                ) {
                                    onNotificationPrefsChange?.invoke(prefs.copy(invites = it))
                                }
                                SettingsToggleRow(
                                    title = "Llamadas",
                                    subtitle = "Notificar llamadas entrantes",
                                    checked = prefs.calls
                                ) {
                                    onNotificationPrefsChange?.invoke(prefs.copy(calls = it))
                                }
                                Text(
                                    text = "Para silenciar un chat concreto: abre su información y usa \"Notificaciones\".",
                                    fontSize = 11.sp,
                                    color = Color(0xFF667781),
                                    modifier = Modifier.padding(top = 10.dp)
                                )
                            }
                        }
                    }

                    2 -> {
                        // Seguridad y E2EE (real, via Matrix Rust SDK)
                        Column(modifier = Modifier.fillMaxWidth()) {
                            // Device verification status
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Security,
                                            contentDescription = null,
                                            tint = if (deviceVerification == VerificationState.VERIFIED) WhatsAppBadgeGreen else Color(0xFFE53935),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Verificación del dispositivo:",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFF111B21)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = when (deviceVerification) {
                                            VerificationState.VERIFIED -> "✓ Este dispositivo está verificado. Puede leer mensajes cifrados."
                                            VerificationState.UNVERIFIED -> "⚠ Dispositivo sin verificar. Los mensajes cifrados antiguos pueden no descifrarse."
                                            else -> "Comprobando estado de verificación…"
                                        },
                                        fontSize = 12.sp,
                                        color = if (deviceVerification == VerificationState.VERIFIED) WhatsAppBadgeGreen else Color(0xFF667781),
                                        lineHeight = 16.sp
                                    )
                                    if (deviceVerification != VerificationState.VERIFIED && onStartVerification != null) {
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Button(
                                            onClick = onStartVerification,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .testTag("btn_verify_device"),
                                            colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen),
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Text("Verificar este dispositivo", fontSize = 13.sp)
                                        }
                                        Text(
                                            text = "Se enviará una solicitud a tus otros dispositivos (Element, etc.) para comparar emojis.",
                                            fontSize = 11.sp,
                                            color = Color(0xFF667781),
                                            lineHeight = 14.sp,
                                            modifier = Modifier.padding(top = 6.dp)
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Key backup state
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.VpnKey,
                                            contentDescription = null,
                                            tint = WhatsAppGreenPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Respaldo de claves E2EE:",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFF111B21)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = when (backupState) {
                                            BackupState.ENABLED -> "✓ Respaldo activo en el servidor"
                                            BackupState.CREATING, BackupState.ENABLING, BackupState.RESUMING -> "Activando respaldo…"
                                            BackupState.DOWNLOADING -> "Descargando claves del servidor…"
                                            BackupState.DISABLING -> "Desactivando respaldo…"
                                            else -> "Estado del respaldo desconocido"
                                        },
                                        fontSize = 12.sp,
                                        color = if (backupState == BackupState.ENABLED) WhatsAppBadgeGreen else Color(0xFF667781)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "El respaldo guarda tus claves de cifrado en el servidor para recuperar mensajes en otros dispositivos.",
                                        fontSize = 11.sp,
                                        color = Color(0xFF667781),
                                        lineHeight = 14.sp
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(modifier = Modifier.fillMaxWidth()) {
                                OutlinedButton(
                                    onClick = { onEnableBackup?.invoke() },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Respaldar", fontSize = 12.sp)
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                OutlinedButton(
                                    onClick = {
                                        onResetRecoveryKey?.invoke { key -> generatedRecoveryKey = key }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Nueva clave", fontSize = 12.sp)
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Restore with recovery key
                            OutlinedTextField(
                                value = recoveryKeyInput,
                                onValueChange = { recoveryKeyInput = it },
                                label = { Text("Clave de recuperación (de Element)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    if (recoveryKeyInput.isNotBlank()) {
                                        onRestoreKey?.invoke(recoveryKeyInput)
                                        recoveryKeyInput = ""
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = recoveryKeyInput.isNotBlank(),
                                colors = ButtonDefaults.buttonColors(containerColor = WhatsAppBadgeGreen),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Restaurar con clave de recuperación", fontSize = 12.sp)
                            }

                            // Show generated recovery key once
                            generatedRecoveryKey?.let { key ->
                                Spacer(modifier = Modifier.height(10.dp))
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3C4)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text(
                                            text = "Guarda esta clave en un lugar seguro (no se volverá a mostrar):",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF856404)
                                        )
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = key,
                                            fontSize = 11.sp,
                                            color = Color(0xFF111B21),
                                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                                        )
                                        TextButton(onClick = { generatedRecoveryKey = null }) {
                                            Text("Ya la guardé", fontSize = 12.sp)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Claves públicas de esta sesión (Element:
                            // "Nombre público y clave de la sesión")
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(
                                        text = "Claves de la sesión:",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Color(0xFF111B21)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "Ed25519: ${sessionKeys.first ?: "…"}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF667781),
                                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                                    )
                                    Text(
                                        text = "Curve25519: ${sessionKeys.second ?: "…"}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF667781),
                                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                                    )
                                }
                            }

                            // Gestión de sesiones (lista de dispositivos) via
                            // la página de administración de la cuenta MSC2965
                            val secCtx = LocalContext.current
                            var sessionsUnavailable by remember { mutableStateOf(false) }
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = {
                                    onAccountManagement?.invoke(true) { url ->
                                        if (url != null) {
                                            secCtx.startActivity(
                                                android.content.Intent(
                                                    android.content.Intent.ACTION_VIEW,
                                                    android.net.Uri.parse(url)
                                                )
                                            )
                                        } else {
                                            sessionsUnavailable = true
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Ver todas las sesiones (web)")
                            }
                            if (sessionsUnavailable) {
                                Text(
                                    text = "Tu homeserver no expone gestión de sesiones web",
                                    fontSize = 11.sp,
                                    color = Color(0xFF667781),
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Usuarios ignorados (m.ignored_user_list)
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(
                                        text = "Usuarios ignorados:",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Color(0xFF111B21)
                                    )
                                    if (ignoredUsers.isEmpty()) {
                                        Text(
                                            text = "Ninguno — los usuarios que ignores dejan de generar mensajes y llamadas",
                                            fontSize = 11.sp,
                                            color = Color(0xFF667781),
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                    } else {
                                        ignoredUsers.forEach { uid ->
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(top = 6.dp)
                                            ) {
                                                Text(
                                                    text = uid,
                                                    fontSize = 12.sp,
                                                    color = Color(0xFF111B21),
                                                    modifier = Modifier.weight(1f),
                                                    maxLines = 1
                                                )
                                                TextButton(onClick = { onUnignoreUser?.invoke(uid) }) {
                                                    Text("Dejar de ignorar", fontSize = 12.sp)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    3 -> {
                        // Preferencias locales (como la pestaña "Preferencias"
                        // de Element — afectan solo a esta app/dispositivo).
                        Column(modifier = Modifier.fillMaxWidth()) {
                            SettingsToggleRow(
                                title = "Enviar indicadores de \"escribiendo\"",
                                subtitle = "Los demás ven cuando estás escribiendo (m.typing)",
                                checked = sendTypingEnabled
                            ) { onToggleTyping?.invoke(it) }
                            SettingsToggleRow(
                                title = "Enviar recibos de lectura",
                                subtitle = "Los demás ven cuando leíste sus mensajes (m.read)",
                                checked = sendReadReceiptsEnabled
                            ) { onToggleReceipts?.invoke(it) }
                            SettingsToggleRow(
                                title = "Enter envía el mensaje",
                                subtitle = "Enviar con la tecla Enter en lugar de salto de línea",
                                checked = enterToSend
                            ) { onToggleEnterToSend?.invoke(it) }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Conexión en segundo plano — sin el servicio en
                            // primer plano Android puede matar el proceso.
                            val prefCtx = LocalContext.current
                            var backgroundSync by remember {
                                mutableStateOf(
                                    com.example.calls.MatrixSyncService.isBackgroundSyncEnabled(prefCtx)
                                )
                            }
                            SettingsToggleRow(
                                title = "Conexión en segundo plano",
                                subtitle = if (backgroundSync)
                                    "Siempre conectado — llegan llamadas y mensajes con la app cerrada"
                                else
                                    "Desactivado — no llegarán llamadas ni mensajes hasta abrir la app",
                                checked = backgroundSync
                            ) { enabled ->
                                backgroundSync = enabled
                                com.example.calls.MatrixSyncService
                                    .setBackgroundSyncEnabled(prefCtx, enabled)
                            }
                        }
                    }

                    4 -> {
                        // Ajustes Servidor / Avanzado
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Dns,
                                            contentDescription = null,
                                            tint = WhatsAppGreenPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Homeserver Matrix:",
                                            fontSize = 12.sp,
                                            color = Color(0xFF667781)
                                        )
                                    }
                                    Text(
                                        text = session?.homeserverUrl ?: "https://matrix.org",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Color(0xFF111B21),
                                        modifier = Modifier.padding(start = 26.dp, top = 2.dp)
                                    )

                                    if (!session?.deviceId.isNullOrBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.Security,
                                                contentDescription = null,
                                                tint = WhatsAppGreenPrimary,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "Device ID (Element):",
                                                fontSize = 12.sp,
                                                color = Color(0xFF667781)
                                            )
                                        }
                                        Text(
                                            text = session?.deviceId ?: "",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            color = Color(0xFF111B21),
                                            modifier = Modifier.padding(start = 26.dp, top = 2.dp)
                                        )
                                        Text(
                                            text = "✓ Sesión verificada en la federación Matrix",
                                            fontSize = 11.sp,
                                            color = WhatsAppBadgeGreen,
                                            fontWeight = FontWeight.Medium,
                                            modifier = Modifier.padding(start = 26.dp, top = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))
                HorizontalDivider(color = Color(0xFFE0E0E0))
                Spacer(modifier = Modifier.height(14.dp))

                // Actions: Cerrar sesión y Salir
                OutlinedButton(
                    onClick = {
                        onDismiss()
                        onLogout()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("btn_logout"),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE53935)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Cerrar sesión",
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Cerrar Sesión / Cambiar Servidor",
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Cerrar", color = WhatsAppGreenPrimary)
                }
            }
        }
    }
}

@Composable
private fun SettingsToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(vertical = 8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = Color(0xFF111B21)
            )
            Text(
                text = subtitle,
                fontSize = 12.sp,
                color = Color(0xFF667781)
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedTrackColor = WhatsAppGreenPrimary,
                checkedThumbColor = Color.White
            )
        )
    }
}
