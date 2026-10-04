package com.example.ui.chats

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Groups

import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Sync

import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.RoomEntity
import com.example.data.local.StoryEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenAccent
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ChatsListTab(
    rooms: List<RoomEntity>,
    stories: List<StoryEntity>,
    isSyncing: Boolean = false,
    onRefreshSync: (() -> Unit)? = null,
    onRoomClick: (String) -> Unit,
    onStoryClick: (StoryEntity) -> Unit,
    onNewChatClick: () -> Unit,
    archivedCount: Int = 0,
    onArchivedClick: () -> Unit = {}
) {
    var selectedFilter by remember { mutableStateOf("Todos") }
    val filters = listOf("Todos", "Personas", "Grupos", "No leídos", "Favoritos")

    val filteredRooms = remember(rooms, selectedFilter) {
        when (selectedFilter) {
            "Personas" -> rooms.filter { it.roomType == "DIRECT" || it.directUserId != null }
            "Grupos" -> rooms.filter { it.directUserId == null && (it.roomType == "GROUP" || it.roomType == "CHANNEL") }
            "No leídos" -> rooms.filter { it.unreadCount > 0 }
            "Favoritos" -> rooms.filter { it.isPinned }
            else -> rooms
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Sync status banner
            if (isSyncing) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(WhatsAppGreenAccent.copy(alpha = 0.15f))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = WhatsAppGreenDark
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Sincronizando chats con Matrix...",
                        fontSize = 12.sp,
                        color = WhatsAppGreenDark,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // WhatsApp Filter Chips
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filters) { filter ->
                    val isSelected = filter == selectedFilter
                    SuggestionChip(
                        onClick = { selectedFilter = filter },
                        label = {
                            Text(
                                text = filter,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) WhatsAppGreenPrimary else Color(0xFF667781)
                            )
                        },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            containerColor = if (isSelected) WhatsAppGreenAccent.copy(alpha = 0.15f) else Color(0xFFF0F2F5)
                        ),
                        border = SuggestionChipDefaults.suggestionChipBorder(
                            enabled = true,
                            borderColor = if (isSelected) WhatsAppGreenPrimary else Color.Transparent
                        ),
                        shape = RoundedCornerShape(16.dp)
                    )
                }
            }

            // Chat List
            if (filteredRooms.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChatBubbleOutline,
                            contentDescription = null,
                            tint = WhatsAppGreenPrimary.copy(alpha = 0.5f),
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "Sin conversaciones en Matrix",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Tus conversaciones reales de tu cuenta Matrix se sincronizan aquí. Pulsa el botón verde para iniciar un nuevo chat.",
                            fontSize = 13.sp,
                            color = Color(0xFF667781),
                            textAlign = TextAlign.Center
                        )
                        if (onRefreshSync != null) {
                            Spacer(modifier = Modifier.height(16.dp))
                            OutlinedButton(onClick = onRefreshSync) {
                                Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Sincronizar ahora", fontSize = 13.sp)
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    items(filteredRooms, key = { it.roomId }) { room ->
                        // Check if this room contact has an active story.
                        // directUserId is only set for rooms flagged m.direct —
                        // for unflagged 1:1s fall back to matching the display
                        // name against the story author.
                        val contactStory = stories.firstOrNull {
                            it.userId == room.directUserId
                        } ?: if (room.directUserId == null && room.roomType != "GROUP") {
                            stories.firstOrNull {
                                it.userName.equals(room.name, ignoreCase = true)
                            }
                        } else null

                        ChatListItem(
                            room = room,
                            contactStory = contactStory,
                            onClick = { onRoomClick(room.roomId) },
                            onAvatarClick = {
                                if (contactStory != null) {
                                    onStoryClick(contactStory)
                                } else {
                                    onRoomClick(room.roomId)
                                }
                            }
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 76.dp),
                            color = DividerDefaults.color.copy(alpha = 0.2f)
                        )
                    }
                    // WhatsApp "Archivados" row at the bottom — opens the
                    // archived conversations (obsolete DM rooms etc.).
                    if (archivedCount > 0) {
                        item(key = "archived_row") {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onArchivedClick() }
                                    .padding(horizontal = 16.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Archive,
                                    contentDescription = "Archivados",
                                    tint = WhatsAppGreenDark,
                                    modifier = Modifier.size(22.dp)
                                )
                                Spacer(modifier = Modifier.width(24.dp))
                                Text(
                                    "Archivados",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    "$archivedCount",
                                    fontSize = 13.sp,
                                    color = Color(0xFF8696A0)
                                )
                            }
                        }
                    }
                }
            }
        }

        // WhatsApp Floating Action Button (New Chat)
        FloatingActionButton(
            onClick = onNewChatClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
                .testTag("fab_new_chat"),
            containerColor = WhatsAppBadgeGreen,
            contentColor = Color.White,
            shape = CircleShape
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Chat,
                contentDescription = "Nuevo chat"
            )
        }
    }
}

@Composable
fun ChatListItem(
    room: RoomEntity,
    contactStory: StoryEntity?,
    onClick: () -> Unit,
    onAvatarClick: () -> Unit
) {
    val timeFormatter = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val formattedTime = remember(room.lastTimestamp) {
        val now = System.currentTimeMillis()
        val diff = now - room.lastTimestamp
        when {
            diff < 24 * 60 * 60 * 1000L -> timeFormatter.format(Date(room.lastTimestamp))
            diff < 48 * 60 * 60 * 1000L -> "Ayer"
            else -> SimpleDateFormat("dd/MM/yy", Locale.getDefault()).format(Date(room.lastTimestamp))
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .testTag("chat_item_${room.roomId}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        val isGroup = room.roomType == "GROUP" && room.directUserId == null
        // Avatar with optional story ring & group/person style
        WhatsAppAvatar(
            name = room.name,
            avatarUrl = room.avatarUrl,
            isRoomGroup = isGroup,
            size = 50.dp,
            hasStatus = contactStory != null,
            isStatusViewed = contactStory?.isViewed ?: false,
            onClick = onAvatarClick
        )

        Spacer(modifier = Modifier.width(14.dp))

        // Content
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f, fill = false),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isGroup) {
                        Icon(
                            imageVector = Icons.Default.Groups,
                            contentDescription = "Grupo",
                            tint = Color(0xFF667781),
                            modifier = Modifier
                                .size(16.dp)
                                .padding(end = 4.dp)
                        )
                    }
                    Text(
                        text = room.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Text(
                    text = formattedTime,
                    fontSize = 12.sp,
                    color = if (room.unreadCount > 0) WhatsAppBadgeGreen else Color(0xFF8696A0),
                    fontWeight = if (room.unreadCount > 0) FontWeight.Bold else FontWeight.Normal
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = room.lastMessage.ifBlank { "Toca para abrir la sala Matrix" },
                    fontSize = 14.sp,
                    color = Color(0xFF667781),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (room.isPinned) {
                    Icon(
                        imageVector = Icons.Default.PushPin,
                        contentDescription = "Fijado",
                        tint = Color(0xFF8696A0),
                        modifier = Modifier
                            .size(16.dp)
                            .padding(end = 4.dp)
                    )
                }

                if (room.unreadCount > 0) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(WhatsAppBadgeGreen),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${room.unreadCount}",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
