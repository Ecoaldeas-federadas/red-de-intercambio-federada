package com.example.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.AppDatabase
import com.example.data.local.CallEntity
import com.example.data.local.StoryEntity
import com.example.data.matrix.MatrixServer
import com.example.data.matrix.MatrixServersConfig
import com.example.data.matrix.MatrixSessionManager
import com.example.data.model.ContactEntity
import com.example.data.model.MessageEntity
import com.example.data.model.RoomEntity
import com.example.data.model.UserSessionEntity
import com.example.data.repository.AuthResult
import com.example.data.repository.MatrixRepository
import com.example.data.repository.VerificationUiState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.matrix.rustcomponents.sdk.BackupState
import org.matrix.rustcomponents.sdk.VerificationState

data class ActiveCallInfo(
    val contactName: String,
    val isVideo: Boolean,
    val durationSeconds: Int = 0,
    val isMuted: Boolean = false,
    val isSpeakerOn: Boolean = false
)

class WhatsAppMatrixViewModel(application: Application) : AndroidViewModel(application) {

    private val database = (application as com.example.TqApp).database
    private val sessionManager = (application as com.example.TqApp).sessionManager
    val repository = (application as com.example.TqApp).repository

    // Proposed homeservers list (allows adding custom servers at runtime)
    private val _serversList = MutableStateFlow(MatrixServersConfig.PROPOSED_SERVERS)
    val serversList: StateFlow<List<MatrixServer>> = _serversList.asStateFlow()

    private val _selectedServer = MutableStateFlow(MatrixServersConfig.getDefaultServer())
    val selectedServer: StateFlow<MatrixServer> = _selectedServer.asStateFlow()

