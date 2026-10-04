package com.example.ui.contacts

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.model.ContactEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewChatDialog(
    contacts: List<ContactEntity>,
    onDismiss: () -> Unit,
    onContactSelected: (ContactEntity) -> Unit,
    onNewGroupClick: () -> Unit,
    onExploreRoomsClick: () -> Unit,
    onDirectMatrixIdChat: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredContacts = remember(contacts, searchQuery) {
        if (searchQuery.isBlank()) contacts
        else contacts.filter {
            it.displayName.contains(searchQuery, ignoreCase = true) ||
            it.userId.contains(searchQuery, ignoreCase = true)
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.surface)
        ) {
            // WhatsApp Header
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
                    Column {
                        Text(
                            text = "Seleccionar contacto",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color.White
                        )
                        Text(
                            text = "${contacts.size} contactos federados",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = WhatsAppGreenPrimary,
                    titleContentColor = Color.White
                )
            )

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Buscar contacto o @id:servidor.org...") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Buscar",
                        tint = Color(0xFF8696A0)
                    )
                },
                singleLine = true,
                textStyle = TextStyle(color = Color(0xFF111B21), fontSize = 15.sp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color(0xFF111B21),
                    unfocusedTextColor = Color(0xFF111B21),
                    focusedPlaceholderColor = Color(0xFF8696A0),
                    unfocusedPlaceholderColor = Color(0xFF8696A0),
                    focusedBorderColor = WhatsAppGreenPrimary,
                    unfocusedBorderColor = Color(0xFFE0E0E0),
                    cursorColor = WhatsAppGreenPrimary
                )
            )

            LazyColumn(modifier = Modifier.fillMaxSize()) {
                // If user typed a full Matrix ID (starts with @ or contains :), offer direct chat
                if (searchQuery.contains(":") || searchQuery.startsWith("@")) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onDirectMatrixIdChat(searchQuery.trim())
                                    onDismiss()
                                }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(WhatsAppBadgeGreen),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.PersonAdd, contentDescription = null, tint = Color.White)
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(
                                    text = "Abrir chat directo con ID Matrix",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = WhatsAppGreenPrimary
                                )
                                Text(
                                    text = searchQuery.trim(),
                                    fontSize = 13.sp,
                                    color = Color(0xFF667781)
                                )
                            }
                        }
                        HorizontalDivider(modifier = Modifier.padding(start = 76.dp))
                    }
                }

                // WhatsApp Action Items
                item {
                    NewChatActionItem(
                        icon = Icons.Default.GroupAdd,
                        label = "Nuevo grupo federado",
                        onClick = {
                            onDismiss()
                            onNewGroupClick()
                        }
                    )
                }

                item {
                    NewChatActionItem(
                        icon = Icons.Default.Public,
                        label = "Explorar salas públicas",
                        onClick = {
                            onDismiss()
                            onExploreRoomsClick()
                        }
                    )
                }

                item {
                    Text(
                        text = "CONTACTOS EN MATRIX",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF667781),
                        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                    )
                }

                // Contact Items
                items(filteredContacts, key = { it.userId }) { contact ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onContactSelected(contact)
                                onDismiss()
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                            .testTag("contact_item_${contact.userId}"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        WhatsAppAvatar(name = contact.displayName, size = 46.dp)

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = contact.displayName,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = contact.statusMessage,
                                fontSize = 13.sp,
                                color = Color(0xFF667781),
                                maxLines = 1
                            )
                        }
                    }
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 76.dp),
                        color = DividerDefaults.color.copy(alpha = 0.2f)
                    )
                }
            }
        }
    }
}

@Composable
fun NewChatActionItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(WhatsAppBadgeGreen),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Color.White,
                modifier = Modifier.size(22.dp)
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Text(
            text = label,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
