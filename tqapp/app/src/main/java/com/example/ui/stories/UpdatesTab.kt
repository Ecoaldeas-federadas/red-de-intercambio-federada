package com.example.ui.stories

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.model.RoomEntity
import com.example.data.local.StoryEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.theme.StoryColors
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppGreenAccent
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun UpdatesTab(
    stories: List<StoryEntity>,
    myStories: List<StoryEntity>,
    channels: List<RoomEntity>,
    onOpenStory: (List<StoryEntity>) -> Unit,
    onPostStory: (String, String) -> Unit,
    onPostMediaStory: (android.net.Uri, String) -> Unit,
    onChannelClick: (String) -> Unit,
    onRefreshStories: () -> Unit = {},
    myAvatarUrl: String? = null,
    myName: String? = null
) {
    LaunchedEffect(Unit) { onRefreshStories() }
    var showCreateStoryDialog by remember { mutableStateOf(false) }
    // Media picked for a story — shows the caption preview dialog first.
    var pendingStoryMedia by remember { mutableStateOf<Pair<android.net.Uri, Boolean>?>(null) }
    val photoStoryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri -> uri?.let { pendingStoryMedia = it to false } }
    val videoStoryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri -> uri?.let { pendingStoryMedia = it to true } }

    // One row per contact: group each person's stories into a single viewer queue.
    val recentStoryGroups = remember(stories) {
        stories.filter { !it.isMine }.groupBy { it.userId }.values
            .filter { g -> g.any { !it.isViewed } }
            .map { g -> g.sortedBy { it.timestamp } }
            .sortedByDescending { it.last().timestamp }
    }
    val viewedStoryGroups = remember(stories) {
        stories.filter { !it.isMine }.groupBy { it.userId }.values
            .filter { g -> g.all { it.isViewed } }
            .map { g -> g.sortedBy { it.timestamp } }
            .sortedByDescending { it.last().timestamp }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 80.dp)
        ) {
            // Estados Section Header
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Estado",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    IconButton(onClick = { }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Opciones",
                            tint = Color(0xFF667781)
                        )
                    }
                }
            }

            // "Mi Estado" Item
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (myStories.isNotEmpty()) {
                                onOpenStory(myStories.sortedBy { it.timestamp })
                            } else {
                                showCreateStoryDialog = true
                            }
                        }
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .testTag("my_status_item"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(contentAlignment = Alignment.BottomEnd) {
                        WhatsAppAvatar(
                            name = myName ?: "Mi estado",
                            avatarUrl = myAvatarUrl,
                            size = 54.dp,
                            hasStatus = myStories.isNotEmpty(),
                            isStatusViewed = false,
                            statusSegments = myStories.size.coerceAtLeast(1)
                        )
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(WhatsAppBadgeGreen)
                                .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                                .clickable { showCreateStoryDialog = true },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Añadir estado",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Mi estado",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (myStories.isNotEmpty()) {
                                "Activo • Expira en 24h • ${myStories.first().viewsCount} vistas"
                            } else {
                                "Añade una actualización (duración 24h)"
                            },
                            fontSize = 13.sp,
                            color = Color(0xFF667781)
                        )
                    }
                }
            }

            // Recientes Header
            if (recentStoryGroups.isNotEmpty()) {
                item {
                    Text(
                        text = "RECIENTES",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF667781),
                        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                    )
                }

                items(recentStoryGroups, key = { it.first().userId }) { group ->
                    StoryContactItem(
                        story = group.last(),
                        statusCount = group.size,
                        onClick = { onOpenStory(group) }
                    )
                }
            }

            // Vistos Header
            if (viewedStoryGroups.isNotEmpty()) {
                item {
                    Text(
                        text = "VISTOS",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF667781),
                        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp)
                    )
                }

                items(viewedStoryGroups, key = { it.first().userId }) { group ->
                    StoryContactItem(
                        story = group.last(),
                        statusCount = group.size,
                        onClick = { onOpenStory(group) }
                    )
                }
            }

            // Channels Section
            item {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = DividerDefaults.color.copy(alpha = 0.2f))
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Canales",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Mantente al día con los temas que te interesan",
                            fontSize = 13.sp,
                            color = Color(0xFF667781)
                        )
                    }
                    IconButton(onClick = { }) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Buscar canales",
                            tint = Color(0xFF667781)
                        )
                    }
                }
            }

            // Channel items
            items(channels, key = { it.roomId }) { channel ->
                ChannelItemRow(channel = channel, onClick = { onChannelClick(channel.roomId) })
                HorizontalDivider(
                    modifier = Modifier.padding(start = 76.dp),
                    color = DividerDefaults.color.copy(alpha = 0.2f)
                )
            }
        }

        // WhatsApp Two FABs in Novedades (Pencil on top, Camera below)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SmallFloatingActionButton(
                onClick = { showCreateStoryDialog = true },
                containerColor = Color(0xFFE7FFDB),
                contentColor = WhatsAppGreenDark,
                shape = CircleShape,
                modifier = Modifier.testTag("fab_text_story")
            ) {
                Icon(Icons.Default.Edit, contentDescription = "Crear estado de texto")
            }

            FloatingActionButton(
                onClick = { photoStoryLauncher.launch("image/*") },
                containerColor = WhatsAppBadgeGreen,
                contentColor = Color.White,
                shape = CircleShape,
                modifier = Modifier.testTag("fab_camera_story")
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = "Crear estado con cámara")
            }
        }
    }

    // Story Creation Dialog
    if (showCreateStoryDialog) {
        CreateStoryDialog(
            onDismiss = { showCreateStoryDialog = false },
            onPost = { text, colorHex ->
                onPostStory(text, colorHex)
                showCreateStoryDialog = false
            },
            onSelectPhoto = {
                showCreateStoryDialog = false
                photoStoryLauncher.launch("image/*")
            },
            onSelectVideo = {
                showCreateStoryDialog = false
                videoStoryLauncher.launch("video/*")
            }
        )
    }

    // Caption preview after picking a photo/video for a story
    pendingStoryMedia?.let { (uri, isVideo) ->
        MediaStoryPreviewDialog(
            uri = uri,
            isVideo = isVideo,
            onSend = { caption ->
                onPostMediaStory(uri, caption)
                pendingStoryMedia = null
            },
            onDismiss = { pendingStoryMedia = null }
        )
    }
}