    val isSyncing: StateFlow<Boolean> = repository.isSyncing
    val errorEvents: SharedFlow<String> = repository.errorEvents
    val verificationUi: StateFlow<VerificationUiState> = repository.verificationUi
    val deviceVerification: StateFlow<VerificationState> = repository.deviceVerification
    val backupState: StateFlow<BackupState> = repository.backupState

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    init {
        // Session restore + sync start is owned by TqApp (Application) so it
        // also runs when the process was started by the service, not only
        // when this UI-scoped ViewModel exists.

        // Auto-answer when the user taps "Contestar" on the call notification.
        viewModelScope.launch {
            repository.autoAnswerCall.collect { roomId ->
                if (roomId != null && repository.incomingCall.value != null) {
                    repository.consumeAutoAnswer()
                    answerIncomingCall()
                }
            }
        }

        // Open the room a message notification was tapped on.
        viewModelScope.launch {
            repository.pendingOpenRoom.collect { roomId ->
                if (roomId != null) {
                    repository.consumePendingOpenRoom()
                    openChat(roomId)
                }
            }
        }

    }

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    val sessionState: StateFlow<UserSessionEntity?> = repository.sessionFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = null
    )

    val chatsState: StateFlow<List<RoomEntity>> = repository.roomsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val invitesState: StateFlow<List<RoomEntity>> = repository.invitesFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val archivedRoomsState: StateFlow<List<RoomEntity>> = repository.archivedRoomsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val channelsState: StateFlow<List<RoomEntity>> = repository.channelsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val communitiesState: StateFlow<List<RoomEntity>> = repository.communitiesFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val contactsState: StateFlow<List<ContactEntity>> = repository.contactsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val activeStoriesState: StateFlow<List<StoryEntity>> = repository.activeStoriesFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val myStoriesState: StateFlow<List<StoryEntity>> = repository.myStoriesFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val callsState: StateFlow<List<CallEntity>> = repository.callsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Current open chat conversation (fed by the SDK Timeline)
    private val _currentRoomId = MutableStateFlow<String?>(null)
    val currentRoomId: StateFlow<String?> = _currentRoomId.asStateFlow()

    init {
        // Read receipts: while a chat is open, keep marking the timeline as
        // read so the other side sees the double check (m.read). Declared
        // AFTER _currentRoomId — field init order matters (NPE otherwise).
        viewModelScope.launch {
            repository.currentMessages.collect { msgs ->
                val roomId = _currentRoomId.value ?: return@collect
                if (!_sendReadReceiptsEnabled.value) return@collect
                if (msgs.isNotEmpty()) repository.markTimelineRead(roomId)
            }
        }
    }

    val currentRoom: StateFlow<RoomEntity?> = repository.currentRoom
    val currentMessages: StateFlow<List<MessageEntity>> = repository.currentMessages

    // Active real MatrixRTC / Element Call session (WebView-backed widget)
    private val _activeCallSession = MutableStateFlow<MatrixRepository.ElementCallSession?>(null)
    val activeCallSession: StateFlow<MatrixRepository.ElementCallSession?> = _activeCallSession.asStateFlow()
    private var callStartedAt: Long = 0L
    private var pendingCallIsVideo: Boolean = false

    // Incoming MatrixRTC call detected by the repository (ring)
    val incomingCall: StateFlow<MatrixRepository.IncomingCallInfo?> = repository.incomingCall

    // Story viewer dialog
    /** Stories being viewed: ordered groups (mine first, then contacts by
     * most recent) + which group is on screen — the viewer can auto-advance
     * to the next contact when a group finishes, like WhatsApp. */
    data class StoryViewing(
        val groups: List<List<StoryEntity>>,
        val groupIndex: Int
    )

    private val _viewingStory = MutableStateFlow<StoryViewing?>(null)
    val viewingStory: StateFlow<StoryViewing?> = _viewingStory.asStateFlow()

    // Interactive Authentication (reCAPTCHA) challenge state
    private val _recaptchaChallenge = MutableStateFlow<RecaptchaChallengeState?>(null)
    val recaptchaChallenge: StateFlow<RecaptchaChallengeState?> = _recaptchaChallenge.asStateFlow()

    fun selectServer(server: MatrixServer) {
        _selectedServer.value = server
        _authError.value = null
    }

    fun addCustomServer(name: String, url: String) {
        val cleanUrl = MatrixServersConfig.cleanUrl(url)
        val customServer = MatrixServer(
            id = "custom_" + System.currentTimeMillis(),
            name = name.ifBlank { cleanUrl.removePrefix("https://").removePrefix("http://") },
            url = cleanUrl,
            description = "Servidor personalizado",
            isDefault = false,
            allowsPublicRegistration = true
        )
        _serversList.value = _serversList.value + customServer
        _selectedServer.value = customServer
    }

    fun clearAuthError() {
        _authError.value = null
    }

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _authError.value = "Por favor, introduce tu usuario y contraseña de Matrix"
            return
        }
        viewModelScope.launch {
            _authLoading.value = true
            _authError.value = null
            val result = repository.loginWithMatrix(
                serverUrl = _selectedServer.value.url,
                usernameInput = username,
                password = password
            )
            _authLoading.value = false
            if (result is AuthResult.Error) {
                _authError.value = result.message
            }
        }
    }

    fun register(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _authError.value = "Por favor, completa los campos requeridos para el registro"
            return
        }
        viewModelScope.launch {
            _authLoading.value = true
            _authError.value = null
            val result = repository.registerWithMatrix(
                serverUrl = _selectedServer.value.url,
                usernameInput = username,
                password = password
            )
            _authLoading.value = false
            when (result) {
                is AuthResult.Error -> {
                    _authError.value = result.message
                }
                is AuthResult.RequiresRecaptcha -> {
                    _recaptchaChallenge.value = RecaptchaChallengeState(
                        session = result.session,
                        publicKey = result.publicKey,
                        serverUrl = result.serverUrl,
                        username = result.username,
                        password = result.password
                    )
                }
                is AuthResult.Success -> {
                    _recaptchaChallenge.value = null
                }
            }
        }
    }

    fun completeRecaptcha(token: String) {
        val challenge = _recaptchaChallenge.value ?: return
        viewModelScope.launch {
            _authLoading.value = true
            _authError.value = null
            val result = repository.completeRecaptchaRegistration(
                serverUrl = challenge.serverUrl,
                username = challenge.username,
                password = challenge.password,
                session = challenge.session,
                recaptchaToken = token
            )
            _authLoading.value = false
            when (result) {
                is AuthResult.Error -> {
                    _authError.value = result.message
                }
                is AuthResult.RequiresRecaptcha -> {
                    // Retry with updated session if needed
                }
                is AuthResult.Success -> {
                    _recaptchaChallenge.value = null
                }
            }
        }
    }

    fun dismissRecaptcha() {
        _recaptchaChallenge.value = null
    }

    fun loginWithToken(token: String) {
        if (token.isBlank()) return
        viewModelScope.launch {
            _authLoading.value = true
            _authError.value = null
            val result = repository.loginWithMatrixToken(
                serverUrl = _selectedServer.value.url,
                token = token
            )
            _authLoading.value = false
            when (result) {
                is AuthResult.Error -> {
                    _authError.value = result.message
                }
                is AuthResult.Success -> {
                    _authError.value = null
                    _recaptchaChallenge.value = null
                }
                is AuthResult.RequiresRecaptcha -> {
                    _authError.value = "Verificación requerida"
                }
            }
        }
    }

    fun loginAsDemo(username: String = "usuario_matrix") {
        viewModelScope.launch {
            _authLoading.value = true
            repository.loginAsQuickDemo(
                chosenServerUrl = _selectedServer.value.url,
                username = username
            )
            _authLoading.value = false
        }
    }

    fun logout() {
        viewModelScope.launch {
            _currentRoomId.value = null
            repository.logout()
        }
    }

    fun refreshSync() {
        viewModelScope.launch {
            repository.refreshSync()
        }
    }

    fun openChat(roomId: String) {
        _currentRoomId.value = roomId
        viewModelScope.launch {
            repository.openRoom(roomId)
            if (_sendReadReceiptsEnabled.value) repository.markTimelineRead(roomId)
        }
    }

    // ---- Composer drafts (per-room, persisted like WhatsApp) ----

    private val draftsPrefs = application.getSharedPreferences(
        "composer_drafts", android.content.Context.MODE_PRIVATE
    )

    // ---- App preferences (Element's "Preferencias" section) ----

    private val appPrefs = application.getSharedPreferences(
        "app_prefs", android.content.Context.MODE_PRIVATE
    )

    private val _sendTypingEnabled = MutableStateFlow(appPrefs.getBoolean("send_typing", true))
    val sendTypingEnabled: StateFlow<Boolean> = _sendTypingEnabled.asStateFlow()
    private val _sendReadReceiptsEnabled = MutableStateFlow(appPrefs.getBoolean("send_receipts", true))
    val sendReadReceiptsEnabled: StateFlow<Boolean> = _sendReadReceiptsEnabled.asStateFlow()
    private val _enterToSend = MutableStateFlow(appPrefs.getBoolean("enter_to_send", false))
    val enterToSend: StateFlow<Boolean> = _enterToSend.asStateFlow()

    fun setSendTypingEnabled(v: Boolean) {
        appPrefs.edit().putBoolean("send_typing", v).apply()
        _sendTypingEnabled.value = v
    }

    fun setSendReadReceiptsEnabled(v: Boolean) {
        appPrefs.edit().putBoolean("send_receipts", v).apply()
        _sendReadReceiptsEnabled.value = v
    }

    fun setEnterToSend(v: Boolean) {
        appPrefs.edit().putBoolean("enter_to_send", v).apply()
        _enterToSend.value = v
    }

    fun getDraft(roomId: String): String =
        draftsPrefs.getString("draft_$roomId", "") ?: ""

    fun saveDraft(roomId: String, text: String) {
        if (text.isBlank()) draftsPrefs.edit().remove("draft_$roomId").apply()
        else draftsPrefs.edit().putString("draft_$roomId", text).apply()
    }

    fun loadMoreHistory() {
        viewModelScope.launch {
            repository.loadMoreHistory()
        }
    }

    fun closeChat() {
        _currentRoomId.value = null
        viewModelScope.launch {
            repository.closeTimeline()
        }
    }

    fun sendMessage(text: String) {
        val roomId = _currentRoomId.value ?: return
        val replyTo = _replyTo.value
        val editing = _editingMessage.value
        viewModelScope.launch {
            when {
                editing != null -> {
                    repository.editMessage(roomId, editing.id, text)
                    _editingMessage.value = null
                }
                replyTo != null -> {
                    repository.sendReply(roomId, replyTo.id, text)
                    _replyTo.value = null
                }
                else -> repository.sendMessage(roomId, text)
            }
        }
    }

    // ---- Message actions (reply / edit / delete / react / pin / forward) ----

    private val _replyTo = MutableStateFlow<com.example.data.model.MessageEntity?>(null)
    val replyTo: StateFlow<com.example.data.model.MessageEntity?> = _replyTo.asStateFlow()

    private val _editingMessage = MutableStateFlow<com.example.data.model.MessageEntity?>(null)
    val editingMessage: StateFlow<com.example.data.model.MessageEntity?> = _editingMessage.asStateFlow()

    fun startReply(message: com.example.data.model.MessageEntity) {
        _editingMessage.value = null
        _replyTo.value = message
    }

    fun startEdit(message: com.example.data.model.MessageEntity) {
        _replyTo.value = null
        _editingMessage.value = message
    }

    fun cancelComposerAction() {
        _replyTo.value = null
        _editingMessage.value = null
    }

    fun deleteMessage(message: com.example.data.model.MessageEntity) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch { repository.redactMessage(roomId, message.id) }
    }

    fun toggleReaction(message: com.example.data.model.MessageEntity, emoji: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch { repository.toggleReaction(roomId, message.id, emoji) }
    }

    fun pinMessage(message: com.example.data.model.MessageEntity, pinned: Boolean) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch { repository.setMessagePinned(roomId, message.id, pinned) }
    }

    /** Re-sends the message content to another room (forward). */
    fun forwardMessage(message: com.example.data.model.MessageEntity, targetRoomId: String) {
        viewModelScope.launch {
            when (message.messageType) {
                "IMAGE", "VIDEO", "AUDIO", "DOCUMENT" -> {
                    // Resolve the media locally then re-upload it to the target room.
                    val source = message.mediaSourceJson ?: message.mediaUrl ?: return@launch
                    val mime = when (message.messageType) {
                        "IMAGE" -> "image/jpeg"
                        "AUDIO" -> "audio/mp4"
                        "VIDEO" -> "video/mp4"
                        else -> "application/octet-stream"
                    }
                    val path = repository.resolveMediaFile(source, mime, message.content.ifBlank { "media" })
                        ?: message.mediaUrl?.takeIf { it.startsWith("/") }
                    if (path != null) {
                        repository.sendAttachment(targetRoomId, path, mime, message.messageType.lowercase(), caption = null)
                    } else {
                        snackbarEvents.tryEmit("No se pudo reenviar el adjunto")
                    }
                }
                else -> repository.sendMessage(targetRoomId, message.content)
            }
        }
    }

    /** Reports a message to the homeserver admin (like Element's report). */
    fun reportMessage(message: com.example.data.model.MessageEntity, reason: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.reportEvent(roomId, message.id, reason)) {
                snackbarEvents.tryEmit("Mensaje reportado al servidor")
            }
        }
    }

    /** Reports the current room to the homeserver admin. */
    fun reportRoom(reason: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.reportRoom(roomId, reason)) {
                snackbarEvents.tryEmit("Sala reportada al servidor")
            }
        }
    }

    // ---- Per-room notification mode (mute / mentions / all) ----

    private val _roomNotificationMode =
        MutableStateFlow<org.matrix.rustcomponents.sdk.RoomNotificationMode?>(null)
    val roomNotificationMode = _roomNotificationMode.asStateFlow()

    fun loadRoomNotificationMode() {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            _roomNotificationMode.value = repository.getRoomNotificationMode(roomId)
        }
    }

    fun setRoomNotificationMode(mode: org.matrix.rustcomponents.sdk.RoomNotificationMode) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.setRoomNotificationMode(roomId, mode)) {
                _roomNotificationMode.value = mode
            }
        }
    }

    // ---- Typing notifications ----

    val typingUsers: StateFlow<List<String>> = repository.typingUsersFlow

    private var typingJob: kotlinx.coroutines.Job? = null
    private var isTypingSent = false

    /** Call on every composer text change — sends m.typing with debounce. */
    fun onComposerTextChanged(text: String) {
        if (!_sendTypingEnabled.value) return
        val roomId = _currentRoomId.value ?: return
        val typing = text.isNotBlank()
        typingJob?.cancel()
        if (typing) {
            if (!isTypingSent) {
                isTypingSent = true
                viewModelScope.launch { repository.sendTypingNotice(roomId, true) }
            }
            typingJob = viewModelScope.launch {
                kotlinx.coroutines.delay(4000)
                isTypingSent = false
                repository.sendTypingNotice(roomId, false)
            }
        } else {
            isTypingSent = false
            viewModelScope.launch { repository.sendTypingNotice(roomId, false) }
        }
    }

    /** Copies a picked content URI into the app cache and sends it as an
     * attachment through the SDK timeline. */
    fun sendAttachmentUri(uri: android.net.Uri, kind: String, caption: String? = null, durationMs: Long? = null) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            val path = repository.copyUriToCache(uri)
            if (path == null) {
                snackbarEvents.tryEmit("No se pudo leer el archivo seleccionado")
                return@launch
            }
            val mime = repository.mimeTypeFor(uri, path)
            repository.sendAttachment(roomId, path, mime, kind, caption, durationMs)
        }
    }

    /** Sends an already-materialized file (camera photo, voice recording). */
    fun sendAttachmentFile(path: String, mimeType: String, kind: String, durationMs: Long? = null) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            repository.sendAttachment(roomId, path, mimeType, kind, null, durationMs)
        }
    }

    fun sendLocation(latitude: Double, longitude: Double) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            repository.sendLocation(roomId, latitude, longitude)
        }
    }

    fun sendPoll(question: String, answers: List<String>, allowMultipleAnswers: Boolean) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            repository.sendPoll(roomId, question, answers, allowMultipleAnswers)
        }
    }

    /** Votes the answer at [answerIndex] of the poll message [message]. */
    fun votePoll(message: com.example.data.model.MessageEntity, answerIndex: Int) {
        val roomId = _currentRoomId.value ?: return
        val answerId = message.pollAnswerIds.getOrNull(answerIndex) ?: return
        viewModelScope.launch {
            repository.votePoll(roomId, message.id, listOf(answerId))
        }
    }

    /** Loads the display names of everyone who responded to a poll. */
    fun loadPollVoters(message: com.example.data.model.MessageEntity, onResult: (List<String>) -> Unit) {
        val roomId = _currentRoomId.value ?: return
        // Local echoes use a transaction id (no $ sigil) — only real event
        // ids can be queried for relations.
        if (!message.id.startsWith("$")) { onResult(emptyList()); return }
        viewModelScope.launch {
            onResult(repository.pollVoters(roomId, message.id))
        }
    }

    private val _roomMembers = MutableStateFlow<List<MatrixRepository.RoomMemberUi>>(emptyList())
    val roomMembers: StateFlow<List<MatrixRepository.RoomMemberUi>> = _roomMembers.asStateFlow()

    private val _myPowerLevel = MutableStateFlow(0L)
    val myPowerLevel: StateFlow<Long> = _myPowerLevel.asStateFlow()

    fun loadRoomMembers(roomId: String) {
        viewModelScope.launch {
            _roomMembers.value = repository.getRoomMembers(roomId)
            _myPowerLevel.value = repository.getMyPowerLevel(roomId)
        }
    }

    fun renameCurrentRoom(name: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch { repository.renameRoom(roomId, name) }
    }

    fun setCurrentRoomTopic(topic: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch { repository.setRoomTopic(roomId, topic) }
    }

    fun kickMember(userId: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.kickRoomMember(roomId, userId)) loadRoomMembers(roomId)
        }
    }

    fun banMember(userId: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.banRoomMember(roomId, userId)) loadRoomMembers(roomId)
        }
    }

    /** role: 0 usuario, 50 moderador, 100 administrador */
    fun setMemberRole(userId: String, powerLevel: Long) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.setMemberPowerLevel(roomId, userId, powerLevel)) loadRoomMembers(roomId)
        }
    }

    fun inviteUserToCurrentRoom(userId: String) {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            repository.inviteUserToRoom(roomId, userId)
        }
    }

    fun leaveCurrentRoom() {
        val roomId = _currentRoomId.value ?: return
        viewModelScope.launch {
            if (repository.leaveRoom(roomId)) closeChat()
        }
    }

    // ----- Snackbar events for quick UI feedback -----
    private val snackbarEvents = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val snackbars: SharedFlow<String> = snackbarEvents

    // ----- Public room directory (explore) -----
    private val _publicRooms = MutableStateFlow<List<MatrixRepository.PublicRoomUi>>(emptyList())
    val publicRooms: StateFlow<List<MatrixRepository.PublicRoomUi>> = _publicRooms.asStateFlow()
    private val _searchingRooms = MutableStateFlow(false)
    val searchingRooms: StateFlow<Boolean> = _searchingRooms.asStateFlow()

    fun searchPublicRooms(query: String) {
        viewModelScope.launch {
            _searchingRooms.value = true
            _publicRooms.value = repository.searchPublicRooms(query)
            _searchingRooms.value = false
        }
    }

    fun joinPublicRoom(roomIdOrAlias: String) {
        viewModelScope.launch {
            repository.joinPublicRoom(roomIdOrAlias)
        }
    }

    fun resolveMedia(mxcUrl: String, mimeType: String, filename: String, onPath: (String?) -> Unit) {
        viewModelScope.launch {
            onPath(repository.resolveMediaFile(mxcUrl, mimeType, filename))
        }
    }

    fun createDirectChat(contact: ContactEntity) {
        viewModelScope.launch {
            // WhatsApp semantics: one conversation per contact. Reuse the
            // existing DM room if any (m.direct lookup like Element) instead
            // of creating a duplicate room on every tap.
            repository.findDmRoom(contact.userId)?.let { openChat(it); return@launch }
            // DM rooms are created UNNAMED — the display name derives from
            // members (heroes), so each side sees the other person's name.
            val roomId = repository.createRoom(
                name = null,
                topic = "",
                roomType = "DIRECT",
                isDirect = true,
                inviteUserId = contact.userId
            )
            if (roomId.isNotBlank()) openChat(roomId)
        }
    }

    /** Creates a group/community room Element-style: visibility, encryption
     * and member invites chosen up front, optional avatar uploaded after
     * creation. */
    fun createGroup(
        name: String,
        topic: String,
        isPublic: Boolean = false,
        members: List<String> = emptyList(),
        avatarUri: android.net.Uri? = null
    ) {
        viewModelScope.launch {
            val roomId = repository.createRoom(
                name = name,
                topic = topic,
                roomType = "GROUP",
                isDirect = false,
                isPublic = isPublic,
                inviteIds = members
            )
            if (roomId.isNotBlank()) {
                avatarUri?.let { uri ->
                    readUriBytes(uri)?.let { (bytes, mime) ->
                        repository.setRoomAvatar(roomId, bytes, mime)
                    }
                }
                openChat(roomId)
            }
        }
    }

    fun createCommunity(
        name: String,
        topic: String,
        isPublic: Boolean = false,
        avatarUri: android.net.Uri? = null
    ) {
        viewModelScope.launch {
            val roomId = repository.createRoom(
                name = name,
                topic = topic,
                roomType = "COMMUNITY",
                isPublic = isPublic,
                encrypt = false
            )
            if (roomId.isNotBlank()) {
                avatarUri?.let { uri ->
                    readUriBytes(uri)?.let { (bytes, mime) ->
                        repository.setRoomAvatar(roomId, bytes, mime)
                    }
                }
            }
        }
    }

    /** Leaves + forgets a room (Element's delete conversation). */
    fun deleteRoom(roomId: String) {
        viewModelScope.launch {
            if (_currentRoomId.value == roomId) closeChat()
            repository.deleteRoom(roomId)
        }
    }

    fun setRoomAvatar(roomId: String, uri: android.net.Uri) {
        viewModelScope.launch {
            readUriBytes(uri)?.let { (bytes, mime) ->
                repository.setRoomAvatar(roomId, bytes, mime)
            }
        }
    }

    fun uploadMyAvatar(uri: android.net.Uri) {
        viewModelScope.launch {
            readUriBytes(uri)?.let { (bytes, mime) ->
                repository.uploadAccountAvatar(bytes, mime)
            }
        }
    }

    private fun readUriBytes(uri: android.net.Uri): Pair<ByteArray, String>? = try {
        val resolver = getApplication<Application>().contentResolver
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
        val mime = resolver.getType(uri)?.takeIf { it.contains('/') }
            ?: "application/octet-stream"
        bytes?.let { it to mime }
    } catch (_: Exception) {
        null
    }

    // ---- Settings data (loaded when the settings screen opens) ----

    private val _notificationPrefs = MutableStateFlow<MatrixRepository.NotificationPrefs?>(null)
    val notificationPrefs: StateFlow<MatrixRepository.NotificationPrefs?> = _notificationPrefs.asStateFlow()

    private val _ignoredUsers = MutableStateFlow<List<String>>(emptyList())
    val ignoredUsers: StateFlow<List<String>> = _ignoredUsers.asStateFlow()

    private val _sessionKeys = MutableStateFlow<Pair<String?, String?>>(null to null)
    val sessionKeys: StateFlow<Pair<String?, String?>> = _sessionKeys.asStateFlow()

    fun loadSettingsData() {
        viewModelScope.launch {
            _notificationPrefs.value = repository.getNotificationPrefs()
            _ignoredUsers.value = repository.getIgnoredUsers()
            _sessionKeys.value = repository.getSessionKeys()
        }
    }

    fun setNotificationPrefs(prefs: MatrixRepository.NotificationPrefs) {
        _notificationPrefs.value = prefs
        viewModelScope.launch {
            if (!repository.setNotificationPrefs(prefs)) {
                _notificationPrefs.value = repository.getNotificationPrefs()
            }
        }
    }

    fun setUserIgnored(userId: String, ignored: Boolean) {
        viewModelScope.launch {
            repository.setUserIgnored(userId, ignored)
            _ignoredUsers.value = repository.getIgnoredUsers()
        }
    }

    fun clearLocalCaches(onDone: (Boolean) -> Unit) {
        viewModelScope.launch { onDone(repository.clearLocalCaches()) }
    }

    fun getAccountManagementUrl(devices: Boolean, onUrl: (String?) -> Unit) {
        viewModelScope.launch {
            val action = if (devices) org.matrix.rustcomponents.sdk.AccountManagementAction.DevicesList
                else org.matrix.rustcomponents.sdk.AccountManagementAction.Profile
            onUrl(repository.accountManagementUrl(action))
        }
    }

    private val _directoryUsers = MutableStateFlow<List<MatrixRepository.DirectoryUser>>(emptyList())
    val directoryUsers: StateFlow<List<MatrixRepository.DirectoryUser>> = _directoryUsers.asStateFlow()

    fun searchUserDirectory(query: String) {
        viewModelScope.launch {
            _directoryUsers.value = repository.searchUserDirectory(query)
        }
    }

    fun postStory(text: String, colorHex: String) {
        viewModelScope.launch {
            repository.postStory(text, colorHex)
        }
    }

    fun postMediaStory(uri: android.net.Uri, caption: String = "") {
        viewModelScope.launch {
            repository.postMediaStory(uri, caption)
        }
    }

    fun openStory(story: StoryEntity) = openStoryGroup(listOf(story))

    /** Opens [group] in the viewer and queues the remaining story groups so
     * finishing one contact's stories continues with the next. */
    fun openStoryGroup(group: List<StoryEntity>) {
        val all = (activeStoriesState.value + myStoriesState.value).distinctBy { it.id }
        val mine = all.filter { it.isMine }.sortedBy { it.timestamp }
        val others = all.filter { !it.isMine }
            .groupBy { it.userId }.values
            .map { g -> g.sortedBy { it.timestamp } }
            .sortedByDescending { it.last().timestamp }
        val groups = buildList {
            if (mine.isNotEmpty()) add(mine)
            addAll(others)
        }
        val key = group.firstOrNull()
        val idx = groups.indexOfFirst { g ->
            g.firstOrNull()?.userId == key?.userId && g.firstOrNull()?.isMine == key?.isMine
        }
        _viewingStory.value = if (idx >= 0) {
            StoryViewing(groups, idx)
        } else {
            StoryViewing(listOf(group.sortedBy { it.timestamp }), 0)
        }
    }

    /** Called when the viewer finishes the current group — show the next
     * contact's stories, or close if there are none left. */
    fun advanceStoryGroup() {
        val v = _viewingStory.value ?: return
        _viewingStory.value = if (v.groupIndex + 1 < v.groups.size) {
            v.copy(groupIndex = v.groupIndex + 1)
        } else {
            null
        }
    }

    fun markStoryViewed(story: StoryEntity) {
        viewModelScope.launch {
            repository.markStoryViewed(story.id)
        }
    }

    /** Pulls the latest statuses from contacts' Matrix stories rooms. */
    fun refreshStories() {
        viewModelScope.launch {
            repository.refreshRemoteStories()
        }
    }

    fun closeStory() {
        _viewingStory.value = null
    }

    /** Starts a real MatrixRTC call in [roomId] using the Element Call
     * embedded widget. Requires camera/mic permissions to already be granted
     * by the caller before invoking this. */
    fun startCall(roomId: String, isVideo: Boolean, joinExisting: Boolean = false) {
        pendingCallIsVideo = isVideo
        viewModelScope.launch {
            val session = repository.prepareElementCall(roomId, isVideo, joinExisting)
            if (session == null) {
                snackbarEvents.tryEmit("No se pudo iniciar la llamada")
                return@launch
            }
            callStartedAt = System.currentTimeMillis()
            _activeCallSession.value = session
            // Keep mic/camera alive if the user backgrounds the app mid-call.
            com.example.calls.MatrixSyncService.setCallActive(getApplication(), true)
        }
    }

    /** Answers the currently ringing incoming call by joining the room's
     * active MatrixRTC session (JOIN_EXISTING intent). */
    fun answerIncomingCall() {
        val incoming = repository.incomingCall.value ?: return
        repository.dismissIncomingCall()
        startCall(incoming.roomId, incoming.isVideo, joinExisting = true)
    }

    fun declineIncomingCall() {
        val incoming = repository.incomingCall.value ?: return
        viewModelScope.launch {
            repository.declineIncomingCall(incoming.roomId)
        }
    }

    fun endCall() {
        val session = _activeCallSession.value ?: return
        val durationSeconds = ((System.currentTimeMillis() - callStartedAt) / 1000).toInt()
        session.close()
        _activeCallSession.value = null
        com.example.calls.MatrixSyncService.setCallActive(getApplication(), false)
        viewModelScope.launch {
            repository.registerCall(
                contactName = session.roomName,
                callType = if (pendingCallIsVideo) "VIDEO" else "VOICE",
                direction = "OUTGOING",
                duration = durationSeconds,
                roomId = session.roomId
            )
        }
    }

    fun acceptInvite(roomId: String) {
        viewModelScope.launch {
            repository.acceptInvite(roomId)
        }
    }

    fun rejectInvite(roomId: String) {
        viewModelScope.launch {
            repository.rejectInvite(roomId)
        }
    }

    fun acceptAllInvites() {
        viewModelScope.launch {
            repository.acceptAllInvites()
        }
    }

    fun rejectAllInvites() {
        viewModelScope.launch {
            repository.rejectAllInvites()
        }
    }

    // ----- Device verification (SAS / emojis) -----

    fun startDeviceVerification() {
        viewModelScope.launch {
            repository.startVerification()
        }
    }

    /** Reverse direction: verify another device of this account from TqApp. */
    fun startUserVerification() {
        viewModelScope.launch {
            repository.startUserVerification()
        }
    }

    fun acceptVerificationRequest() {
        viewModelScope.launch {
            repository.acceptVerificationRequest()
        }
    }

    fun approveVerificationEmojis() {
        viewModelScope.launch {
            repository.approveVerificationEmojis()
        }
    }

    fun declineVerificationEmojis() {
        viewModelScope.launch {
            repository.declineVerificationEmojis()
        }
    }

    fun cancelVerification() {
        viewModelScope.launch {
            repository.cancelVerification()
        }
    }

    fun dismissVerification() {
        repository.dismissVerification()
    }

    // ----- E2EE backup / recovery -----

    fun enableKeyBackup() {
        viewModelScope.launch {
            repository.enableBackupNow()
        }
    }

    fun restoreWithRecoveryKey(key: String) {
        viewModelScope.launch {
            repository.restoreWithRecoveryKey(key)
        }
    }

    fun resetRecoveryKey(onKey: (String?) -> Unit) {
        viewModelScope.launch {
            onKey(repository.resetRecoveryKey())
        }
    }

    fun updateDisplayName(newName: String) {
        viewModelScope.launch {
            repository.updateDisplayName(newName)
        }
    }

    fun updateAvatarUrl(newAvatarUrl: String) {
        viewModelScope.launch {
            repository.updateAvatarUrl(newAvatarUrl)
        }
    }
}

data class RecaptchaChallengeState(
    val session: String,
    val publicKey: String,
    val serverUrl: String,
    val username: String,
    val password: String
)
