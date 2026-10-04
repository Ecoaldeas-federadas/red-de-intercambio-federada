package com.example.ui.main

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.ContactEntity
import com.example.ui.WhatsAppMatrixViewModel
import com.example.ui.calls.CallsTab
import com.example.ui.calls.ElementCallScreen
import com.example.ui.calls.IncomingCallScreen
import com.example.ui.chats.ChatConversationScreen
import com.example.ui.chats.ChatsListTab
import com.example.ui.communities.CommunitiesTab
import com.example.ui.components.WhatsAppBottomNavigation
import com.example.ui.components.WhatsAppTab
import com.example.ui.components.WhatsAppTopBar
import com.example.ui.contacts.NewChatDialog
import com.example.ui.settings.ServerSettingsDialog
import com.example.ui.stories.FullScreenStoryViewer
import com.example.ui.stories.UpdatesTab
import com.example.ui.verification.VerificationScreen
import com.example.data.repository.VerificationUiState
import kotlinx.coroutines.launch
import org.matrix.rustcomponents.sdk.VerificationState

@Composable
fun MainScreen(viewModel: WhatsAppMatrixViewModel) {
    var currentTab by remember { mutableStateOf(WhatsAppTab.CHATS) }
    var showNewChatDialog by remember { mutableStateOf(false) }
    var showServerSettings by remember { mutableStateOf(false) }
    var showVerifyOptions by remember { mutableStateOf(false) }
    var showInvitesDialog by remember { mutableStateOf(false) }
    var showArchivedDialog by remember { mutableStateOf(false) }
    var showExploreRooms by remember { mutableStateOf(false) }
    var showCreateRoom by remember { mutableStateOf(false) }

    val session by viewModel.sessionState.collectAsStateWithLifecycle()
    val chats by viewModel.chatsState.collectAsStateWithLifecycle()
    val channels by viewModel.channelsState.collectAsStateWithLifecycle()
    val communities by viewModel.communitiesState.collectAsStateWithLifecycle()
    val contacts by viewModel.contactsState.collectAsStateWithLifecycle()
    val activeStories by viewModel.activeStoriesState.collectAsStateWithLifecycle()
    val myStories by viewModel.myStoriesState.collectAsStateWithLifecycle()
    val calls by viewModel.callsState.collectAsStateWithLifecycle()
    val isSyncing by viewModel.isSyncing.collectAsStateWithLifecycle()
    val invites by viewModel.invitesState.collectAsStateWithLifecycle()
    val archivedRooms by viewModel.archivedRoomsState.collectAsStateWithLifecycle()
    val publicRooms by viewModel.publicRooms.collectAsStateWithLifecycle()
    val searchingRooms by viewModel.searchingRooms.collectAsStateWithLifecycle()
    val verificationUi by viewModel.verificationUi.collectAsStateWithLifecycle()
    val deviceVerification by viewModel.deviceVerification.collectAsStateWithLifecycle()
    val backupState by viewModel.backupState.collectAsStateWithLifecycle()

    val currentRoomId by viewModel.currentRoomId.collectAsStateWithLifecycle()
    val currentRoom by viewModel.currentRoom.collectAsStateWithLifecycle()
    val currentMessages by viewModel.currentMessages.collectAsStateWithLifecycle()

    val activeCallSession by viewModel.activeCallSession.collectAsStateWithLifecycle()
    val incomingCall by viewModel.incomingCall.collectAsStateWithLifecycle()
    val viewingStory by viewModel.viewingStory.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val unreadTotal = remember(chats) { chats.sumOf { it.unreadCount } }

    // Surface repository errors (failed invites, network issues, ...) as snackbars
    LaunchedEffect(Unit) {
        viewModel.errorEvents.collect { message ->
            snackbarHostState.showSnackbar(message)
        }
    }

    // If chat is open, handle hardware back button to exit chat
    BackHandler(enabled = currentRoomId != null) {
        viewModel.closeChat()
    }

    if (currentRoomId != null) {
        ChatConversationScreen(
            room = currentRoom,
            messages = currentMessages,
            onBack = { viewModel.closeChat() },
            onSendMessage = { text -> viewModel.sendMessage(text) },
            onLoadMore = { viewModel.loadMoreHistory() },
            onStartCall = { roomId, isVideo, joinExisting ->
                viewModel.startCall(roomId, isVideo, joinExisting)
            },
            viewModel = viewModel
        )
    } else {
        Scaffold(
            topBar = {
                WhatsAppTopBar(
                    title = "TqApp",
                    serverName = session?.homeserverUrl?.removePrefix("https://")?.removePrefix("http://") ?: "matrix.org",
                    pendingInvites = invites.size,
                    onInvitesClick = { showInvitesDialog = true },
                    onCameraClick = {
                        scope.launch {
                            snackbarHostState.showSnackbar("Cámara Matrix lista para fotos y estados")
                        }
                    },
                    onSearchClick = {
                        showNewChatDialog = true
                    },
                    onNewGroupClick = {
                        showCreateRoom = true
                    },
                    onSyncClick = {
                        viewModel.refreshSync()
                        scope.launch {
                            snackbarHostState.showSnackbar("Sincronizando con Matrix...")
                        }
                    },
                    onServerSettingsClick = {
                        showServerSettings = true
                    },
                    onLogoutClick = {
                        viewModel.logout()
                    }
                )
            },
            bottomBar = {
                WhatsAppBottomNavigation(
                    selectedTab = currentTab,
                    unreadChatsCount = unreadTotal,
                    hasNewStories = activeStories.any { !it.isViewed && !it.isMine },
                    onTabSelected = { currentTab = it }
                )
            },
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (currentTab) {
                    WhatsAppTab.CHATS -> {
                        ChatsListTab(
                            rooms = chats,
                            stories = activeStories,
                            isSyncing = isSyncing,
                            onRefreshSync = { viewModel.refreshSync() },
                            onRoomClick = { roomId -> viewModel.openChat(roomId) },
                            onStoryClick = { story -> viewModel.openStory(story) },
                            onNewChatClick = { showNewChatDialog = true },
                            archivedCount = archivedRooms.size,
                            onArchivedClick = { showArchivedDialog = true }
                        )
                    }

                    WhatsAppTab.NOVEDADES -> {
                        UpdatesTab(
                            stories = activeStories,
                            myStories = myStories,
                            channels = channels,
                            onOpenStory = { group -> viewModel.openStoryGroup(group) },
                            onPostStory = { text, colorHex -> viewModel.postStory(text, colorHex) },
                            onPostMediaStory = { uri, caption -> viewModel.postMediaStory(uri, caption) },
                            onChannelClick = { roomId -> viewModel.openChat(roomId) },
                            onRefreshStories = { viewModel.refreshStories() },
                            myAvatarUrl = session?.avatarUrl,
                            myName = session?.displayName
                        )
                    }

                    WhatsAppTab.COMUNIDADES -> {
                        CommunitiesTab(
                            communities = communities,
                            onRoomClick = { roomId -> viewModel.openChat(roomId) },
                            onCreateCommunity = { name, topic, isPublic, avatarUri ->
                                viewModel.createCommunity(name, topic, isPublic, avatarUri)
                            }
                        )
                    }

                    WhatsAppTab.LLAMADAS -> {
                        CallsTab(
                            calls = calls,
                            onStartCall = { contactName, isVideo ->
                                viewModel.startCall(contactName, isVideo)
                            },
                            onNewCallClick = { showNewChatDialog = true }
                        )
                    }
                }

                // Incoming verification request: compact banner, not a modal
                // dialog, so it never covers the chat list.
                (verificationUi as? VerificationUiState.IncomingRequest)?.let { req ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Shield,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "${req.deviceDisplayName} quiere verificar este dispositivo",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { viewModel.cancelVerification() }) {
                                    Text("Rechazar", fontSize = 12.sp, color = Color(0xFFE53935))
                                }
                                TextButton(onClick = { viewModel.acceptVerificationRequest() }) {
                                    Text("Verificar", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Verification banner: nudge to verify this device (like Element)
                if (deviceVerification == VerificationState.UNVERIFIED &&
                    verificationUi == VerificationUiState.Idle
                ) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3C4))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showVerifyOptions = true }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = Color(0xFF856404),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Verifica este dispositivo para leer mensajes cifrados (pulsa aquí y acepta en tu otro teléfono)",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF856404)
                            )
                        }
                    }
                }
            }
        }
    }

    // New Chat / Select Contact Dialog
    if (showNewChatDialog) {
        NewChatDialog(
            contacts = contacts,
            onDismiss = { showNewChatDialog = false },
            onContactSelected = { contact: ContactEntity ->
                viewModel.createDirectChat(contact)
            },
            onNewGroupClick = {
                showNewChatDialog = false
                showCreateRoom = true
            },
            onExploreRoomsClick = {
                showExploreRooms = true
                viewModel.searchPublicRooms("")
            },
            onDirectMatrixIdChat = { mxid ->
                val tempContact = ContactEntity(
                    userId = mxid,
                    displayName = mxid.removePrefix("@").substringBefore(":")
                )
                viewModel.createDirectChat(tempContact)
            }
        )
    }

    // Group/room creation — Element "Create room" flow in WhatsApp skin
    if (showCreateRoom) {
        com.example.ui.rooms.CreateRoomDialog(
            contacts = contacts,
            onDismiss = { showCreateRoom = false },
            onCreate = { name, topic, isPublic, memberIds, avatarUri ->
                viewModel.createGroup(name, topic, isPublic, memberIds, avatarUri)
            }
        )
    }

    // Server Settings Dialog — Element-style settings (cuenta, notificaciones,
    // seguridad, preferencias). Loads live push-rule/account data on open.
    if (showServerSettings) {
        LaunchedEffect(Unit) { viewModel.loadSettingsData() }
        val notificationPrefs by viewModel.notificationPrefs.collectAsStateWithLifecycle()
        val ignoredUsers by viewModel.ignoredUsers.collectAsStateWithLifecycle()
        val sessionKeys by viewModel.sessionKeys.collectAsStateWithLifecycle()
        val sendTyping by viewModel.sendTypingEnabled.collectAsStateWithLifecycle()
        val sendReceipts by viewModel.sendReadReceiptsEnabled.collectAsStateWithLifecycle()
        val enterToSend by viewModel.enterToSend.collectAsStateWithLifecycle()
        ServerSettingsDialog(
            session = session,
            deviceVerification = deviceVerification,
            backupState = backupState,
            notificationPrefs = notificationPrefs,
            ignoredUsers = ignoredUsers,
            sessionKeys = sessionKeys,
            sendTypingEnabled = sendTyping,
            sendReadReceiptsEnabled = sendReceipts,
            enterToSend = enterToSend,
            onDismiss = { showServerSettings = false },
            onLogout = { viewModel.logout() },
            onUpdateDisplayName = { newName -> viewModel.updateDisplayName(newName) },
            onUpdateAvatarUrl = { newAvatar -> viewModel.updateAvatarUrl(newAvatar) },
            onUploadAvatar = { uri -> viewModel.uploadMyAvatar(uri) },
            onNotificationPrefsChange = { prefs -> viewModel.setNotificationPrefs(prefs) },
            onUnignoreUser = { uid -> viewModel.setUserIgnored(uid, false) },
            onToggleTyping = { viewModel.setSendTypingEnabled(it) },
            onToggleReceipts = { viewModel.setSendReadReceiptsEnabled(it) },
            onToggleEnterToSend = { viewModel.setEnterToSend(it) },
            onClearCache = { cb -> viewModel.clearLocalCaches(cb) },
            onAccountManagement = { devices, cb -> viewModel.getAccountManagementUrl(devices, cb) },
            onStartVerification = { viewModel.startDeviceVerification() },
            onEnableBackup = { viewModel.enableKeyBackup() },
            onRestoreKey = { key -> viewModel.restoreWithRecoveryKey(key) },
            onResetRecoveryKey = { callback -> viewModel.resetRecoveryKey(callback) }
        )
    }

    if (showExploreRooms) {
        var roomSearch by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showExploreRooms = false },
            title = { Text("Explorar salas públicas") },
            text = {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = roomSearch,
                            onValueChange = { roomSearch = it },
                            label = { Text("Nombre o tema") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { viewModel.searchPublicRooms(roomSearch) }) {
                            Text("Buscar")
                        }
                    }
                    Spacer(modifier = Modifier.size(8.dp))
                    if (searchingRooms) {
                        Text("Buscando en el directorio Matrix…", color = MaterialTheme.colorScheme.primary)
                    } else if (publicRooms.isEmpty()) {
                        Text("No se encontraron salas públicas")
                    } else {
                        LazyColumn(modifier = Modifier.heightIn(max = 420.dp)) {
                            items(publicRooms, key = { it.roomId }) { publicRoom ->
                                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                                    Text(publicRoom.name, fontWeight = FontWeight.Bold)
                                    if (publicRoom.topic.isNotBlank()) {
                                        Text(publicRoom.topic, fontSize = 12.sp, maxLines = 2)
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("${publicRoom.numJoinedMembers} miembros", fontSize = 12.sp)
                                        TextButton(onClick = {
                                            viewModel.joinPublicRoom(publicRoom.alias ?: publicRoom.roomId)
                                        }) { Text("Unirme") }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showExploreRooms = false }) { Text("Cerrar") }
            }
        )
    }

    // Pending room invites dialog (opened from the top-bar badge)
    if (showInvitesDialog) {
        AlertDialog(
            onDismissRequest = { showInvitesDialog = false },
            title = { Text("Invitaciones (${invites.size})") },
            text = {
                Column {
                    if (invites.isEmpty()) {
                        Text("No tienes invitaciones pendientes.", fontSize = 13.sp, color = Color(0xFF667781))
                    } else {
                        invites.forEach { inv ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = inv.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    maxLines = 1,
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(onClick = {
                                    viewModel.rejectInvite(inv.roomId)
                                    if (invites.size <= 1) showInvitesDialog = false
                                }) {
                                    Text("Rechazar", fontSize = 12.sp, color = Color(0xFFE53935))
                                }
                                TextButton(onClick = {
                                    viewModel.acceptInvite(inv.roomId)
                                    if (invites.size <= 1) showInvitesDialog = false
                                }) {
                                    Text("Unirme", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            TextButton(onClick = {
                                viewModel.rejectAllInvites()
                                showInvitesDialog = false
                            }) {
                                Text("Rechazar todas", fontSize = 12.sp, color = Color(0xFFE53935))
                            }
                            TextButton(onClick = {
                                viewModel.acceptAllInvites()
                                showInvitesDialog = false
                            }) {
                                Text("Aceptar todas", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showInvitesDialog = false }) { Text("Cerrar") }
            }
        )
    }

    // Archived conversations — obsolete DM rooms (peer left or superseded by
    // a newer DM). Tap to open the room and read its history.
    if (showArchivedDialog) {
        AlertDialog(
            onDismissRequest = { showArchivedDialog = false },
            title = { Text("Archivados (${archivedRooms.size})") },
            text = {
                Column {
                    if (archivedRooms.isEmpty()) {
                        Text("No tienes conversaciones archivadas.", fontSize = 13.sp, color = Color(0xFF667781))
                    } else {
                        Text(
                            "Conversaciones antiguas que fueron reemplazadas por una sala nueva.",
                            fontSize = 12.sp, color = Color(0xFF667781)
                        )
                        archivedRooms.forEach { room ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        showArchivedDialog = false
                                        viewModel.openChat(room.roomId)
                                    }
                                    .padding(vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = room.name,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        maxLines = 1
                                    )
                                    Text(
                                        text = room.lastMessage.ifBlank { "Sala obsoleta" },
                                        fontSize = 12.sp,
                                        color = Color(0xFF667781),
                                        maxLines = 1
                                    )
                                }
                                Text("Ver historial", fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showArchivedDialog = false }) { Text("Cerrar") }
            }
        )
    }

    // Verification options dialog: how to verify this device
    if (showVerifyOptions) {
        var recoveryKeyInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showVerifyOptions = false },
            title = { Text("Verificar este dispositivo") },
            text = {
                Column {
                    Text(
                        text = "La verificación permite leer mensajes cifrados en todos tus dispositivos.",
                        fontSize = 13.sp,
                        color = Color(0xFF667781)
                    )
                    Spacer(modifier = Modifier.padding(6.dp))
                    TextButton(
                        onClick = {
                            showVerifyOptions = false
                            viewModel.startDeviceVerification()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Comparar emojis con otro dispositivo", color = MaterialTheme.colorScheme.primary)
                    }
                    TextButton(
                        onClick = {
                            showVerifyOptions = false
                            viewModel.startUserVerification()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Verificar otro dispositivo desde este", color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(modifier = Modifier.padding(4.dp))
                    OutlinedTextField(
                        value = recoveryKeyInput,
                        onValueChange = { recoveryKeyInput = it },
                        label = { Text("Clave de recuperación", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    TextButton(
                        onClick = {
                            if (recoveryKeyInput.isNotBlank()) {
                                viewModel.restoreWithRecoveryKey(recoveryKeyInput)
                                showVerifyOptions = false
                            }
                        },
                        enabled = recoveryKeyInput.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Verificar con clave de recuperación", color = MaterialTheme.colorScheme.primary)
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showVerifyOptions = false }) { Text("Cancelar") }
            }
        )
    }

    // Device verification dialog (SAS emojis)
    VerificationScreen(
        state = verificationUi,
        onAcceptRequest = { viewModel.acceptVerificationRequest() },
        onDeclineRequest = { viewModel.cancelVerification() },
        onApproveEmojis = { viewModel.approveVerificationEmojis() },
        onDeclineEmojis = { viewModel.declineVerificationEmojis() },
        onCancel = { viewModel.cancelVerification() },
        onDismiss = { viewModel.dismissVerification() }
    )

    // Active Full-screen Story Viewer (multi-story, auto-advances groups)
    viewingStory?.let { viewing ->
        key(viewing.groupIndex) {
            FullScreenStoryViewer(
                stories = viewing.groups[viewing.groupIndex],
                onFinished = { viewModel.advanceStoryGroup() },
                onClose = { viewModel.closeStory() },
                onReply = { reply ->
                    scope.launch {
                        snackbarHostState.showSnackbar("Respuesta enviada")
                    }
                },
                onViewed = { story -> viewModel.markStoryViewed(story) }
            )
        }
    }

    // Active Call Screen Modal (real MatrixRTC via Element Call embedded widget)
    activeCallSession?.let { session ->
        ElementCallScreen(
            session = session,
            onClose = { viewModel.endCall() }
        )
    }

    // Incoming call screen (MatrixRTC ring detected via room info)
    incomingCall?.let { incoming ->
        IncomingCallScreen(
            incoming = incoming,
            onAnswer = { viewModel.answerIncomingCall() },
            onDecline = { viewModel.declineIncomingCall() }
        )
    }
}
