package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.CircleNotifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Surface
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.matrix.MatrixApiClient
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppBlueTick
import com.example.ui.theme.WhatsAppGrayTick
import com.example.ui.theme.WhatsAppGreenAccent
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary

@Composable
fun WhatsAppAvatar(
    name: String,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    isRoomGroup: Boolean = false,
    size: Dp = 50.dp,
    hasStatus: Boolean = false,
    isStatusViewed: Boolean = false,
    statusSegments: Int = 1,
    backgroundColor: Color = WhatsAppGreenDark,
    onClick: (() -> Unit)? = null
) {
    val clickableModifier = if (onClick != null) {
        modifier.clickable { onClick() }
    } else modifier

    val resolvedUrl = remember(avatarUrl) {
        MatrixApiClient.mxcToHttp(avatarUrl)
    }

    Box(
        modifier = clickableModifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        if (hasStatus) {
            val ringColor = if (isStatusViewed) WhatsAppGrayTick else WhatsAppGreenAccent
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 2.5.dp.toPx()
                if (statusSegments <= 1) {
                    drawCircle(
                        color = ringColor,
                        style = Stroke(width = strokeWidth)
                    )
                } else {
                    val sweepAngle = (360f / statusSegments) - 6f
                    for (i in 0 until statusSegments) {
                        val startAngle = i * (360f / statusSegments) + 3f
                        drawArc(
                            color = ringColor,
                            startAngle = startAngle,
                            sweepAngle = sweepAngle,
                            useCenter = false,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                        )
                    }
                }
            }
        }

        val avatarShape = if (isRoomGroup) RoundedCornerShape((size.value * 0.35f).dp) else CircleShape

        Box(
            modifier = Modifier
                .size(if (hasStatus) size - 6.dp else size)
                .clip(avatarShape)
                .background(if (isRoomGroup) Color(0xFF1B4D3E) else backgroundColor),
            contentAlignment = Alignment.Center
        ) {
            if (!resolvedUrl.isNullOrBlank()) {
                AsyncImage(
                    model = resolvedUrl,
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                if (isRoomGroup) {
                    Icon(
                        imageVector = Icons.Default.Groups,
                        contentDescription = "Grupo",
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size((size.value * 0.55f).dp)
                    )
                } else {
                    val initials = name.trim().split(" ")
                        .take(2)
                        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                        .joinToString("")
                        .ifEmpty { "?" }

                    Text(
                        text = initials,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = (size.value * 0.38f).sp
                    )
                }
            }
        }
    }
}

