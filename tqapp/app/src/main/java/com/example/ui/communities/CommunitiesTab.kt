package com.example.ui.communities
 
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.model.RoomEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.rooms.CreateRoomDialog
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary

@Composable
fun CommunitiesTab(
    communities: List<RoomEntity>,
    onRoomClick: (String) -> Unit,
    onCreateCommunity: (String, String, Boolean, android.net.Uri?) -> Unit
) {
    var showCreateDialog by remember { mutableStateOf(false) }
    var isBannerVisible by remember { mutableStateOf(true) }

    val parentCommunities = remember(communities) {
        communities.filter { it.roomType == "COMMUNITY" }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 80.dp)
        ) {
            // WhatsApp Communities Hero Banner Card (Dismissible with X)
            if (isBannerVisible) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F5F3))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(modifier = Modifier.fillMaxWidth()) {
                                IconButton(
                                    onClick = { isBannerVisible = false },
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .size(28.dp)
                                        .testTag("btn_close_community_banner")
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Cerrar",
                                        tint = Color(0xFF667781),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .size(60.dp)
                                        .clip(CircleShape)
                                        .background(WhatsAppGreenPrimary.copy(alpha = 0.15f))
                                        .align(Alignment.Center),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Groups,
                                        contentDescription = null,
                                        tint = WhatsAppGreenPrimary,
                                        modifier = Modifier.size(34.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Text(
                                text = "Comunidades en Matrix",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF111B21)
                            )

                            Spacer(modifier = Modifier.height(6.dp))

                            Text(
                                text = "Organiza salas y grupos relacionados con Matrix Spaces. Mantén informados a todos tus miembros con canales de avisos centralizados.",
                                fontSize = 13.sp,
                                color = Color(0xFF667781),
                                textAlign = TextAlign.Center,
                                lineHeight = 18.sp
                            )
                        }
                    }
                }
            }

            // Section Title
            item {
                Text(
                    text = "TUS COMUNIDADES (SPACES)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF667781),
                    modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp)
                )
            }

            // Parent Communities & Sub-rooms
            items(parentCommunities, key = { it.roomId }) { community ->
                val subRooms = remember(communities, community.roomId) {
                    communities.filter { it.parentSpaceId == community.roomId }
                }

                CommunityBlock(
                    community = community,
                    subRooms = subRooms,
                    onRoomClick = onRoomClick
                )

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = DividerDefaults.color.copy(alpha = 0.2f))
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        // WhatsApp Round Floating Action Button for New Community
        FloatingActionButton(
            onClick = { showCreateDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
                .testTag("fab_new_community"),
            containerColor = WhatsAppBadgeGreen,
            contentColor = Color.White,
            shape = CircleShape
        ) {
            Icon(
                imageVector = Icons.Default.Groups,
                contentDescription = "Nueva comunidad"
            )
        }
    }

    if (showCreateDialog) {
        CreateRoomDialog(
            contacts = emptyList(),
            isSpace = true,
            onDismiss = { showCreateDialog = false },
            onCreate = { name, topic, isPublic, _, avatarUri ->
                onCreateCommunity(name, topic, isPublic, avatarUri)
                showCreateDialog = false
            }
        )
    }
}

@Composable
fun CommunityBlock(
    community: RoomEntity,
    subRooms: List<RoomEntity>,
    onRoomClick: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // Community Parent Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onRoomClick(community.roomId) }
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            WhatsAppAvatar(
                name = community.name,
                avatarUrl = community.avatarUrl,
                isRoomGroup = true,
                size = 50.dp,
                backgroundColor = WhatsAppGreenDark
            )
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = community.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = community.topic.ifBlank { "Espacio Matrix federado" },
                    fontSize = 13.sp,
                    color = Color(0xFF667781)
                )
            }
        }

        // Sub rooms under this community
        subRooms.forEach { subRoom ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onRoomClick(subRoom.roomId) }
                    .padding(start = 48.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE8F5E9)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (subRoom.name.contains("Avisos")) Icons.Default.Campaign else Icons.Default.Chat,
                        contentDescription = null,
                        tint = WhatsAppGreenPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = subRoom.name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = subRoom.lastMessage.ifBlank { "Toca para abrir" },
                        fontSize = 12.sp,
                        color = Color(0xFF667781)
                    )
                }

                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = Color(0xFF8696A0),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

