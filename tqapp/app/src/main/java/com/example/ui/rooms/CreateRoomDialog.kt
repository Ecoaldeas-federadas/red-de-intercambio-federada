package com.example.ui.rooms

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.example.data.model.ContactEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenPrimary

/**
 * Element X "Create room" flow in a WhatsApp skin: avatar, name, topic,
 * public/private visibility, E2EE toggle (forced off for public rooms like
 * Element does) and member selection from the federation contact list.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateRoomDialog(
    contacts: List<ContactEntity>,
    isSpace: Boolean = false,
    onDismiss: () -> Unit,
    onCreate: (name: String, topic: String, isPublic: Boolean, memberIds: List<String>, avatarUri: android.net.Uri?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var topic by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(false) }
    var encrypted by remember { mutableStateOf(true) }
    var avatarUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var selectedMembers by remember { mutableStateOf(setOf<String>()) }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) avatarUri = uri
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopAppBar(
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Atrás",
                                tint = Color.White
                            )
                        }
                    },
                    title = {
                        Text(
                            text = if (isSpace) "Crear comunidad" else "Nuevo grupo",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.White
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = WhatsAppGreenPrimary,
                        titleContentColor = Color.White
                    )
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp)
                ) {
                    Spacer(modifier = Modifier.height(16.dp))

                    // Avatar picker
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFE8F5E9))
                                .clickable { pickImage.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            if (avatarUri != null) {
                                AsyncImage(
                                    model = avatarUri,
                                    contentDescription = "Foto",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.AddAPhoto,
                                    contentDescription = "Añadir foto",
                                    tint = WhatsAppGreenPrimary
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = "Foto del ${if (isSpace) "espacio" else "grupo"} (opcional)",
                            fontSize = 14.sp,
                            color = Color(0xFF667781)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text(if (isSpace) "Nombre del espacio" else "Nombre del grupo") },
                        singleLine = true,
                        textStyle = TextStyle(color = Color(0xFF111B21), fontSize = 15.sp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = dialogFieldColors()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = topic,
                        onValueChange = { topic = it },
                        label = { Text("Tema / descripción (opcional)") },
                        maxLines = 2,
                        textStyle = TextStyle(color = Color(0xFF111B21), fontSize = 15.sp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = dialogFieldColors()
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Visibility — Element's "Room access"
                    Text(
                        text = "ACCESO A LA SALA",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF667781)
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = if (isPublic) Icons.Default.Public else Icons.Default.Lock,
                            contentDescription = null,
                            tint = WhatsAppGreenPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (isPublic) "Sala pública" else "Sala privada",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = Color(0xFF111B21)
                            )
                            Text(
                                text = if (isPublic)
                                    "Cualquiera puede encontrarla y unirse en la federación"
                                else
                                    "Solo miembros invitados pueden unirse",
                                fontSize = 12.sp,
                                color = Color(0xFF667781)
                            )
                        }
                        Switch(
                            checked = isPublic,
                            onCheckedChange = { isPublic = it },
                            colors = SwitchDefaults.colors(
                                checkedTrackColor = WhatsAppGreenPrimary,
                                checkedThumbColor = Color.White
                            )
                        )
                    }

                    if (!isSpace) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = WhatsAppGreenPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Cifrado de extremo a extremo",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF111B21)
                                )
                                Text(
                                    text = if (isPublic)
                                        "No disponible en salas públicas"
                                    else
                                        "Los mensajes solo pueden leerse en dispositivos verificados",
                                    fontSize = 12.sp,
                                    color = Color(0xFF667781)
                                )
                            }
                            Switch(
                                checked = encrypted && !isPublic,
                                onCheckedChange = { encrypted = it },
                                enabled = !isPublic,
                                colors = SwitchDefaults.colors(
                                    checkedTrackColor = WhatsAppGreenPrimary,
                                    checkedThumbColor = Color.White
                                )
                            )
                        }
                    }

                    if (contacts.isNotEmpty() && !isSpace) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "AÑADIR MIEMBROS (${selectedMembers.size})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF667781)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        contacts.forEach { contact ->
                            val checked = selectedMembers.contains(contact.userId)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedMembers = if (checked)
                                            selectedMembers - contact.userId
                                        else
                                            selectedMembers + contact.userId
                                    }
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                WhatsAppAvatar(name = contact.displayName, size = 40.dp)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = contact.displayName,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = contact.userId,
                                        fontSize = 12.sp,
                                        color = Color(0xFF667781),
                                        maxLines = 1
                                    )
                                }
                                Checkbox(
                                    checked = checked,
                                    onCheckedChange = null,
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = WhatsAppBadgeGreen
                                    )
                                )
                            }
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 52.dp),
                                color = Color(0xFFE0E0E0).copy(alpha = 0.5f)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(80.dp))
                }

                ExtendedFloatingActionButton(
                    onClick = {
                        if (name.isNotBlank()) {
                            onCreate(
                                name.trim(),
                                topic.trim(),
                                isPublic,
                                selectedMembers.toList(),
                                avatarUri
                            )
                            onDismiss()
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(16.dp),
                    containerColor = WhatsAppBadgeGreen,
                    contentColor = Color.White,
                    expanded = true,
                    icon = {},
                    text = {
                        Text(
                            text = if (isSpace) "Crear comunidad" else "Crear grupo",
                            fontWeight = FontWeight.Bold
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun dialogFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111B21),
    unfocusedTextColor = Color(0xFF111B21),
    focusedLabelColor = WhatsAppGreenPrimary,
    unfocusedLabelColor = Color(0xFF54656F),
    focusedBorderColor = WhatsAppGreenPrimary,
    unfocusedBorderColor = Color(0xFFB0BEC5),
    cursorColor = WhatsAppGreenPrimary
)