@Composable
fun WhatsAppTicks(
    status: String,
    modifier: Modifier = Modifier
) {
    when (status) {
        "READ" -> {
            Icon(
                imageVector = Icons.Default.DoneAll,
                contentDescription = "Leído",
                tint = WhatsAppBlueTick,
                modifier = modifier.size(17.dp)
            )
        }
        "DELIVERED" -> {
            Icon(
                imageVector = Icons.Default.DoneAll,
                contentDescription = "Entregado",
                tint = WhatsAppGrayTick,
                modifier = modifier.size(17.dp)
            )
        }
        "SENT" -> {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Enviado",
                tint = WhatsAppGrayTick,
                modifier = modifier.size(15.dp)
            )
        }
        else -> {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Enviando",
                tint = WhatsAppGrayTick.copy(alpha = 0.5f),
                modifier = modifier.size(15.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsAppTopBar(
    title: String = "TqApp",
    serverName: String = "matrix.org",
    pendingInvites: Int = 0,
    onInvitesClick: () -> Unit = {},
    onCameraClick: () -> Unit = {},
    onSearchClick: () -> Unit = {},
    onNewGroupClick: () -> Unit = {},
    onNewCommunityClick: () -> Unit = {},
    onSyncClick: () -> Unit = {},
    onServerSettingsClick: () -> Unit = {},
    onLogoutClick: () -> Unit = {}
) {
    var menuExpanded by remember { mutableStateOf(false) }

    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Color.White
                )
                Spacer(modifier = Modifier.width(6.dp))
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color.White.copy(alpha = 0.2f),
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    Text(
                        text = "Matrix",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            }
        },
        actions = {
            if (pendingInvites > 0) {
                IconButton(
                    onClick = onInvitesClick,
                    modifier = Modifier.testTag("invites_button")
                ) {
                    BadgedBox(badge = { Badge { Text("$pendingInvites") } }) {
                        Icon(
                            imageVector = Icons.Outlined.CircleNotifications,
                            contentDescription = "Invitaciones pendientes",
                            tint = Color.White
                        )
                    }
                }
            }
            IconButton(
                onClick = onCameraClick,
                modifier = Modifier.testTag("camera_button")
            ) {
                Icon(
                    imageVector = Icons.Default.CameraAlt,
                    contentDescription = "Cámara",
                    tint = Color.White
                )
            }
            IconButton(
                onClick = onSearchClick,
                modifier = Modifier.testTag("search_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Buscar",
                    tint = Color.White
                )
            }
            Box {
                IconButton(
                    onClick = { menuExpanded = true },
                    modifier = Modifier.testTag("menu_more_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Más opciones",
                        tint = Color.White
                    )
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Nuevo grupo federado") },
                        onClick = {
                            menuExpanded = false
                            onNewGroupClick()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Sincronizar ahora con Matrix") },
                        onClick = {
                            menuExpanded = false
                            onSyncClick()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Ajustes y Sesiones Matrix") },
                        onClick = {
                            menuExpanded = false
                            onServerSettingsClick()
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Cerrar sesión") },
                        onClick = {
                            menuExpanded = false
                            onLogoutClick()
                        }
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = WhatsAppGreenPrimary,
            titleContentColor = Color.White,
            actionIconContentColor = Color.White
        )
    )
}

enum class WhatsAppTab {
    CHATS, NOVEDADES, COMUNIDADES, LLAMADAS
}

@Composable
fun WhatsAppBottomNavigation(
    selectedTab: WhatsAppTab,
    unreadChatsCount: Int = 0,
    hasNewStories: Boolean = true,
    onTabSelected: (WhatsAppTab) -> Unit
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp
    ) {
        // Chats
        NavigationBarItem(
            selected = selectedTab == WhatsAppTab.CHATS,
            onClick = { onTabSelected(WhatsAppTab.CHATS) },
            icon = {
                if (unreadChatsCount > 0) {
                    BadgedBox(
                        badge = {
                            Badge(containerColor = WhatsAppBadgeGreen) {
                                Text("$unreadChatsCount", color = Color.White)
                            }
                        }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chats")
                    }
                } else {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chats")
                }
            },
            label = { Text("Chats", fontWeight = if (selectedTab == WhatsAppTab.CHATS) FontWeight.Bold else FontWeight.Normal) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = WhatsAppGreenPrimary,
                selectedTextColor = WhatsAppGreenPrimary,
                indicatorColor = WhatsAppGreenAccent.copy(alpha = 0.2f)
            ),
            modifier = Modifier.testTag("tab_chats")
        )

        // Novedades (Estados + Canales)
        NavigationBarItem(
            selected = selectedTab == WhatsAppTab.NOVEDADES,
            onClick = { onTabSelected(WhatsAppTab.NOVEDADES) },
            icon = {
                if (hasNewStories) {
                    BadgedBox(
                        badge = {
                            Badge(
                                containerColor = WhatsAppBadgeGreen,
                                modifier = Modifier.size(8.dp)
                            )
                        }
                    ) {
                        Icon(Icons.Outlined.CircleNotifications, contentDescription = "Novedades")
                    }
                } else {
                    Icon(Icons.Outlined.CircleNotifications, contentDescription = "Novedades")
                }
            },
            label = { Text("Novedades", fontWeight = if (selectedTab == WhatsAppTab.NOVEDADES) FontWeight.Bold else FontWeight.Normal) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = WhatsAppGreenPrimary,
                selectedTextColor = WhatsAppGreenPrimary,
                indicatorColor = WhatsAppGreenAccent.copy(alpha = 0.2f)
            ),
            modifier = Modifier.testTag("tab_novedades")
        )

        // Comunidades (Matrix Spaces)
        NavigationBarItem(
            selected = selectedTab == WhatsAppTab.COMUNIDADES,
            onClick = { onTabSelected(WhatsAppTab.COMUNIDADES) },
            icon = {
                Icon(Icons.Default.Groups, contentDescription = "Comunidades")
            },
            label = { Text("Comunidades", fontWeight = if (selectedTab == WhatsAppTab.COMUNIDADES) FontWeight.Bold else FontWeight.Normal) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = WhatsAppGreenPrimary,
                selectedTextColor = WhatsAppGreenPrimary,
                indicatorColor = WhatsAppGreenAccent.copy(alpha = 0.2f)
            ),
            modifier = Modifier.testTag("tab_comunidades")
        )

        // Llamadas
        NavigationBarItem(
            selected = selectedTab == WhatsAppTab.LLAMADAS,
            onClick = { onTabSelected(WhatsAppTab.LLAMADAS) },
            icon = {
                Icon(Icons.Default.Call, contentDescription = "Llamadas")
            },
            label = { Text("Llamadas", fontWeight = if (selectedTab == WhatsAppTab.LLAMADAS) FontWeight.Bold else FontWeight.Normal) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = WhatsAppGreenPrimary,
                selectedTextColor = WhatsAppGreenPrimary,
                indicatorColor = WhatsAppGreenAccent.copy(alpha = 0.2f)
            ),
            modifier = Modifier.testTag("tab_llamadas")
        )
    }
}

@Composable
fun WhatsAppChatDoodleCanvas(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxSize()) {
        // Subtle doodle elements pattern
        val patternColor = Color(0xFF000000).copy(alpha = 0.035f)
        val step = 80.dp.toPx()
        val numX = (size.width / step).toInt() + 1
        val numY = (size.height / step).toInt() + 1

        for (ix in 0..numX) {
            for (iy in 0..numY) {
                val cx = ix * step + (if (iy % 2 == 1) step / 2f else 0f)
                val cy = iy * step
                // Alternate between subtle speech bubble, smiley, star, musical note
                when ((ix + iy) % 4) {
                    0 -> {
                        // Tiny speech bubble doodle
                        drawCircle(patternColor, radius = 9.dp.toPx(), center = Offset(cx, cy))
                    }
                    1 -> {
                        // Tiny diamond
                        val p = Path().apply {
                            moveTo(cx, cy - 8.dp.toPx())
                            lineTo(cx + 8.dp.toPx(), cy)
                            lineTo(cx, cy + 8.dp.toPx())
                            lineTo(cx - 8.dp.toPx(), cy)
                            close()
                        }
                        drawPath(p, patternColor)
                    }
                    2 -> {
                        // Tiny ring
                        drawCircle(
                            patternColor,
                            radius = 7.dp.toPx(),
                            center = Offset(cx, cy),
                            style = Stroke(width = 1.5.dp.toPx())
                        )
                    }
                    else -> {
                        // Tiny cross
                        drawLine(
                            patternColor,
                            Offset(cx - 5.dp.toPx(), cy),
                            Offset(cx + 5.dp.toPx(), cy),
                            strokeWidth = 1.5.dp.toPx()
                        )
                        drawLine(
                            patternColor,
                            Offset(cx, cy - 5.dp.toPx()),
                            Offset(cx, cy + 5.dp.toPx()),
                            strokeWidth = 1.5.dp.toPx()
                        )
                    }
                }
            }
        }
    }
}
