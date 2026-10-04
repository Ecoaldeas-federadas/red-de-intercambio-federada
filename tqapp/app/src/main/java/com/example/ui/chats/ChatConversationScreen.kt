package com.example.ui.chats

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Poll
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.foundation.layout.heightIn
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.material3.AlertDialog
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MessageEntity
import com.example.data.model.RoomEntity
import com.example.ui.components.WhatsAppAvatar
import com.example.ui.components.WhatsAppChatDoodleCanvas
import com.example.ui.components.WhatsAppTicks
import com.example.ui.theme.WhatsAppBadgeGreen
import com.example.ui.theme.WhatsAppBubbleIncomingDark
import com.example.ui.theme.WhatsAppChatBgDark
import com.example.ui.theme.WhatsAppChatBgLight
import com.example.ui.theme.WhatsAppGreenBubbleDark
import com.example.ui.theme.WhatsAppGreenLight
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatConversationScreen(
    room: RoomEntity?,
    messages: List<MessageEntity>,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onLoadMore: () -> Unit = {},
    onStartCall: (String, Boolean, Boolean) -> Unit, // roomId, isVideo, joinExisting
    viewModel: com.example.ui.WhatsAppMatrixViewModel? = null
) {
    var messageText by remember { mutableStateOf("") }

    // Composer draft: restore the unsent text for this room and persist it
    // whenever it changes (like WhatsApp's per-chat drafts).
    LaunchedEffect(room?.roomId) {
        room?.roomId?.let { messageText = viewModel?.getDraft(it) ?: "" }
    }
    LaunchedEffect(messageText) {
        room?.roomId?.let { viewModel?.saveDraft(it, messageText) }
    }
    DisposableEffect(room?.roomId) {
        onDispose { room?.roomId?.let { viewModel?.saveDraft(it, messageText) } }
    }
    var showAttachmentSheet by remember { mutableStateOf(false) }
    var showEmojiPanel by remember { mutableStateOf(false) }
    var showChatMenu by remember { mutableStateOf(false) }
    var showRoomInfo by remember { mutableStateOf(false) }
    var showPollDialog by remember { mutableStateOf(false) }
    var showContactPicker by remember { mutableStateOf(false) }
    val recordingScope = rememberCoroutineScope()
    var isRecording by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    var recordingPath by remember { mutableStateOf<String?>(null) }
    var recordingStartMs by remember { mutableStateOf(0L) }
    var recordingElapsedMs by remember { mutableStateOf(0L) }
    var isRecordingPaused by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf<String?>(null) }
    var messageMenuFor by remember { mutableStateOf<MessageEntity?>(null) }
    var showForwardDialog by remember { mutableStateOf<MessageEntity?>(null) }
    var reportReasonFor by remember { mutableStateOf<MessageEntity?>(null) }
    var reportRoomOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val listState = rememberLazyListState()
    val context = androidx.compose.ui.platform.LocalContext.current

    val isDark = isSystemInDarkTheme()
    val bgColor = if (isDark) WhatsAppChatBgDark else WhatsAppChatBgLight

    // Live room state (call activity changes arrive via sliding sync)
    val liveRooms by (viewModel?.chatsState ?: kotlinx.coroutines.flow.flowOf<List<RoomEntity>>(emptyList()))
        .collectAsStateWithLifecycle(initialValue = emptyList())
    val liveRoom = liveRooms.firstOrNull { it.roomId == room?.roomId } ?: room
    val myPowerLevel by (viewModel?.myPowerLevel ?: kotlinx.coroutines.flow.flowOf(0L))
        .collectAsStateWithLifecycle(initialValue = 0L)

    // --- Real pickers ---
    var pendingCameraPath by remember { mutableStateOf<String?>(null) }
    val takePictureLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) pendingCameraPath?.let { path ->
            viewModel?.sendAttachmentFile(path, "image/jpeg", "image")
        }
        pendingCameraPath = null
    }

    fun openSystemCamera() {
        val photoFile = java.io.File(
            java.io.File(context.cacheDir, "uploads").apply { mkdirs() },
            "camera_${System.currentTimeMillis()}.jpg"
        )
        pendingCameraPath = photoFile.absolutePath
        val uri = androidx.core.content.FileProvider.getUriForFile(
            context, "${context.packageName}.fileprovider", photoFile
        )
        takePictureLauncher.launch(uri)
    }

    val cameraPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) openSystemCamera()
        else android.widget.Toast.makeText(context, "Permiso de cámara denegado", android.widget.Toast.LENGTH_SHORT).show()
    }

    fun launchCamera() {
        val granted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.CAMERA
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (granted) openSystemCamera()
        else cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
    }

    val galleryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "image") }
    }
    val videoLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "video") }
    }
    val documentLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "file") }
    }
    val audioLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "audio") }
    }
    val gifLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "image") }
    }
    val stickerLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel?.sendAttachmentUri(it, "image") }
    }
    val locationPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) {
            shareLocation(context) { lat, lon -> viewModel?.sendLocation(lat, lon) }
        } else {
            android.widget.Toast.makeText(context, "Permiso de ubicación denegado", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    fun stopRecordingAndSend() {
        val path = recordingPath
        val duration = recordingElapsedMs.coerceAtLeast(System.currentTimeMillis() - recordingStartMs)
        val stopped = try {
            recorder?.stop()
            true
        } catch (_: Exception) {
            false
        }
        recorder?.release()
        recorder = null
        isRecording = false
        isRecordingPaused = false
        if (stopped && path != null && java.io.File(path).length() > 0L) {
            viewModel?.sendAttachmentFile(path, "audio/mp4", "voice", duration)
        } else {
            android.widget.Toast.makeText(context, "La grabación está vacía", android.widget.Toast.LENGTH_SHORT).show()
        }
        recordingPath = null
        recordingElapsedMs = 0L
    }

    fun cancelRecording() {
        try { recorder?.stop() } catch (_: Exception) {}
        recorder?.release()
        recorder = null
        recordingPath?.let { java.io.File(it).delete() }
        recordingPath = null
        recordingElapsedMs = 0L
        isRecording = false
        isRecordingPaused = false
    }

    fun toggleRecordingPause() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.N) return
        try {
            if (isRecordingPaused) recorder?.resume() else recorder?.pause()
            isRecordingPaused = !isRecordingPaused
        } catch (_: Exception) {
            android.widget.Toast.makeText(context, "No se pudo pausar la grabación", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    fun startRecording() {
        val file = java.io.File(
            java.io.File(context.cacheDir, "uploads").apply { mkdirs() },
            "voice_${System.currentTimeMillis()}.m4a"
        )
        // MediaRecorder.prepare()/start() can block for seconds when the audio
        // HAL is busy (Samsung mic contention) — running it on the main thread
        // caused ANRs. Do the heavy init on IO and only flip UI state after
        // the recorder actually started.
        recordingScope.launch(Dispatchers.IO) {
            // A previous Element Call session may have left the audio mode in
            // MODE_IN_COMMUNICATION, which breaks MIC capture on Samsung HALs.
            try {
                val am = context.getSystemService(android.content.Context.AUDIO_SERVICE)
                    as android.media.AudioManager
                if (am.mode != android.media.AudioManager.MODE_NORMAL) {
                    am.mode = android.media.AudioManager.MODE_NORMAL
                }
            } catch (_: Exception) {
            }
            val r = try {
                android.media.MediaRecorder().apply {
                    setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
                    setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
                    setOutputFile(file.absolutePath)
                    prepare()
                    start()
                }
            } catch (e: Exception) {
                file.delete()
                withContext(Dispatchers.Main) {
                    android.widget.Toast.makeText(context, "No se pudo grabar audio", android.widget.Toast.LENGTH_SHORT).show()
                }
                return@launch
            }
            withContext(Dispatchers.Main) {
                recorder = r
                recordingPath = file.absolutePath
                recordingStartMs = System.currentTimeMillis()
                recordingElapsedMs = 0L
                isRecordingPaused = false
                isRecording = true
            }
        }
    }

    val micPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startRecording()
        else android.widget.Toast.makeText(context, "Permiso de micrófono denegado", android.widget.Toast.LENGTH_SHORT).show()
    }

    var pendingCallIsVideo by remember { mutableStateOf(false) }
    var pendingCallJoinExisting by remember { mutableStateOf(false) }
    val callPermissionsLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val micGranted = results[android.Manifest.permission.RECORD_AUDIO] == true
        val camGranted = !pendingCallIsVideo || results[android.Manifest.permission.CAMERA] == true
        if (micGranted && camGranted) {
            room?.roomId?.let { onStartCall(it, pendingCallIsVideo, pendingCallJoinExisting) }
        } else {
            android.widget.Toast.makeText(context, "Se necesitan permisos de cámara/micrófono para llamar", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    fun requestCall(isVideo: Boolean, joinExisting: Boolean = false) {
        val roomId = room?.roomId ?: return
        pendingCallIsVideo = isVideo
        pendingCallJoinExisting = joinExisting
        val micGranted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.RECORD_AUDIO
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val camGranted = !isVideo || androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.CAMERA
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (micGranted && camGranted) {
            onStartCall(roomId, isVideo, joinExisting)
        } else {
            val perms = if (isVideo) {
                arrayOf(android.Manifest.permission.RECORD_AUDIO, android.Manifest.permission.CAMERA)
            } else {
                arrayOf(android.Manifest.permission.RECORD_AUDIO)
            }
            callPermissionsLauncher.launch(perms)
        }
    }

    fun startRecordingWithPermission() {
        val granted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.RECORD_AUDIO
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (granted) startRecording()
        else micPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
    }

    LaunchedEffect(isRecording, isRecordingPaused) {
        while (isRecording) {
            if (!isRecordingPaused) recordingElapsedMs = System.currentTimeMillis() - recordingStartMs
            kotlinx.coroutines.delay(250)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    // Back-pagination: when the user scrolls to the top, ask the SDK for older history
    val reachedTop = messages.isNotEmpty() &&
        listState.firstVisibleItemIndex <= 1 &&
        listState.firstVisibleItemScrollOffset == 0
    LaunchedEffect(reachedTop) {
        if (reachedTop) onLoadMore()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .navigationBarsPadding()
            .imePadding()
    ) {
        // WhatsApp Chat Top Bar
        TopAppBar(
            navigationIcon = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .clickable { onBack() }
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Atrás",
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    WhatsAppAvatar(
                        name = room?.name ?: "Sala",
                        avatarUrl = room?.avatarUrl,
                        size = 36.dp
                    )
                }
            },
            title = {
                Column(
                    modifier = Modifier
                        .clickable {
                            room?.let { viewModel?.loadRoomMembers(it.roomId) }
                            showRoomInfo = true
                        }
                        .padding(start = 6.dp)
                ) {
                    Text(
                        text = room?.name ?: "Chat Matrix",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val typingUsers by (viewModel?.typingUsers ?: kotlinx.coroutines.flow.flowOf(emptyList()))
                        .collectAsStateWithLifecycle(initialValue = emptyList<String>())
                    Text(
                        text = when {
                            typingUsers.isNotEmpty() ->
                                if (room?.roomType == "GROUP" && typingUsers.size > 1)
                                    "varios están escribiendo…"
                                else "escribiendo…"
                            room?.roomType == "GROUP" -> "grupo federado Matrix"
                            else -> "en línea"
                        },
                        color = if (typingUsers.isNotEmpty()) Color(0xFF25D366) else Color.White.copy(alpha = 0.8f),
                        fontSize = 11.sp,
                        maxLines = 1
                    )
                }
            },
            actions = {
                IconButton(
                    onClick = { requestCall(true) },
                    modifier = Modifier.testTag("chat_video_call")
                ) {
                    Icon(
                        imageVector = Icons.Default.Videocam,
                        contentDescription = "Videollamada",
                        tint = Color.White
                    )
                }
                IconButton(
                    onClick = { requestCall(false) },
                    modifier = Modifier.testTag("chat_voice_call")
                ) {
                    Icon(
                        imageVector = Icons.Default.Call,
                        contentDescription = "Llamada de voz",
                        tint = Color.White
                    )
                }
                Box {
                    IconButton(
                        onClick = { showChatMenu = true },
                        modifier = Modifier.testTag("chat_menu")
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Opciones",
                            tint = Color.White
                        )
                    }
                    androidx.compose.material3.DropdownMenu(
                        expanded = showChatMenu,
                        onDismissRequest = { showChatMenu = false }
                    ) {
                        val isGroup = room?.roomType == "GROUP" || room?.roomType == "CHANNEL"
                        androidx.compose.material3.DropdownMenuItem(
                            text = { Text(if (isGroup) "Info del grupo" else "Ver contacto") },
                            onClick = {
                                showChatMenu = false
                                room?.let { viewModel?.loadRoomMembers(it.roomId) }
                                showRoomInfo = true
                            }
                        )
                        androidx.compose.material3.DropdownMenuItem(
                            text = { Text("Buscar") },
                            onClick = {
                                showChatMenu = false
                                searchQuery = ""
                            }
                        )
                        androidx.compose.material3.DropdownMenuItem(
                            text = { Text("Invitar") },
                            onClick = {
                                showChatMenu = false
                                showContactPicker = true
                            }
                        )
                        androidx.compose.material3.DropdownMenuItem(
                            text = { Text(if (isGroup) "Salir del grupo" else "Salir del chat", color = Color(0xFFE53935)) },
                            onClick = {
                                showChatMenu = false
                                viewModel?.leaveCurrentRoom()
                            }
                        )
                        androidx.compose.material3.DropdownMenuItem(
                            text = { Text("Salir y eliminar", color = Color(0xFFE53935)) },
                            onClick = {
                                showChatMenu = false
                                room?.let { viewModel?.deleteRoom(it.roomId) }
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

        // In-chat search bar (3-dot menu "Buscar")
        searchQuery?.let { query ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (isDark) Color(0xFF1F2C34) else Color.White)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Buscar en la conversación…", fontSize = 14.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    textStyle = TextStyle(
                        color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                        fontSize = 14.sp
                    )
                )
                IconButton(onClick = { searchQuery = null }) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Cerrar búsqueda",
                        tint = Color(0xFF8696A0)
                    )
                }
            }
        }

        // "Call in progress" banner — shown when the room has an active
        // MatrixRTC session, like Element's join-call banner.
        if (liveRoom?.hasActiveCall == true && liveRoom != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF075E54))
                    .clickable { requestCall(true, joinExisting = true) }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Default.Call,
                    contentDescription = null,
                    tint = Color(0xFF00A884),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "Llamada en curso · Toca para unirte",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Pinned messages banner (m.pinned_events) — WhatsApp-style bar
        val pinnedMessages = messages.filter { it.isPinned }
        if (pinnedMessages.isNotEmpty()) {
            val last = pinnedMessages.last()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (isDark) Color(0xFF1F2C34) else Color.White)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(30.dp)
                        .background(WhatsAppGreenPrimary, RoundedCornerShape(2.dp))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${pinnedMessages.size} mensaje(s) fijado(s)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = WhatsAppGreenPrimary
                    )
                    Text(
                        last.content.ifBlank { "Adjunto" },
                        fontSize = 12.sp,
                        color = Color(0xFF8696A0),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        // Chat Body with WhatsApp Doodle Wallpaper
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(bgColor)
        ) {
            WhatsAppChatDoodleCanvas()

            val visibleMessages = searchQuery?.takeIf { it.isNotBlank() }?.let { q ->
                messages.filter { it.content.contains(q, ignoreCase = true) }
            } ?: messages

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Encryption Pill Notice (WhatsApp standard)
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isDark) Color(0xFF182229) else Color(0xFFFFF3C4),
                            shadowElevation = 1.dp,
                            modifier = Modifier.padding(horizontal = 24.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = null,
                                    tint = if (isDark) Color(0xFFF7A235) else Color(0xFF856404),
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Los mensajes en esta sala están cifrados con el protocolo Matrix de extremo a extremo.",
                                    fontSize = 11.sp,
                                    textAlign = TextAlign.Center,
                                    color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF54656F),
                                    lineHeight = 14.sp
                                )
                            }
                        }
                    }
                }

                // Messages list
                items(visibleMessages, key = { it.id }) { msg ->
                    ChatBubble(
                        message = msg,
                        isGroup = room?.roomType == "GROUP",
                        onResolveMedia = viewModel?.let { vm ->
                            { mxc: String, mime: String, file: String, cb: (String?) -> Unit ->
                                vm.resolveMedia(mxc, mime, file, cb)
                            }
                        },
                        callActive = liveRoom?.hasActiveCall == true,
                        onJoinCall = { requestCall(msg.callIsVideo, joinExisting = true) },
                        onVotePoll = viewModel?.let { vm ->
                            { m: MessageEntity, index: Int -> vm.votePoll(m, index) }
                        },
                        onLoadPollVoters = viewModel?.let { vm ->
                            { m: MessageEntity, cb: (List<String>) -> Unit -> vm.loadPollVoters(m, cb) }
                        },
                        onLongPress = { m -> messageMenuFor = m },
                        onToggleReaction = viewModel?.let { vm ->
                            { m: MessageEntity, emoji: String -> vm.toggleReaction(m, emoji) }
                        }
                    )
                }
            }
        }

        // Reply / edit bar above the composer (WhatsApp style)
        val replyTo by (viewModel?.replyTo ?: kotlinx.coroutines.flow.flowOf<MessageEntity?>(null))
            .collectAsStateWithLifecycle(initialValue = null)
        val editingMessage by (viewModel?.editingMessage ?: kotlinx.coroutines.flow.flowOf<MessageEntity?>(null))
            .collectAsStateWithLifecycle(initialValue = null)
        LaunchedEffect(editingMessage?.id) {
            editingMessage?.let { messageText = it.content }
        }
        val composerBanner = when {
            editingMessage != null -> "Editando mensaje" to (editingMessage?.content ?: "")
            replyTo != null -> ("Respondiendo a " + (replyTo?.senderName ?: "")) to (replyTo?.content ?: "")
            else -> null
        }
        if (composerBanner != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isDark) Color(0xFF1F2C34) else Color.White)
                    .padding(start = 10.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(34.dp)
                        .background(WhatsAppGreenPrimary, RoundedCornerShape(2.dp))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = composerBanner.first,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = WhatsAppGreenPrimary
                    )
                    Text(
                        text = composerBanner.second,
                        fontSize = 12.sp,
                        color = Color(0xFF8696A0),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = { viewModel?.cancelComposerAction() }) {
                    Icon(Icons.Default.Close, contentDescription = "Cancelar", tint = Color(0xFF8696A0))
                }
            }
        }

        // WhatsApp Message Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Transparent)
                .padding(horizontal = 6.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Pill input
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDark) Color(0xFF1F2C34) else Color.White
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    IconButton(onClick = { showEmojiPanel = !showEmojiPanel }) {
                        Icon(
                            imageVector = Icons.Default.Mood,
                            contentDescription = "Emojis",
                            tint = if (showEmojiPanel) WhatsAppGreenPrimary else Color(0xFF8696A0)
                        )
                    }

                    OutlinedTextField(
                        value = messageText,
                        onValueChange = {
                            messageText = it
                            viewModel?.onComposerTextChanged(it)
                        },
                        placeholder = { Text("Mensaje", color = Color(0xFF8696A0), fontSize = 15.sp) },
                        textStyle = TextStyle(
                            color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                            fontSize = 15.sp
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("chat_input_text"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                            unfocusedTextColor = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                            focusedPlaceholderColor = Color(0xFF8696A0),
                            unfocusedPlaceholderColor = Color(0xFF8696A0),
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent,
                            cursorColor = WhatsAppGreenPrimary
                        ),
                        maxLines = 4
                    )

                    IconButton(onClick = { showAttachmentSheet = true }) {
                        Icon(
                            imageVector = Icons.Default.AttachFile,
                            contentDescription = "Adjuntar",
                            tint = Color(0xFF8696A0)
                        )
                    }

                    if (messageText.isBlank()) {
                        IconButton(onClick = { launchCamera() }) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = "Cámara",
                                tint = Color(0xFF8696A0)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Circular Green Action Button (Mic / Stop recording / Send)
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(if (isRecording) Color(0xFFE53935) else WhatsAppBadgeGreen)
                    .clickable {
                        when {
                            isRecording -> stopRecordingAndSend()
                            messageText.isNotBlank() -> {
                                onSendMessage(messageText)
                                messageText = ""
                            }
                            else -> startRecordingWithPermission()
                        }
                    }
                    .testTag("chat_send_button"),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when {
                        isRecording -> Icons.AutoMirrored.Filled.Send
                        messageText.isNotBlank() -> Icons.AutoMirrored.Filled.Send
                        else -> Icons.Default.Mic
                    },
                    contentDescription = when {
                        isRecording -> "Enviar nota de voz"
                        messageText.isNotBlank() -> "Enviar"
                        else -> "Grabar nota de voz"
                    },
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        // Recording indicator strip
        if (isRecording) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE53935).copy(alpha = 0.12f))
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Mic, contentDescription = null, tint = Color(0xFFE53935), modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = String.format(Locale.getDefault(), "%02d:%02d", recordingElapsedMs / 60_000, (recordingElapsedMs / 1_000) % 60),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFE53935)
                )
                Text(
                    text = if (isRecordingPaused) "  Pausada" else "  Grabando…",
                    fontSize = 12.sp,
                    color = Color(0xFFE53935)
                )
                Spacer(modifier = Modifier.weight(1f))
                IconButton(onClick = { cancelRecording() }, modifier = Modifier.size(32.dp)) {
                    Icon(androidx.compose.material.icons.Icons.Default.Delete, "Cancelar", tint = Color(0xFFE53935))
                }
                IconButton(onClick = { toggleRecordingPause() }, modifier = Modifier.size(32.dp)) {
                    Icon(
                        if (isRecordingPaused) androidx.compose.material.icons.Icons.Default.PlayArrow else androidx.compose.material.icons.Icons.Default.Pause,
                        if (isRecordingPaused) "Continuar" else "Pausar",
                        tint = Color(0xFFE53935)
                    )
                }
            }
        }

        // Emoji panel (WhatsApp-style grid)
        if (showEmojiPanel) {
            EmojiPanel(
                onEmojiClick = { emoji -> messageText += emoji },
                onSelectGif = { gifLauncher.launch("image/gif") },
                onSelectSticker = { stickerLauncher.launch("image/*") }
            )
        }
    }

    // Attachment Modal Sheet (WhatsApp grid style)
    if (showAttachmentSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAttachmentSheet = false },
            sheetState = sheetState,
            containerColor = if (isDark) Color(0xFF1F2C34) else Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Text(
                    text = "Compartir en sala Matrix",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(bottom = 20.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    AttachmentOption(
                        icon = Icons.Default.Description,
                        label = "Documento",
                        color = Color(0xFF7F66FF),
                        onClick = {
                            showAttachmentSheet = false
                            documentLauncher.launch(arrayOf("*/*"))
                        }
                    )
                    AttachmentOption(
                        icon = Icons.Default.CameraAlt,
                        label = "Cámara",
                        color = Color(0xFFD3396D),
                        onClick = {
                            showAttachmentSheet = false
                            launchCamera()
                        }
                    )
                    AttachmentOption(
                        icon = Icons.Default.Image,
                        label = "Galería",
                        color = Color(0xFFAC44CF),
                        onClick = {
                            showAttachmentSheet = false
                            galleryLauncher.launch("image/*")
                        }
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    AttachmentOption(
                        icon = Icons.Default.Headphones,
                        label = "Audio",
                        color = Color(0xFFE95950),
                        onClick = {
                            showAttachmentSheet = false
                            audioLauncher.launch("audio/*")
                        }
                    )
                    AttachmentOption(
                        icon = Icons.Default.Poll,
                        label = "Encuesta",
                        color = Color(0xFF00A884),
                        onClick = {
                            showAttachmentSheet = false
                            showPollDialog = true
                        }
                    )
                    AttachmentOption(
                        icon = Icons.Default.Person,
                        label = "Ubicación",
                        color = Color(0xFF007BFC),
                        onClick = {
                            showAttachmentSheet = false
                            val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                                context, android.Manifest.permission.ACCESS_FINE_LOCATION
                            ) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
                                androidx.core.content.ContextCompat.checkSelfPermission(
                                    context, android.Manifest.permission.ACCESS_COARSE_LOCATION
                                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                            if (granted) {
                                shareLocation(context) { lat, lon ->
                                    viewModel?.sendLocation(lat, lon)
                                }
                            } else {
                                locationPermissionLauncher.launch(
                                    arrayOf(
                                        android.Manifest.permission.ACCESS_FINE_LOCATION,
                                        android.Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            }
                        }
                    )
                }
            }
        }
    }

    // --- Message actions (long-press): reactions + WhatsApp-style menu ---
    messageMenuFor?.let { msg ->
        val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
        AlertDialog(
            onDismissRequest = { messageMenuFor = null },
            title = {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    listOf("👍", "❤️", "😂", "😮", "😢", "🙏").forEach { e ->
                        Text(
                            text = e,
                            fontSize = 24.sp,
                            modifier = Modifier.clickable {
                                viewModel?.toggleReaction(msg, e)
                                messageMenuFor = null
                            }
                        )
                    }
                }
            },
            text = {
                Column {
                    @androidx.compose.runtime.Composable
                    fun action(label: String, danger: Boolean = false, onClick: () -> Unit) {
                        Text(
                            text = label,
                            fontSize = 15.sp,
                            color = if (danger) Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onClick()
                                    messageMenuFor = null
                                }
                                .padding(vertical = 12.dp)
                        )
                    }
                    action("Responder") { viewModel?.startReply(msg) }
                    if (msg.messageType == "TEXT" && !msg.isDeleted) {
                        action("Copiar") {
                            clipboard.setText(androidx.compose.ui.text.AnnotatedString(msg.content))
                        }
                        if (msg.isOutgoing) action("Editar mensaje") { viewModel?.startEdit(msg) }
                    }
                    if (!msg.isDeleted) {
                        action("Reenviar") { showForwardDialog = msg }
                        action(if (msg.isPinned) "Desfijar mensaje" else "Fijar mensaje") {
                            viewModel?.pinMessage(msg, !msg.isPinned)
                        }
                    }
                    if (msg.isOutgoing || myPowerLevel >= 50L) {
                        action("Eliminar para todos", danger = true) {
                            viewModel?.deleteMessage(msg)
                        }
                    }
                    if (!msg.isOutgoing && !msg.isDeleted) {
                        action("Reportar mensaje", danger = true) {
                            reportReasonFor = msg
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { messageMenuFor = null }) { Text("Cancelar") }
            }
        )
    }

    // --- Forward dialog: pick a target conversation ---
    showForwardDialog?.let { msg ->
        val targets = liveRooms.filter { it.roomId != room?.roomId }
        AlertDialog(
            onDismissRequest = { showForwardDialog = null },
            title = { Text("Reenviar a…", fontWeight = FontWeight.Bold) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                    items(targets, key = { it.roomId }) { target ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel?.forwardMessage(msg, target.roomId)
                                    showForwardDialog = null
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            WhatsAppAvatar(
                                name = target.name,
                                avatarUrl = target.avatarUrl,
                                size = 38.dp
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(target.name, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showForwardDialog = null }) { Text("Cancelar") }
            }
        )
    }

    // --- Report message dialog (reason → homeserver /report) ---
    reportReasonFor?.let { msg ->
        var reason by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { reportReasonFor = null },
            title = { Text("Reportar mensaje", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    placeholder = { Text("Motivo del reporte") },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel?.reportMessage(msg, reason.ifBlank { "Contenido inapropiado" })
                        reportReasonFor = null
                    }
                ) { Text("Reportar", color = Color(0xFFE53935)) }
            },
            dismissButton = {
                TextButton(onClick = { reportReasonFor = null }) { Text("Cancelar") }
            }
        )
    }

    // --- Room info dialog (name, encryption, members, admin actions) ---
    if (showRoomInfo && room != null && viewModel != null) {
        val members by viewModel.roomMembers.collectAsStateWithLifecycle()
        val myPowerLevel by viewModel.myPowerLevel.collectAsStateWithLifecycle()
        val isGroup = room.roomType == "GROUP" || room.directUserId == null
        val canEdit = myPowerLevel >= 50L
        val isAdmin = myPowerLevel >= 100L
        var editingName by remember { mutableStateOf(false) }
        var editingTopic by remember { mutableStateOf(false) }
        var nameText by remember { mutableStateOf(room.name) }
        var topicText by remember { mutableStateOf(room.topic) }
        var inviteText by remember { mutableStateOf("") }
        var memberMenuFor by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { showRoomInfo = false },
            title = {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            room.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                        if (isGroup && canEdit) {
                            IconButton(onClick = { editingName = !editingName }) {
                                Icon(Icons.Default.Edit, contentDescription = "Renombrar", modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                    if (editingName) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = nameText,
                                onValueChange = { nameText = it },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            IconButton(onClick = {
                                viewModel.renameCurrentRoom(nameText)
                                editingName = false
                            }) {
                                Icon(Icons.Default.Check, contentDescription = "Guardar nombre")
                            }
                        }
                    }
                    Text(
                        text = if (room.isEncrypted) "� Cifrado extremo a extremo" else "Sala sin cifrado",
                        fontSize = 12.sp,
                        color = if (room.isEncrypted) WhatsAppGreenDark else Color(0xFFE53935)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = room.topic.ifBlank { "Sin descripción" },
                            fontSize = 12.sp,
                            color = Color(0xFF667781),
                            modifier = Modifier.weight(1f)
                        )
                        if (isGroup && canEdit) {
                            IconButton(onClick = { editingTopic = !editingTopic }) {
                                Icon(Icons.Default.Edit, contentDescription = "Editar descripción", modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                    if (editingTopic) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = topicText,
                                onValueChange = { topicText = it },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            IconButton(onClick = {
                                viewModel.setCurrentRoomTopic(topicText)
                                editingTopic = false
                            }) {
                                Icon(Icons.Default.Check, contentDescription = "Guardar descripción")
                            }
                        }
                    }
                }
            },
            text = {
                Column {
                    if (isGroup) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = inviteText,
                                onValueChange = { inviteText = it },
                                placeholder = { Text("@usuario:servidor", fontSize = 12.sp) },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            TextButton(onClick = {
                                if (inviteText.isNotBlank()) {
                                    viewModel.inviteUserToCurrentRoom(inviteText)
                                    inviteText = ""
                                }
                            }) { Text("Invitar", fontSize = 12.sp) }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                    Text(
                        text = "Miembros (${members.size})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    if (members.isEmpty()) {
                        Text("Cargando miembros…", fontSize = 13.sp, color = Color(0xFF667781))
                    } else {
                        LazyColumn(modifier = Modifier.heightIn(max = 280.dp)) {
                            items(members, key = { it.userId }) { m ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    WhatsAppAvatar(name = m.displayName, avatarUrl = m.avatarUrl, size = 32.dp)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(m.displayName, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                        Text(
                                            m.userId,
                                            fontSize = 11.sp,
                                            color = Color(0xFF8696A0),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    when (m.role) {
                                        "CREATOR", "ADMINISTRATOR" -> Text(
                                            "Admin", fontSize = 11.sp, color = WhatsAppGreenPrimary
                                        )
                                        "MODERATOR" -> Text(
                                            "Mod", fontSize = 11.sp, color = Color(0xFF8696A0)
                                        )
                                    }
                                    if (isAdmin && m.role != "CREATOR") {
                                        Box {
                                            IconButton(onClick = { memberMenuFor = m.userId }) {
                                                Icon(
                                                    Icons.Default.MoreVert,
                                                    contentDescription = "Opciones de miembro",
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                            DropdownMenu(
                                                expanded = memberMenuFor == m.userId,
                                                onDismissRequest = { memberMenuFor = null }
                                            ) {
                                                if (m.role != "ADMINISTRATOR") {
                                                    DropdownMenuItem(
                                                        text = { Text("Hacer administrador") },
                                                        onClick = {
                                                            viewModel.setMemberRole(m.userId, 100L)
                                                            memberMenuFor = null
                                                        }
                                                    )
                                                }
                                                if (m.role != "MODERATOR") {
                                                    DropdownMenuItem(
                                                        text = { Text("Hacer moderador") },
                                                        onClick = {
                                                            viewModel.setMemberRole(m.userId, 50L)
                                                            memberMenuFor = null
                                                        }
                                                    )
                                                }
                                                if (m.role != "USER") {
                                                    DropdownMenuItem(
                                                        text = { Text("Quitar rol") },
                                                        onClick = {
                                                            viewModel.setMemberRole(m.userId, 0L)
                                                            memberMenuFor = null
                                                        }
                                                    )
                                                }
                                                DropdownMenuItem(
                                                    text = { Text("Eliminar del grupo", color = Color(0xFFE53935)) },
                                                    onClick = {
                                                        viewModel.kickMember(m.userId)
                                                        memberMenuFor = null
                                                    }
                                                )
                                                DropdownMenuItem(
                                                    text = { Text("Bloquear (ban)", color = Color(0xFFE53935)) },
                                                    onClick = {
                                                        viewModel.banMember(m.userId)
                                                        memberMenuFor = null
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Per-room notifications (push rules) — like Element's
                    // "All messages / Mentions & keywords / Mute".
                    val notifMode by viewModel.roomNotificationMode.collectAsStateWithLifecycle()
                    LaunchedEffect(Unit) { viewModel.loadRoomNotificationMode() }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        "Notificaciones",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                    listOf(
                        org.matrix.rustcomponents.sdk.RoomNotificationMode.ALL_MESSAGES to "Todos los mensajes",
                        org.matrix.rustcomponents.sdk.RoomNotificationMode.MENTIONS_AND_KEYWORDS_ONLY to "Solo menciones y palabras clave",
                        org.matrix.rustcomponents.sdk.RoomNotificationMode.MUTE to "Silenciada"
                    ).forEach { (mode, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.setRoomNotificationMode(mode) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (notifMode == mode) "●" else "○",
                                color = if (notifMode == mode) WhatsAppGreenPrimary else Color(0xFF8696A0),
                                fontSize = 14.sp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    TextButton(onClick = { reportRoomOpen = true }) {
                        Text("Reportar sala", color = Color(0xFFE53935), fontSize = 13.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showRoomInfo = false }) { Text("Cerrar") }
            }
        )
    }

    // --- Report room dialog ---
    if (reportRoomOpen) {
        var reason by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { reportRoomOpen = false },
            title = { Text("Reportar sala", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    placeholder = { Text("Motivo del reporte") },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel?.reportRoom(reason.ifBlank { "Sala inapropiada" })
                        reportRoomOpen = false
                    }
                ) { Text("Reportar", color = Color(0xFFE53935)) }
            },
            dismissButton = {
                TextButton(onClick = { reportRoomOpen = false }) { Text("Cancelar") }
            }
        )
    }

    // --- Poll creation dialog ---
    if (showPollDialog) {
        var question by remember { mutableStateOf("") }
        var options by remember { mutableStateOf(listOf("", "")) }
        var allowMultiple by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { showPollDialog = false },
            title = { Text("Crear encuesta") },
            text = {
                Column {
                    OutlinedTextField(
                        value = question,
                        onValueChange = { question = it },
                        label = { Text("Pregunta") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    options.forEachIndexed { index, option ->
                        OutlinedTextField(
                            value = option,
                            onValueChange = { value ->
                                options = options.toMutableList().also { it[index] = value }
                                if (index == options.lastIndex && value.isNotBlank() && options.size < 10) {
                                    options = options + ""
                                }
                            },
                            label = { Text("Respuesta ${index + 1}") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Checkbox(
                            checked = allowMultiple,
                            onCheckedChange = { allowMultiple = it }
                        )
                        Text("Permitir varias respuestas", fontSize = 13.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val answers = options.map { it.trim() }.filter { it.isNotBlank() }.distinct()
                        if (question.isNotBlank() && answers.size >= 2) {
                            viewModel?.sendPoll(question.trim(), answers, allowMultiple)
                            showPollDialog = false
                        }
                    }
                ) { Text("Crear") }
            },
            dismissButton = {
                TextButton(onClick = { showPollDialog = false }) { Text("Cancelar") }
            }
        )
    }

    // --- Invite contact dialog ---
    if (showContactPicker) {
        var inviteId by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showContactPicker = false },
            title = { Text("Invitar a la sala") },
            text = {
                Column {
                    Text("Introduce el Matrix ID del usuario:", fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = inviteId,
                        onValueChange = { inviteId = it },
                        placeholder = { Text("@usuario:servidor.org") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (inviteId.trim().startsWith("@") && inviteId.contains(":")) {
                            viewModel?.inviteUserToCurrentRoom(inviteId.trim())
                            showContactPicker = false
                        }
                    }
                ) { Text("Invitar") }
            },
            dismissButton = {
                TextButton(onClick = { showContactPicker = false }) { Text("Cancelar") }
            }
        )
    }
}

/** Opens a resolved attachment file in an external app via FileProvider. */
private fun openAttachment(context: android.content.Context, path: String?, mime: String) {
    if (path == null) return
    try {
        val file = java.io.File(path)
        val uri = androidx.core.content.FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        context.startActivity(
            android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        )
    } catch (_: Exception) {
        android.widget.Toast.makeText(context, "No hay una aplicación para abrir el adjunto", android.widget.Toast.LENGTH_SHORT).show()
    }
}

/** WhatsApp-style inline voice/audio player: play/pause + progress + duration. */
@Composable
private fun AudioAttachmentBubble(
    path: String?,
    filename: String,
    isOutgoing: Boolean,
    isDark: Boolean,
    onOpenExternal: () -> Unit
) {
    var isPlaying by remember { mutableStateOf(false) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var speed by remember { mutableFloatStateOf(1f) }
    // ExoPlayer (Media3) — prepare() is fully async, unlike MediaPlayer whose
    // native lock can deadlock the main thread when release() races with a
    // stuck prepare() under codec load (this caused the chat freeze/ANR).
    val context = androidx.compose.ui.platform.LocalContext.current
    val player = remember {
        androidx.media3.exoplayer.ExoPlayer.Builder(context).build()
    }

    DisposableEffect(Unit) {
        val listener = object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    androidx.media3.common.Player.STATE_READY ->
                        durationMs = player.duration.coerceAtLeast(0L)
                    androidx.media3.common.Player.STATE_ENDED -> {
                        isPlaying = false
                        positionMs = 0L
                        player.seekTo(0)
                    }
                }
            }
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    LaunchedEffect(path) {
        if (path == null) return@LaunchedEffect
        player.setMediaItem(
            androidx.media3.common.MediaItem.fromUri(
                android.net.Uri.fromFile(java.io.File(path))
            )
        )
        player.prepare()
    }
    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            positionMs = player.currentPosition.coerceAtLeast(0L)
            kotlinx.coroutines.delay(150)
        }
    }

    fun toggle() {
        try {
            if (player.isPlaying) {
                player.pause()
            } else {
                if (player.playbackState == androidx.media3.common.Player.STATE_ENDED) {
                    player.seekTo(0)
                    positionMs = 0L
                }
                player.setPlaybackSpeed(speed)
                player.play()
            }
        } catch (_: Exception) {
        }
    }

    fun cycleSpeed() {
        speed = when {
            speed < 1.25f -> 1.5f
            speed < 1.75f -> 2f
            else -> 1f
        }
        try {
            player.setPlaybackSpeed(speed)
        } catch (_: Exception) {
        }
    }

    val textColor = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(
            shape = CircleShape,
            color = WhatsAppGreenPrimary,
            modifier = Modifier
                .size(38.dp)
                .clickable(enabled = path != null) { toggle() }
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (isPlaying) "Pausar" else "Reproducir",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Column(
            modifier = Modifier
                .weight(1f)
                .clickable { onOpenExternal() }
        ) {
            LinearProgressIndicator(
                progress = {
                    if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
                },
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                color = WhatsAppGreenPrimary,
                trackColor = if (isDark) Color(0xFF3B4A54) else Color(0xFFD5DBDB)
            )
            Spacer(modifier = Modifier.height(3.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = formatDuration(if (positionMs > 0) positionMs else durationMs),
                    fontSize = 11.sp,
                    color = Color(0xFF8696A0)
                )
                Spacer(modifier = Modifier.width(6.dp))
                // WhatsApp-style playback speed toggle: 1x → 1.5x → 2x → 1x
                Text(
                    text = if (speed == kotlin.math.floor(speed)) "${speed.toInt()}x" else "${speed}x",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = WhatsAppGreenPrimary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { cycleSpeed() }
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                )
                if (filename.isNotBlank() && filename != "Adjunto") {
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = filename,
                        fontSize = 11.sp,
                        color = Color(0xFF8696A0),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

private fun formatDuration(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}

/** Gets the device location and calls back with lat/lon. Requests permission
 * on the fly; falls back to a toast if unavailable. */
private fun shareLocation(context: android.content.Context, onLocation: (Double, Double) -> Unit) {
    val lm = context.getSystemService(android.content.Context.LOCATION_SERVICE) as? android.location.LocationManager
    try {
        val granted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
            androidx.core.content.ContextCompat.checkSelfPermission(
                context, android.Manifest.permission.ACCESS_COARSE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!granted) {
            android.widget.Toast.makeText(
                context,
                "Concede permiso de ubicación a TqApp en ajustes para compartir ubicación",
                android.widget.Toast.LENGTH_LONG
            ).show()
            return
        }
        val loc = lm?.getProviders(true)?.firstNotNullOfOrNull { lm.getLastKnownLocation(it) }
        if (loc != null) {
            onLocation(loc.latitude, loc.longitude)
        } else {
            // No cached fix — request a fresh one (single update).
            val provider = lm?.getProviders(true)?.firstOrNull()
            if (provider == null) {
                android.widget.Toast.makeText(context, "Ubicación no disponible", android.widget.Toast.LENGTH_SHORT).show()
                return
            }
            var delivered = false
            val listener = object : android.location.LocationListener {
                override fun onLocationChanged(l: android.location.Location) {
                    if (delivered) return
                    delivered = true
                    lm.removeUpdates(this)
                    onLocation(l.latitude, l.longitude)
                }
                @Deprecated("deprecated")
                override fun onStatusChanged(p: String?, s: Int, e: android.os.Bundle?) {}
            }
            lm.requestLocationUpdates(provider, 0L, 0f, listener, android.os.Looper.getMainLooper())
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (!delivered) {
                    delivered = true
                    try { lm.removeUpdates(listener) } catch (_: Exception) {}
                    android.widget.Toast.makeText(context, "Ubicación no disponible", android.widget.Toast.LENGTH_SHORT).show()
                }
            }, 15000)
            android.widget.Toast.makeText(context, "Obteniendo ubicación…", android.widget.Toast.LENGTH_SHORT).show()
        }
    } catch (e: SecurityException) {
        android.widget.Toast.makeText(context, "Permiso de ubicación denegado", android.widget.Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun EmojiPanel(
    onEmojiClick: (String) -> Unit,
    onSelectGif: () -> Unit,
    onSelectSticker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val emojis = listOf(
        "😀", "�", "😄", "�😁", "�", "😅", "�😂", "🤣", "🥲", "☺️", "�", "�", "�", "�", "😉", "�",
        "�", "🥰", "�", "�", "�", "😚", "�", "�", "�", "�", "�", "🤨", "🧐", "🤓", "😎", "🥸",
        "🤩", "�", "😏", "�", "�", "�", "�", "�", "�", "☹️", "�", "😖", "�", "�", "🥺", "😢",
        "�", "�", "�", "�", "🤬", "🤯", "�", "�", "🥶", "�", "�", "�", "�", "😓", "🤗", "🤔",
        "🤭", "🤫", "🤥", "�", "�", "�", "�", "�", "�", "�", "😧", "�", "�", "🥱", "�", "�",
        "😪", "�", "�", "🥴", "🤢", "🤮", "�", "😷", "🤒", "🤕", "😈", "👿", "👻", "�", "☠️", "👽",
        "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "�",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
        "🔥", "✨", "🎉", "🎊", "🎈", "🎁", "🏆", "⚽", "🏀", "🎮", "🚗", "✈️", "☀️", "🌙", "⭐", "🌈"
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(280.dp)
            .background(if (isSystemInDarkTheme()) Color(0xFF1F2C34) else Color.White)
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("😀" to "Emoji", "GIF" to "GIF", "▣" to "Stickers").forEachIndexed { index, item ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { selectedTab = index }
                        .padding(vertical = 10.dp)
                ) {
                    Text(item.first, fontSize = if (index == 0) 22.sp else 16.sp, fontWeight = FontWeight.Bold)
                    Text(item.second, fontSize = 11.sp, color = if (selectedTab == index) WhatsAppGreenPrimary else Color(0xFF8696A0))
                }
            }
        }
        when (selectedTab) {
            0 -> androidx.compose.foundation.lazy.grid.LazyVerticalGrid(
                columns = androidx.compose.foundation.lazy.grid.GridCells.Fixed(8),
                modifier = Modifier.fillMaxSize()
            ) {
                gridItems(emojis) { emoji ->
                    Text(
                        text = emoji,
                        fontSize = 24.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.clickable { onEmojiClick(emoji) }.padding(6.dp)
                    )
                }
            }
            1 -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                TextButton(onClick = onSelectGif) { Text("Seleccionar GIF del teléfono") }
            }
            else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                TextButton(onClick = onSelectSticker) { Text("Seleccionar sticker del teléfono") }
            }
        }
    }
}

@Composable
fun AttachmentOption(
    icon: ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable { onClick() }
            .padding(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = label, tint = Color.White)
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatBubble(
    message: MessageEntity,
    isGroup: Boolean = false,
    onResolveMedia: ((String, String, String, (String?) -> Unit) -> Unit)? = null,
    callActive: Boolean = false,
    onJoinCall: (() -> Unit)? = null,
    onVotePoll: ((MessageEntity, Int) -> Unit)? = null,
    onLoadPollVoters: ((MessageEntity, (List<String>) -> Unit) -> Unit)? = null,
    onLongPress: ((MessageEntity) -> Unit)? = null,
    onToggleReaction: ((MessageEntity, String) -> Unit)? = null
) {
    val isDark = isSystemInDarkTheme()
    val isOutgoing = message.isOutgoing
    val context = androidx.compose.ui.platform.LocalContext.current

    var localMediaPath by remember(message.id) { mutableStateOf<String?>(null) }
    LaunchedEffect(message.id, message.mediaUrl) {
        val url = message.mediaUrl ?: return@LaunchedEffect
        if (localMediaPath != null) return@LaunchedEffect
        if (url.startsWith("/") && java.io.File(url).exists()) {
            // Local echo of a just-sent attachment — the file is already here.
            localMediaPath = url
        } else if (onResolveMedia != null && !url.contains("send-queue.localhost")) {
            val source = message.mediaSourceJson ?: url
            val mimeType = when (message.messageType) {
                "IMAGE" -> "image/jpeg"
                "AUDIO" -> "audio/mp4"
                "VIDEO" -> "video/mp4"
                else -> "application/octet-stream"
            }
            onResolveMedia(source, mimeType, message.content.ifBlank { "media" }) { path ->
                localMediaPath = path
            }
        }
    }

    val timeFormatter = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val formattedTime = remember(message.timestamp) { timeFormatter.format(Date(message.timestamp)) }

    val bubbleColor = when {
        isOutgoing -> if (isDark) WhatsAppGreenBubbleDark else WhatsAppGreenLight
        else -> if (isDark) WhatsAppBubbleIncomingDark else Color.White
    }

    val alignment = if (isOutgoing) Alignment.CenterEnd else Alignment.CenterStart
    val shape = if (isOutgoing) {
        RoundedCornerShape(12.dp, 2.dp, 12.dp, 12.dp)
    } else {
        RoundedCornerShape(2.dp, 12.dp, 12.dp, 12.dp)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = if (isOutgoing) 48.dp else 0.dp,
                end = if (isOutgoing) 0.dp else 48.dp
            ),
        contentAlignment = alignment
    ) {
        Column(horizontalAlignment = if (isOutgoing) Alignment.End else Alignment.Start) {
        Surface(
            shape = shape,
            color = bubbleColor,
            shadowElevation = 1.dp,
            modifier = Modifier.combinedClickable(
                onClick = {},
                onLongClick = { onLongPress?.invoke(message) }
            )
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                // Sender name in Group chats
                if (!isOutgoing && isGroup) {
                    Text(
                        text = message.senderName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = Color(0xFF1E88E5),
                        modifier = Modifier.padding(bottom = 2.dp)
                    )
                }

                // Quoted message (reply) — WhatsApp style left bar + preview
                if (message.replyToText != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 4.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                (if (isDark) Color(0xFF111B21) else Color(0xFFE9EDEF))
                                    .copy(alpha = 0.5f)
                            )
                            .padding(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(4.dp)
                                .height(32.dp)
                                .background(WhatsAppGreenPrimary, RoundedCornerShape(2.dp))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Column {
                            Text(
                                text = message.replyToSender ?: "",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = WhatsAppGreenPrimary
                            )
                            Text(
                                text = message.replyToText,
                                fontSize = 12.sp,
                                color = Color(0xFF8696A0),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                if (message.isDeleted) {
                    Text(
                        text = "🚫 Este mensaje fue eliminado",
                        fontSize = 15.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        color = Color(0xFF8696A0)
                    )
                } else when (message.messageType) {
                    "IMAGE" -> {
                        val path = localMediaPath
                        if (path != null) {
                            coil.compose.AsyncImage(
                                model = java.io.File(path),
                                contentDescription = message.content,
                                modifier = Modifier
                                    .fillMaxWidth(0.62f)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop
                            )
                        } else {
                            Text("📷 " + (message.content.ifBlank { "Imagen" }), fontSize = 15.sp,
                                color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21))
                        }
                    }
                    "CALL" -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = androidx.compose.foundation.shape.CircleShape,
                                color = WhatsAppGreenPrimary.copy(alpha = 0.15f),
                                modifier = Modifier.size(34.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = if (message.callIsVideo) Icons.Default.Videocam else Icons.Default.Call,
                                        contentDescription = null,
                                        tint = WhatsAppGreenPrimary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = if (message.callIsVideo) "Videollamada" else "Llamada de voz",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21)
                                )
                                if (callActive && onJoinCall != null) {
                                    Text(
                                        text = "Toca para unirte",
                                        fontSize = 12.sp,
                                        color = WhatsAppGreenPrimary,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier
                                            .padding(top = 2.dp)
                                            .clickable { onJoinCall() }
                                    )
                                }
                            }
                        }
                    }
                    "AUDIO" -> {
                        AudioAttachmentBubble(
                            path = localMediaPath,
                            filename = message.content,
                            isOutgoing = isOutgoing,
                            isDark = isDark,
                            onOpenExternal = { openAttachment(context, localMediaPath, "audio/*") }
                        )
                    }
                    "POLL" -> {
                        var votedIndex by remember(message.id) { mutableStateOf<Int?>(null) }
                        var voters by remember(message.id) { mutableStateOf<List<String>?>(null) }
                        LaunchedEffect(message.id, votedIndex) {
                            onLoadPollVoters?.invoke(message) { voters = it }
                        }
                        Column {
                            Text(
                                text = "📊 ${message.pollQuestion ?: message.content}",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            message.pollAnswers.forEachIndexed { index, answer ->
                                val selected = votedIndex == index
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 2.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(
                                            if (selected) WhatsAppGreenPrimary.copy(alpha = 0.35f)
                                            else WhatsAppGreenPrimary.copy(alpha = 0.10f)
                                        )
                                        .clickable {
                                            votedIndex = index
                                            onVotePoll?.invoke(message, index)
                                        }
                                        .padding(horizontal = 10.dp, vertical = 8.dp)
                                ) {
                                    Icon(
                                        imageVector = if (selected) Icons.Default.CheckCircle else Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = if (selected) WhatsAppGreenPrimary else Color(0xFF8696A0),
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = answer,
                                        fontSize = 14.sp,
                                        color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21)
                                    )
                                }
                            }
                            val voterNames = voters
                            if (!voterNames.isNullOrEmpty()) {
                                Text(
                                    text = "${voterNames.size} voto(s): ${voterNames.joinToString(", ")}",
                                    fontSize = 11.sp,
                                    color = Color(0xFF8696A0),
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                            if (message.pollMaxSelections > 1) {
                                Text(
                                    text = "Puedes elegir hasta ${message.pollMaxSelections} opciones",
                                    fontSize = 11.sp,
                                    color = Color(0xFF8696A0),
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                        }
                    }
                    "LOCATION" -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable {
                                try {
                                    context.startActivity(
                                        android.content.Intent(
                                            android.content.Intent.ACTION_VIEW,
                                            android.net.Uri.parse(message.locationGeoUri)
                                        )
                                    )
                                } catch (_: Exception) {
                                    android.widget.Toast.makeText(context, "No hay app de mapas instalada", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Surface(
                                shape = androidx.compose.foundation.shape.CircleShape,
                                color = WhatsAppGreenPrimary.copy(alpha = 0.15f),
                                modifier = Modifier.size(40.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("📍", fontSize = 18.sp)
                                }
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "Ubicación compartida",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21)
                                )
                                Text(
                                    text = message.locationGeoUri?.removePrefix("geo:") ?: "",
                                    fontSize = 12.sp,
                                    color = Color(0xFF8696A0)
                                )
                            }
                        }
                    }
                    "VIDEO", "DOCUMENT" -> {
                        val icon = if (message.messageType == "VIDEO") "🎬" else "📄"
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable(enabled = localMediaPath != null) {
                                openAttachment(
                                    context,
                                    localMediaPath,
                                    if (message.messageType == "VIDEO") "video/*" else "application/octet-stream"
                                )
                            }
                        ) {
                            Text(icon, fontSize = 20.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(message.content.ifBlank { "Adjunto" }, fontSize = 14.sp,
                                color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                                maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    else -> {
                        Text(
                            text = message.content,
                            fontSize = 15.sp,
                            color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                            lineHeight = 20.sp
                        )
                    }
                }

                // Timestamp and check ticks
                Row(
                    modifier = Modifier.align(Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (message.isPinned) {
                        Text("📌", fontSize = 10.sp, modifier = Modifier.padding(end = 3.dp, top = 2.dp))
                    }
                    if (message.isEdited) {
                        Text(
                            text = "editado",
                            fontSize = 11.sp,
                            color = Color(0xFF8696A0),
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            modifier = Modifier.padding(end = 4.dp, top = 2.dp)
                        )
                    }
                    Text(
                        text = formattedTime,
                        fontSize = 11.sp,
                        color = Color(0xFF8696A0),
                        modifier = Modifier.padding(end = 4.dp, top = 2.dp)
                    )
                    if (isOutgoing) {
                        WhatsAppTicks(status = message.status)
                    }
                }
            }
        }

        // Reactions row (emoji → count), WhatsApp-style chips under the bubble
        if (message.reactions.isNotEmpty()) {
            Row(
                modifier = Modifier.padding(top = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                message.reactions.forEach { r ->
                    Text(
                        text = "${r.emoji} ${r.count}",
                        fontSize = 12.sp,
                        color = if (isDark) Color(0xFFE9EDEF) else Color(0xFF111B21),
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (r.includesMe) WhatsAppGreenPrimary.copy(alpha = 0.25f)
                                else (if (isDark) Color(0xFF1F2C34) else Color.White)
                            )
                            .border(
                                1.dp,
                                if (r.includesMe) WhatsAppGreenPrimary else Color.Transparent,
                                RoundedCornerShape(12.dp)
                            )
                            .clickable { onToggleReaction?.invoke(message, r.emoji) }
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
        }
        }
    }
}