@Composable
fun StoryContactItem(
    story: StoryEntity,
    statusCount: Int = 1,
    onClick: () -> Unit
) {
    val timeAgo = remember(story.timestamp) {
        val diff = System.currentTimeMillis() - story.timestamp
        val hours = diff / (1000 * 60 * 60)
        val minutes = (diff / (1000 * 60)) % 60
        when {
            hours > 0 -> "hace $hours h"
            minutes > 0 -> "hace $minutes min"
            else -> "ahora mismo"
        }
    }

    val hoursLeft = remember(story.expiresAt) {
        val diff = story.expiresAt - System.currentTimeMillis()
        val hours = (diff / (1000 * 60 * 60)).coerceAtLeast(0)
        "$hours h"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WhatsAppAvatar(
            name = story.userName,
            size = 54.dp,
            hasStatus = true,
            isStatusViewed = story.isViewed,
            statusSegments = statusCount.coerceAtLeast(1)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = story.userName,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "$timeAgo • Expira en $hoursLeft",
                fontSize = 13.sp,
                color = Color(0xFF667781)
            )
        }
    }
}

@Composable
fun ChannelItemRow(
    channel: RoomEntity,
    onClick: () -> Unit
) {
    var isFollowing by remember { mutableStateOf(true) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WhatsAppAvatar(
            name = channel.name,
            size = 48.dp,
            backgroundColor = Color(0xFF007BFC)
        )

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = channel.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Verificado",
                    tint = WhatsAppBadgeGreen,
                    modifier = Modifier.size(15.dp)
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = channel.lastMessage.ifBlank { "Canal público en la red Matrix" },
                fontSize = 13.sp,
                color = Color(0xFF667781),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        Button(
            onClick = { isFollowing = !isFollowing },
            shape = RoundedCornerShape(20.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isFollowing) Color(0xFFF0F2F5) else WhatsAppBadgeGreen,
                contentColor = if (isFollowing) Color(0xFF111B21) else Color.White
            ),
            modifier = Modifier.height(34.dp)
        ) {
            Text(
                text = if (isFollowing) "Siguiendo" else "Seguir",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun CreateStoryDialog(
    onDismiss: () -> Unit,
    onPost: (String, String) -> Unit,
    onSelectPhoto: () -> Unit,
    onSelectVideo: () -> Unit
) {
    var storyText by remember { mutableStateOf("") }
    var selectedColorIndex by remember { mutableIntStateOf(0) }
    val colors = StoryColors

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(colors[selectedColorIndex])
                .padding(20.dp)
        ) {
            // Top Controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cerrar",
                        tint = Color.White
                    )
                }

                Text(
                    text = "Dura 24 horas en Matrix",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )

                // Color Palette Cycler
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.3f))
                        .clickable {
                            selectedColorIndex = (selectedColorIndex + 1) % colors.size
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(colors[(selectedColorIndex + 1) % colors.size])
                    )
                }
            }

            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 56.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(onClick = onSelectPhoto) {
                    Icon(Icons.Default.Image, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Foto")
                }
                Button(onClick = onSelectVideo) {
                    Icon(Icons.Default.Videocam, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Video")
                }
            }

            // Center text input
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.Center),
                contentAlignment = Alignment.Center
            ) {
                OutlinedTextField(
                    value = storyText,
                    onValueChange = { storyText = it },
                    placeholder = {
                        Text(
                            text = "Escribe un estado...",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("input_story_text"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Transparent,
                        unfocusedBorderColor = Color.Transparent,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    textStyle = MaterialTheme.typography.headlineMedium.copy(
                        color = Color.White,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 6
                )
            }

            // Bottom Send Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Color choices circles
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(colors.indices.toList()) { index ->
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(colors[index])
                                .border(
                                    2.dp,
                                    if (index == selectedColorIndex) Color.White else Color.Transparent,
                                    CircleShape
                                )
                                .clickable { selectedColorIndex = index }
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                FloatingActionButton(
                    onClick = {
                        if (storyText.isNotBlank()) {
                            val colorHex = String.format("#%06X", (0xFFFFFF and colors[selectedColorIndex].toArgb()))
                            onPost(storyText, colorHex)
                        }
                    },
                    containerColor = WhatsAppBadgeGreen,
                    contentColor = Color.White,
                    shape = CircleShape,
                    modifier = Modifier.testTag("post_story_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Publicar estado"
                    )
                }
            }
        }
    }
}

private fun isVideoPath(path: String): Boolean =
    path.substringAfterLast('.', "").lowercase() in setOf("mp4", "webm", "3gp", "mkv", "mov")

/** WhatsApp-style multi-story viewer: segmented progress bars, tap right to
 * advance, tap left to go back, hold to pause, media renders full-bleed. */
@Composable
fun FullScreenStoryViewer(
    stories: List<StoryEntity>,
    onFinished: () -> Unit,
    onClose: () -> Unit,
    onReply: (String) -> Unit,
    onViewed: (StoryEntity) -> Unit
) {
    if (stories.isEmpty()) {
        LaunchedEffect(Unit) { onFinished() }
        return
    }
    var index by remember { mutableIntStateOf(0) }
    var progress by remember { mutableFloatStateOf(0f) }
    var replyText by remember { mutableStateOf("") }
    var isPaused by remember { mutableStateOf(false) }
    val story = stories[index.coerceIn(0, stories.lastIndex)]
    val mediaPath = story.mediaUrl
    val isVideo = mediaPath != null && isVideoPath(mediaPath)

    fun advance() {
        if (index < stories.lastIndex) {
            index++
            progress = 0f
        } else {
            onFinished()
        }
    }
    fun goBack() {
        if (index > 0) index--
        progress = 0f
    }

    LaunchedEffect(index) { onViewed(story) }

    // Auto-advance after 5 s for text/photo stories; videos advance on completion.
    LaunchedEffect(index, isPaused, isVideo) {
        if (!isPaused && !isVideo) {
            while (progress < 1f) {
                delay(50)
                progress += 0.01f
            }
            advance()
        }
    }

    val backgroundColor = remember(story.backgroundColorHex, mediaPath) {
        if (mediaPath != null) Color.Black
        else try {
            Color(android.graphics.Color.parseColor(story.backgroundColorHex))
        } catch (_: Exception) {
            Color(0xFF075E54)
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(backgroundColor)
        ) {
            // Full-bleed media / centered text
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                if (mediaPath == null) {
                    Text(
                        text = story.content,
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        lineHeight = 34.sp,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                } else if (isVideo) {
                    // ExoPlayer keyed on story.id: navigating away releases the
                    // player and returning creates a fresh one that re-plays the
                    // video (VideoView stayed black because it never re-prepared).
                    val context = androidx.compose.ui.platform.LocalContext.current
                    val player = androidx.compose.runtime.remember(story.id) {
                        androidx.media3.exoplayer.ExoPlayer.Builder(context).build().apply {
                            setMediaItem(
                                androidx.media3.common.MediaItem.fromUri(
                                    android.net.Uri.fromFile(java.io.File(mediaPath))
                                )
                            )
                            prepare()
                            playWhenReady = true
                        }
                    }
                    androidx.compose.runtime.DisposableEffect(story.id) {
                        val listener = object : androidx.media3.common.Player.Listener {
                            override fun onPlaybackStateChanged(state: Int) {
                                if (state == androidx.media3.common.Player.STATE_ENDED) advance()
                            }
                        }
                        player.addListener(listener)
                        onDispose {
                            player.removeListener(listener)
                            player.release()
                        }
                    }
                    // Pause/resume with the press gesture + drive the segment bar.
                    LaunchedEffect(story.id, isPaused) {
                        player.playWhenReady = !isPaused
                    }
                    LaunchedEffect(story.id) {
                        while (true) {
                            val dur = player.duration
                            progress = if (dur > 0)
                                (player.currentPosition.toFloat() / dur).coerceIn(0f, 1f)
                            else 0f
                            kotlinx.coroutines.delay(100)
                        }
                    }
                    androidx.compose.ui.viewinterop.AndroidView(
                        factory = { ctx ->
                            androidx.media3.ui.PlayerView(ctx).apply {
                                this.player = player
                                useController = false
                                resizeMode =
                                    androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    coil.compose.AsyncImage(
                        model = java.io.File(mediaPath),
                        contentDescription = story.content,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                }
            }

            // Tap zones: left 30% = previous, rest = next; hold pauses.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(index) {
                        detectTapGestures(
                            onPress = {
                                isPaused = true
                                tryAwaitRelease()
                                isPaused = false
                            },
                            onTap = { offset ->
                                if (offset.x < size.width * 0.3f) goBack() else advance()
                            }
                        )
                    }
            )

            Column(modifier = Modifier.fillMaxSize()) {
                // Segmented progress bars (one per story)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    stories.forEachIndexed { i, _ ->
                        LinearProgressIndicator(
                            progress = {
                                when {
                                    i < index -> 1f
                                    i == index -> progress.coerceIn(0f, 1f)
                                    else -> 0f
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp)),
                            color = Color.White,
                            trackColor = Color.White.copy(alpha = 0.35f)
                        )
                    }
                }

                // Contact Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    WhatsAppAvatar(
                        name = story.userName,
                        size = 40.dp
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = story.userName,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Expira en 24h • Federación Matrix",
                            color = Color.White.copy(alpha = 0.75f),
                            fontSize = 11.sp
                        )
                    }
                    IconButton(onClick = onClose) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Cerrar",
                            tint = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Caption overlay (media stories only)
                val caption = story.content.takeIf {
                    mediaPath != null && it.isNotBlank() && it != "Foto" && it != "Video"
                }
                if (caption != null) {
                    Text(
                        text = caption,
                        color = Color.White,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                            .background(Color.Black.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }

                // Bottom Reply Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = replyText,
                        onValueChange = { replyText = it },
                        placeholder = { Text("Responder...", color = Color.White.copy(alpha = 0.7f)) },
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.White.copy(alpha = 0.8f),
                            unfocusedBorderColor = Color.White.copy(alpha = 0.4f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = {
                            if (replyText.isNotBlank()) {
                                onReply(replyText)
                                replyText = ""
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Enviar respuesta",
                            tint = Color.White
                        )
                    }
                }
            }
        }
    }
}

/** Preview shown right after picking a photo/video — lets the user write a
 * caption over the media before publishing, like WhatsApp. */
@Composable
fun MediaStoryPreviewDialog(
    uri: android.net.Uri,
    isVideo: Boolean,
    onSend: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var caption by remember { mutableStateOf("") }
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            if (isVideo) {
                val context = androidx.compose.ui.platform.LocalContext.current
                val player = androidx.compose.runtime.remember {
                    androidx.media3.exoplayer.ExoPlayer.Builder(context).build().apply {
                        setMediaItem(androidx.media3.common.MediaItem.fromUri(uri))
                        repeatMode = androidx.media3.common.Player.REPEAT_MODE_ONE
                        prepare()
                        playWhenReady = true
                    }
                }
                androidx.compose.runtime.DisposableEffect(Unit) {
                    onDispose { player.release() }
                }
                androidx.compose.ui.viewinterop.AndroidView(
                    factory = { ctx ->
                        androidx.media3.ui.PlayerView(ctx).apply {
                            this.player = player
                            useController = false
                            resizeMode =
                                androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                coil.compose.AsyncImage(
                    model = uri,
                    contentDescription = "Vista previa",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit
                )
            }

            IconButton(
                onClick = onDismiss,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Cancelar",
                    tint = Color.White
                )
            }

            // Caption bar + send button
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = caption,
                    onValueChange = { caption = it },
                    placeholder = { Text("Añade un texto...", color = Color.White.copy(alpha = 0.7f)) },
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.8f),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.4f),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                FloatingActionButton(
                    onClick = { onSend(caption.trim()) },
                    containerColor = WhatsAppBadgeGreen,
                    contentColor = Color.White,
                    shape = CircleShape,
                    modifier = Modifier.size(52.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Publicar estado"
                    )
                }
            }
        }
    }
}
