package com.example.data.repository

import android.util.Log
import com.example.data.local.AppDatabase
import com.example.data.local.CallEntity
import com.example.data.local.StoryEntity
import com.example.data.matrix.MatrixApiClient
import com.example.data.matrix.MatrixApiService
import com.example.data.matrix.MatrixSessionManager
import com.example.data.matrix.MatrixServersConfig
import com.example.data.matrix.models.RegisterAuth
import com.example.data.matrix.models.RegisterRequest
import com.example.data.matrix.models.TokenLoginRequest
import com.example.data.model.ContactEntity
import com.example.data.model.MessageEntity
import com.example.data.model.RoomEntity
import com.example.data.model.UserSessionEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import org.matrix.rustcomponents.sdk.AccountManagementAction
import org.matrix.rustcomponents.sdk.AudioInfo
import org.matrix.rustcomponents.sdk.BackupState
import org.matrix.rustcomponents.sdk.CreateRoomParameters
import org.matrix.rustcomponents.sdk.EventOrTransactionId
import org.matrix.rustcomponents.sdk.EventSendState
import org.matrix.rustcomponents.sdk.EventTimelineItem
import org.matrix.rustcomponents.sdk.FileInfo
import org.matrix.rustcomponents.sdk.ImageInfo
import org.matrix.rustcomponents.sdk.LatestEventValue
import org.matrix.rustcomponents.sdk.Membership
import org.matrix.rustcomponents.sdk.MediaSource
import org.matrix.rustcomponents.sdk.MembershipState
import org.matrix.rustcomponents.sdk.EmbeddedEventDetails
import org.matrix.rustcomponents.sdk.MsgLikeKind
import org.matrix.rustcomponents.sdk.ProfileDetails
import org.matrix.rustcomponents.sdk.ReceiptType
import org.matrix.rustcomponents.sdk.RelationType
import org.matrix.rustcomponents.sdk.Room
import org.matrix.rustcomponents.sdk.RoomDescription
import org.matrix.rustcomponents.sdk.RoomDirectorySearchEntriesListener
import org.matrix.rustcomponents.sdk.RoomDirectorySearchEntryUpdate
import org.matrix.rustcomponents.sdk.RoomListEntriesDynamicFilterKind
import org.matrix.rustcomponents.sdk.RoomListEntriesListener
import org.matrix.rustcomponents.sdk.RoomListEntriesUpdate
import org.matrix.rustcomponents.sdk.RoomListEntriesWithDynamicAdaptersResult
import org.matrix.rustcomponents.sdk.RoomListLoadingState
import org.matrix.rustcomponents.sdk.RoomListLoadingStateListener
import org.matrix.rustcomponents.sdk.RoomListLoadingStateResult
import org.matrix.rustcomponents.sdk.RoomInfo
import org.matrix.rustcomponents.sdk.RoomInfoListener
import org.matrix.rustcomponents.sdk.RtcCallIntent
import org.matrix.rustcomponents.sdk.RtcCallIntentConsensus
import org.matrix.rustcomponents.sdk.RoomPreset
import org.matrix.rustcomponents.sdk.RoomVisibility
import org.matrix.rustcomponents.sdk.SessionVerificationControllerDelegate
import org.matrix.rustcomponents.sdk.SessionVerificationData
import org.matrix.rustcomponents.sdk.SessionVerificationRequestDetails
import org.matrix.rustcomponents.sdk.SpaceListUpdate
import org.matrix.rustcomponents.sdk.SpaceServiceJoinedSpacesListener
import org.matrix.rustcomponents.sdk.SyncServiceState
import org.matrix.rustcomponents.sdk.SyncServiceStateObserver
import org.matrix.rustcomponents.sdk.TaskHandle
import org.matrix.rustcomponents.sdk.Timeline
import org.matrix.rustcomponents.sdk.TimelineDiff
import org.matrix.rustcomponents.sdk.TimelineItem
import org.matrix.rustcomponents.sdk.TimelineItemContent
import org.matrix.rustcomponents.sdk.TypingNotificationsListener
import org.matrix.rustcomponents.sdk.RoomNotificationMode
import org.matrix.rustcomponents.sdk.TimelineListener
import org.matrix.rustcomponents.sdk.UploadParameters
import org.matrix.rustcomponents.sdk.UploadSource
import org.matrix.rustcomponents.sdk.VerificationState
import org.matrix.rustcomponents.sdk.VideoInfo
import org.matrix.rustcomponents.sdk.WidgetCapabilities
import org.matrix.rustcomponents.sdk.WidgetCapabilitiesProvider
import org.matrix.rustcomponents.sdk.WidgetDriverHandle
import org.matrix.rustcomponents.sdk.generateWebviewUrl
import org.matrix.rustcomponents.sdk.getElementCallRequiredPermissions
import org.matrix.rustcomponents.sdk.makeWidgetDriver
import org.matrix.rustcomponents.sdk.messageEventContentFromMarkdown
import org.matrix.rustcomponents.sdk.newVirtualElementCallWidget
import uniffi.matrix_sdk.EncryptionSystem
import uniffi.matrix_sdk.HeaderStyle
import uniffi.matrix_sdk.Intent as ElementCallIntent
import org.matrix.rustcomponents.sdk.NotificationEvent
import org.matrix.rustcomponents.sdk.NotificationItem
import org.matrix.rustcomponents.sdk.SyncNotificationListener
import uniffi.matrix_sdk.NotificationType
import uniffi.matrix_sdk.VirtualElementCallWidgetConfig
import uniffi.matrix_sdk.VirtualElementCallWidgetProperties
import uniffi.matrix_sdk_base.EncryptionState
import java.util.UUID

sealed class AuthResult {
    data class Success(val userId: String, val serverUrl: String) : AuthResult()
    data class Error(val message: String) : AuthResult()
    data class RequiresRecaptcha(
        val session: String,
        val publicKey: String,
        val serverUrl: String,
        val username: String,
        val password: String
    ) : AuthResult()
}

/** States for the SAS device-verification flow (emojis), Element-style. */
sealed class VerificationUiState {
    data object Idle : VerificationUiState()
    data class IncomingRequest(
        val senderId: String,
        val deviceId: String,
        val deviceDisplayName: String
    ) : VerificationUiState()
    data object RequestAccepted : VerificationUiState()
    data object SasStarted : VerificationUiState()
    data class ShowEmojis(val emojis: List<Pair<String, String>>) : VerificationUiState()
    data object Verified : VerificationUiState()
    data object Cancelled : VerificationUiState()
    data class Failed(val message: String) : VerificationUiState()
}

/**
 * Data layer backed by the official Matrix Rust SDK (same engine as Element X):
 * sliding sync, encrypted local store, E2EE, SAS device verification and key
 * backup are all handled natively by the SDK.
 */
class MatrixRepository(
    private val database: AppDatabase,
    val sessionManager: MatrixSessionManager
) {
    private val client get() = sessionManager.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    companion object {
        private const val TAG = "MatrixAuth"
        // Marker placed in the topic of a user's dedicated stories room.
        private const val STORY_TOPIC_MARKER = "#tqapp-stories"
        private const val STORY_TTL_MS = 86400000L
    }

    // ----- Session -----
    private val _sessionFlow = MutableStateFlow<UserSessionEntity?>(null)
    val sessionFlow: StateFlow<UserSessionEntity?> = _sessionFlow.asStateFlow()

    // ----- Room lists (fed by the SDK RoomListService) -----
    private val _roomsFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    val roomsFlow: StateFlow<List<RoomEntity>> = _roomsFlow.asStateFlow()
    private val _invitesFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    private val inviteViaServers = mutableMapOf<String, List<String>>()
    val invitesFlow: StateFlow<List<RoomEntity>> = _invitesFlow.asStateFlow()
    private val _allRoomsFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    val allRoomsFlow: StateFlow<List<RoomEntity>> = _allRoomsFlow.asStateFlow()
    /** Obsolete DM rooms (peer left, or superseded by a newer DM with the same
     * contact) — hidden from the chat list, visible under "Archivados". */
    private val _archivedRoomsFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    val archivedRoomsFlow: StateFlow<List<RoomEntity>> = _archivedRoomsFlow.asStateFlow()
    private val _channelsFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    val channelsFlow: StateFlow<List<RoomEntity>> = _channelsFlow.asStateFlow()
    private val _communitiesFlow = MutableStateFlow<List<RoomEntity>>(emptyList())
    val communitiesFlow: StateFlow<List<RoomEntity>> = _communitiesFlow.asStateFlow()
    private val _contactsFlow = MutableStateFlow<List<ContactEntity>>(emptyList())
    val contactsFlow: StateFlow<List<ContactEntity>> = _contactsFlow.asStateFlow()

    // ----- Local-only data (no Matrix equivalent) -----
    val activeStoriesFlow: Flow<List<StoryEntity>> = database.storyDao().getActiveStories()
    val myStoriesFlow: Flow<List<StoryEntity>> = database.storyDao().getMyActiveStories()
    val callsFlow: Flow<List<CallEntity>> = database.callDao().getAllCalls()

    // ----- Status / events -----
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()
    val errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 4)

    // ----- Verification / crypto state -----
    private val _verificationUi = MutableStateFlow<VerificationUiState>(VerificationUiState.Idle)
    val verificationUi: StateFlow<VerificationUiState> = _verificationUi.asStateFlow()

    /** Incoming MatrixRTC call detected via room info (m.call.member state
     * changes arrive over sliding sync — no polling). */
    data class IncomingCallInfo(
        val roomId: String,
        val roomName: String,
        val callerId: String,
        val callerName: String,
        val callerAvatarUrl: String?,
        val isVideo: Boolean,
        val isDirect: Boolean,
        val detectedAt: Long
    )
    private val _incomingCall = MutableStateFlow<IncomingCallInfo?>(null)
    val incomingCall: StateFlow<IncomingCallInfo?> = _incomingCall.asStateFlow()
    /** Set by the notification "Contestar" action so the UI auto-answers the
     * incoming call as soon as the app opens. */
    private val _autoAnswerCall = MutableStateFlow<String?>(null)
    val autoAnswerCall: StateFlow<String?> = _autoAnswerCall.asStateFlow()
    fun requestAutoAnswer(roomId: String) { _autoAnswerCall.value = roomId }
    fun consumeAutoAnswer() { _autoAnswerCall.value = null }

    /** Message/invite notifications delivered by the SDK while syncing —
     * consumed by MatrixSyncService to post Android notifications. */
    data class AppNotification(
        val roomId: String,
        val roomName: String,
        val senderName: String,
        val body: String,
        val isInvite: Boolean
    )
    val notificationEvents = MutableSharedFlow<AppNotification>(extraBufferCapacity = 16)

    /** Set when a notification is tapped so the app opens that room. */
    private val _pendingOpenRoom = MutableStateFlow<String?>(null)
    val pendingOpenRoom: StateFlow<String?> = _pendingOpenRoom.asStateFlow()
    fun requestOpenRoom(roomId: String) { _pendingOpenRoom.value = roomId }
    fun consumePendingOpenRoom() { _pendingOpenRoom.value = null }
    /** Tracks hasRoomCall per room to detect false→true transitions. */
    private val roomCallActive = mutableMapOf<String, Boolean>()
    /** True while a local ElementCallSession exists for a room — avoids
     * reporting our own outgoing call as incoming. */
    private val localCallRooms = mutableSetOf<String>()
    private val _deviceVerification = MutableStateFlow(VerificationState.UNKNOWN)
    val deviceVerification: StateFlow<VerificationState> = _deviceVerification.asStateFlow()
    private val _backupState = MutableStateFlow(BackupState.UNKNOWN)
    val backupState: StateFlow<BackupState> = _backupState.asStateFlow()

    // ----- Active conversation -----
    private val _currentRoomId = MutableStateFlow<String?>(null)
    private val _currentRoom = MutableStateFlow<RoomEntity?>(null)
    val currentRoom: StateFlow<RoomEntity?> = _currentRoom.asStateFlow()
    private val _currentMessages = MutableStateFlow<List<MessageEntity>>(emptyList())
    val currentMessages: StateFlow<List<MessageEntity>> = _currentMessages.asStateFlow()

    // ----- Internal room list state -----
    private val listLock = Mutex()
    private val orderedRooms = mutableListOf<Room>()
    private val roomInfos = mutableMapOf<String, RoomInfo>()
    private val latestEvents = mutableMapOf<String, LatestEventValue>()
    private val infoHandles = mutableMapOf<String, TaskHandle>()
    private val spaceParents = mutableMapOf<String, String>()
    private var entriesResult: RoomListEntriesWithDynamicAdaptersResult? = null
    private var loadingStateResult: RoomListLoadingStateResult? = null
    private var expectedRoomCount: Int? = null
    private var syncStateHandle: TaskHandle? = null
    private var spacesHandle: TaskHandle? = null
    private var verificationStateHandle: TaskHandle? = null
    private var backupStateHandle: TaskHandle? = null
    private var timelineHandle: TaskHandle? = null
    private var typingHandle: TaskHandle? = null
    private var activeTimeline: Timeline? = null

    /** Matrix IDs currently typing in the open room (m.typing). */
    private val _typingUsersFlow = MutableStateFlow<List<String>>(emptyList())
    val typingUsersFlow: StateFlow<List<String>> = _typingUsersFlow.asStateFlow()
    private val timelineItems = mutableListOf<TimelineItem>()

    // ====================================================================
    // Session restore / auth
    // ====================================================================

    private val sessionReady = java.util.concurrent.atomic.AtomicBoolean(false)

    suspend fun tryRestoreSession(): Boolean = withContext(Dispatchers.IO) {
        if (client != null) {
            onSessionReady()
            return@withContext true
        }
        if (!sessionManager.restoreSavedSession()) {
            Log.i(TAG, "tryRestoreSession: no saved session")
            return@withContext false
        }
        Log.i(TAG, "tryRestoreSession: session restored, starting sync")
        onSessionReady()
        true
    }

    private suspend fun onSessionReady() {
        // Guard against double init (Application + ViewModel can both trigger
        // session restore) — listeners/subscriptions must start only once.
        if (!sessionReady.compareAndSet(false, true)) return
        refreshSessionInfo()
        startSyncAndListeners()
    }

    private suspend fun refreshSessionInfo() {
        val c = client ?: return
        try {
            val session = c.session()
            val displayName = try { c.displayName() } catch (_: Exception) { null }
            val avatarUrl = try { c.avatarUrl() } catch (_: Exception) { null }
            _sessionFlow.value = UserSessionEntity(
                userId = session.userId,
                homeserverUrl = session.homeserverUrl,
                deviceId = session.deviceId,
                displayName = displayName ?: session.userId.removePrefix("@").substringBefore(":"),
                avatarUrl = avatarUrl,
                isLoggedIn = true,
                isDemoMode = false
            )
        } catch (_: Exception) {
        }
    }

    suspend fun getCurrentSession(): UserSessionEntity? = _sessionFlow.value

    suspend fun loginWithMatrix(serverUrl: String, usernameInput: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        val cleanUrl = MatrixServersConfig.cleanUrl(serverUrl)
        try {
            sessionManager.loginWithPassword(cleanUrl, usernameInput.trim(), password)
            onSessionReady()
            AuthResult.Success(client?.userId() ?: usernameInput, cleanUrl)
        } catch (e: Exception) {
            sessionManager.client?.destroy()
            sessionManager.logout()
            AuthResult.Error(
                e.message?.takeIf { it.isNotBlank() }
                    ?: "No se pudo iniciar sesión en $cleanUrl"
            )
        }
    }

    /** REST token login (SSO deep link), then attach the session to the SDK. */
    suspend fun loginWithMatrixToken(serverUrl: String, token: String): AuthResult = withContext(Dispatchers.IO) {
        val cleanUrl = MatrixServersConfig.cleanUrl(serverUrl)
        Log.i(TAG, "loginWithMatrixToken: token received (len=${token.trim().length}), server=$cleanUrl")
        try {
            val api = MatrixApiClient.getService(cleanUrl)
            // Reuse the persisted device ID so each login does not create a new
            // unverified "unknown" device on the server.
            val response = api.loginWithToken(
                TokenLoginRequest(token = token.trim(), deviceId = sessionManager.savedDeviceId())
            )
            Log.i(TAG, "loginWithMatrixToken: /login response code=${response.code()}")
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                Log.i(TAG, "loginWithMatrixToken: user=${body.userId}, device=${body.deviceId}, attaching session…")
                sessionManager.attachRestSession(
                    userId = body.userId,
                    deviceId = body.deviceId,
                    accessToken = body.accessToken,
                    homeserverUrl = cleanUrl
                )
                renameDevice(api, body.accessToken, body.deviceId)
                Log.i(TAG, "loginWithMatrixToken: session attached, starting sync")
                onSessionReady()
                Log.i(TAG, "loginWithMatrixToken: sync started OK")
                AuthResult.Success(body.userId, cleanUrl)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                Log.w(TAG, "loginWithMatrixToken: /login failed code=${response.code()}")
                val msg = try {
                    JSONObject(errorBody).optString("error", "Token de autenticación SSO inválido o expirado")
                } catch (_: Exception) {
                    "Error al validar token de autenticación ($cleanUrl: ${response.code()})"
                }
                AuthResult.Error(msg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "loginWithMatrixToken: stage failed: ${e.javaClass.simpleName}", e)
            AuthResult.Error("Error al conectar con servidor Matrix para validar token: ${e.localizedMessage ?: "Error de red"}")
        }
    }

    /** Names the device "TqApp" so other clients (Element) show it identified
     * instead of "unknown device" or the SSO redirect URL. */
    private suspend fun renameDevice(api: MatrixApiService, accessToken: String, deviceId: String?) {
        if (deviceId.isNullOrBlank()) return
        try {
            api.updateDevice("Bearer $accessToken", deviceId, mapOf("display_name" to "TqApp"))
        } catch (e: Exception) {
            Log.w(TAG, "renameDevice failed: ${e.javaClass.simpleName}")
        }
    }

    /**
     * Registration stays on the REST API (the SDK does not cover interactive
     * registration/UIA). On success the returned session is attached to the SDK.
     */
    suspend fun registerWithMatrix(serverUrl: String, usernameInput: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        val cleanUrl = MatrixServersConfig.cleanUrl(serverUrl)
        val cleanUser = usernameInput.trim().removePrefix("@").substringBefore(":").lowercase()

        try {
            val api = MatrixApiClient.getService(cleanUrl)
            val request = RegisterRequest(username = cleanUser, password = password, auth = null)
            val response = api.register(request)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                sessionManager.attachRestSession(body.userId, body.deviceId, body.accessToken, cleanUrl)
                onSessionReady()
                return@withContext AuthResult.Success(body.userId, cleanUrl)
            }

            val errorBody = response.errorBody()?.string() ?: ""
            val json = try { JSONObject(errorBody) } catch (_: Exception) { null }

            if (response.code() == 401 && json != null) {
                val session = json.optString("session", "")
                val flows = json.optJSONArray("flows")
                val params = json.optJSONObject("params")

                var hasDummyOnly = false
                if (flows != null) {
                    for (i in 0 until flows.length()) {
                        val flow = flows.optJSONObject(i)
                        val stages = flow?.optJSONArray("stages")
                        if (stages != null && stages.length() == 1 && stages.optString(0) == "m.login.dummy") {
                            hasDummyOnly = true
                            break
                        }
                    }
                }

                if (hasDummyOnly && session.isNotBlank()) {
                    val dummyResp = api.register(
                        RegisterRequest(
                            username = cleanUser,
                            password = password,
                            auth = RegisterAuth(type = "m.login.dummy", session = session)
                        )
                    )
                    if (dummyResp.isSuccessful && dummyResp.body() != null) {
                        val body = dummyResp.body()!!
                        sessionManager.attachRestSession(body.userId, body.deviceId, body.accessToken, cleanUrl)
                        onSessionReady()
                        return@withContext AuthResult.Success(body.userId, cleanUrl)
                    }
                }

                val recaptchaParams = params?.optJSONObject("m.login.recaptcha")
                var requiresRecaptcha = recaptchaParams != null
                if (flows != null) {
                    for (i in 0 until flows.length()) {
                        val stages = flows.optJSONObject(i)?.optJSONArray("stages")
                        if (stages != null) {
                            for (j in 0 until stages.length()) {
                                if (stages.optString(j) == "m.login.recaptcha") {
                                    requiresRecaptcha = true
                                    break
                                }
                            }
                        }
                    }
                }

                if (requiresRecaptcha) {
                    val publicKey = recaptchaParams?.optString("public_key")
                        ?.takeIf { it.isNotBlank() }
                        ?: "6LdXkhsUAAAAAAvE_534ZkK-96q611eH_sY1Fh"
                    return@withContext AuthResult.RequiresRecaptcha(
                        session = session,
                        publicKey = publicKey,
                        serverUrl = cleanUrl,
                        username = cleanUser,
                        password = password
                    )
                }
            }

            val errCode = json?.optString("errcode") ?: ""
            val errMessage = json?.optString("error") ?: ""
            AuthResult.Error(
                when {
                    errCode == "M_USER_IN_USE" || errorBody.contains("M_USER_IN_USE") ->
                        "El usuario '@$cleanUser' ya existe en $cleanUrl. Ve a la pestaña 'INICIAR SESIÓN' para ingresar con tu contraseña."
                    errCode == "M_EXCLUSIVE" || errorBody.contains("M_EXCLUSIVE") ->
                        "El nombre de usuario '@$cleanUser' no está disponible o está reservado."
                    errCode == "M_FORBIDDEN" || errorBody.contains("registration has been disabled") || response.code() == 403 ->
                        "El servidor $cleanUrl ha deshabilitado el registro directo por API abierta (requiere verificación web oficial). Puedes crear tu cuenta real en https://app.element.io/#/register y luego pulsar 'INICIAR SESIÓN' aquí."
                    errMessage.isNotBlank() -> "El servidor respondió: $errMessage"
                    else -> "Error del servidor Matrix ($cleanUrl, código ${response.code()})."
                }
            )
        } catch (e: Exception) {
            AuthResult.Error("No se pudo conectar para registrar en $cleanUrl: ${e.localizedMessage ?: "Error de red"}")
        }
    }

    suspend fun completeRecaptchaRegistration(
        serverUrl: String,
        username: String,
        password: String,
        session: String,
        recaptchaToken: String
    ): AuthResult = withContext(Dispatchers.IO) {
        val cleanUrl = MatrixServersConfig.cleanUrl(serverUrl)
        try {
            val api = MatrixApiClient.getService(cleanUrl)
            val response = api.register(
                RegisterRequest(
                    username = username,
                    password = password,
                    auth = RegisterAuth(type = "m.login.recaptcha", session = session, response = recaptchaToken)
                )
            )
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                sessionManager.attachRestSession(body.userId, body.deviceId, body.accessToken, cleanUrl)
                onSessionReady()
                AuthResult.Success(body.userId, cleanUrl)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val json = try { JSONObject(errorBody) } catch (_: Exception) { null }
                AuthResult.Error(json?.optString("error") ?: "Error al validar el CAPTCHA con el servidor Matrix.")
            }
        } catch (e: Exception) {
            AuthResult.Error("Fallo al enviar respuesta del CAPTCHA: ${e.localizedMessage ?: "Error de conexión"}")
        }
    }

    suspend fun loginAsQuickDemo(chosenServerUrl: String, username: String = "usuario_matrix") = withContext(Dispatchers.IO) {
        val cleanUrl = MatrixServersConfig.cleanUrl(chosenServerUrl)
        val cleanUser = if (username.startsWith("@")) username else "@$username:${cleanUrl.removePrefix("https://").removePrefix("http://")}"
        _sessionFlow.value = UserSessionEntity(
            userId = cleanUser,
            homeserverUrl = cleanUrl,
            displayName = username.removePrefix("@").substringBefore(":"),
            isLoggedIn = true,
            isDemoMode = true
        )
        database.prepopulateInitialData()
        seedDemoRooms()
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        closeTimeline()
        entriesResult?.destroy()
        entriesResult = null
        loadingStateResult?.destroy()
        loadingStateResult = null
        syncStateHandle?.cancel()
        spacesHandle?.cancel()
        verificationStateHandle?.cancel()
        backupStateHandle?.cancel()
        infoHandles.values.forEach { it.cancel() }
        infoHandles.clear()
        orderedRooms.clear()
        roomInfos.clear()
        latestEvents.clear()
        spaceParents.clear()
        _roomsFlow.value = emptyList()
        _invitesFlow.value = emptyList()
        _allRoomsFlow.value = emptyList()
        _channelsFlow.value = emptyList()
        _communitiesFlow.value = emptyList()
        _contactsFlow.value = emptyList()
        _currentRoom.value = null
        _currentRoomId.value = null
        _currentMessages.value = emptyList()
        _verificationUi.value = VerificationUiState.Idle
        _incomingCall.value = null
        _autoAnswerCall.value = null
        roomCallActive.clear()
        localCallRooms.clear()
        sessionReady.set(false)
        sessionManager.logout()
        database.clearAllData()
        _sessionFlow.value = null
    }

    // ====================================================================
    // Sync + room list (Rust SDK)
    // ====================================================================

    private suspend fun startSyncAndListeners() {
        try {
            val service = sessionManager.startSync()

            syncStateHandle = service.state(object : SyncServiceStateObserver {
                override fun onUpdate(state: SyncServiceState) {
                    Log.i(TAG, "sync state: $state")
                    if (state == SyncServiceState.ERROR || state == SyncServiceState.TERMINATED) {
                        _isSyncing.value = false
                        errorEvents.tryEmit("La sincronización se detuvo ($state)")
                    }
                }
            })

            val roomList = service.roomListService().allRooms()
            loadingStateResult = roomList.loadingState(object : RoomListLoadingStateListener {
                override fun onUpdate(state: RoomListLoadingState) {
                    _isSyncing.value = state !is RoomListLoadingState.Loaded
                    expectedRoomCount =
                        (state as? RoomListLoadingState.Loaded)?.maximumNumberOfRooms?.toInt()
                    loadMoreRoomPagesIfNeeded()
                }
            })
            _isSyncing.value = loadingStateResult?.state !is RoomListLoadingState.Loaded
            expectedRoomCount =
                (loadingStateResult?.state as? RoomListLoadingState.Loaded)?.maximumNumberOfRooms?.toInt()

            entriesResult = roomList.entriesWithDynamicAdapters(50u, object : RoomListEntriesListener {
                override fun onUpdate(updates: List<RoomListEntriesUpdate>) {
                    scope.launch { applyRoomListUpdates(updates) }
                }
            })
            // The dynamic adapter starts with a None filter that drops every room;
            // NonLeft keeps joined + invited rooms (same default Element X uses).
            entriesResult?.controller()?.setFilter(RoomListEntriesDynamicFilterKind.NonLeft)
            // Dynamic adapters are lazy: nothing loads until a page is requested.
            entriesResult?.controller()?.resetToOnePage()
            loadMoreRoomPagesIfNeeded()

            subscribeSpaces()
            attachVerificationDelegate()
            observeEncryptionState()
            registerSyncNotificationHandler()
        } catch (e: Exception) {
            errorEvents.tryEmit("Error al iniciar sincronización: ${e.localizedMessage}")
        }
    }

    /** Registers the SDK's sync notification handler — the same mechanism
     * Element X uses to raise notifications from sync responses (the handler
     * fires for events that pass the room's Matrix push rules, including in
     * E2EE rooms since the SDK decrypts them first). */
    private fun registerSyncNotificationHandler() {
        val c = client ?: return
        scope.launch {
            try {
                c.registerNotificationHandler(object : SyncNotificationListener {
                    override fun onNotification(
                        item: NotificationItem,
                        roomId: String
                    ) {
                        val sender = item.senderInfo.displayName ?: item.senderInfo.avatarUrl
                        val roomName = item.roomInfo.displayName
                            ?: item.roomInfo.canonicalAlias ?: roomId
                        val body = when (val ev = item.event) {
                            is NotificationEvent.Invite ->
                                "${ev.sender} te invitó a unirte"
                            is NotificationEvent.Timeline -> {
                                try {
                                    val json = JSONObject(item.rawEvent)
                                    val content = json.optJSONObject("content")
                                    val msgtype = content?.optString("msgtype").orEmpty()
                                    val text = content?.optString("body").orEmpty()
                                    when (msgtype) {
                                        "m.image" -> "📷 Imagen"
                                        "m.audio" -> "🎵 Audio"
                                        "m.video" -> "🎬 Video"
                                        "m.file" -> "📄 Documento"
                                        "m.sticker" -> "Sticker"
                                        "m.location" -> "📍 Ubicación"
                                        else -> text.ifBlank { "Nuevo mensaje" }
                                    }
                                } catch (_: Exception) { "Nuevo mensaje" }
                            }
                        }
                        notificationEvents.tryEmit(
                            AppNotification(
                                roomId = roomId,
                                roomName = roomName,
                                senderName = sender ?: roomId,
                                body = body,
                                isInvite = item.event is NotificationEvent.Invite
                            )
                        )
                    }
                })
                Log.i(TAG, "sync notification handler registered")
            } catch (e: Exception) {
                Log.w(TAG, "registerNotificationHandler failed: ${e.message}")
            }
        }
    }

    private fun subscribeSpaces() {
        val c = client ?: return
        scope.launch {
            try {
                val spaceService = c.spaceService()
                spacesHandle = spaceService.subscribeToTopLevelJoinedSpaces(
                    object : SpaceServiceJoinedSpacesListener {
                        override fun onUpdate(spaceListUpdates: List<SpaceListUpdate>) {
                            scope.launch { refreshSpaceChildren(spaceService) }
                        }
                    }
                )
                refreshSpaceChildren(spaceService)
            } catch (_: Exception) {
            }
        }
    }

    private suspend fun refreshSpaceChildren(spaceService: org.matrix.rustcomponents.sdk.SpaceService) {
        try {
            val spaces = spaceService.topLevelJoinedSpaces()
            for (space in spaces) {
                try {
                    val list = spaceService.spaceRoomList(space.roomId)
                    val children = list.rooms()
                    listLock.withLock {
                        for (child in children) spaceParents[child.roomId] = space.roomId
                    }
                    list.destroy()
                } catch (_: Exception) {
                }
            }
            rebuildLists()
        } catch (_: Exception) {
        }
    }

    private suspend fun applyRoomListUpdates(updates: List<RoomListEntriesUpdate>) {
        listLock.withLock {
            for (u in updates) {
                when (u) {
                    is RoomListEntriesUpdate.Reset -> {
                        orderedRooms.clear()
                        orderedRooms.addAll(u.values)
                    }
                    is RoomListEntriesUpdate.Append -> orderedRooms.addAll(u.values)
                    is RoomListEntriesUpdate.PushBack -> orderedRooms.add(u.value)
                    is RoomListEntriesUpdate.PushFront -> orderedRooms.add(0, u.value)
                    is RoomListEntriesUpdate.PopBack -> if (orderedRooms.isNotEmpty()) orderedRooms.removeAt(orderedRooms.size - 1)
                    is RoomListEntriesUpdate.PopFront -> if (orderedRooms.isNotEmpty()) orderedRooms.removeAt(0)
                    is RoomListEntriesUpdate.Insert -> {
                        val i = u.index.toInt().coerceIn(0, orderedRooms.size)
                        orderedRooms.add(i, u.value)
                    }
                    is RoomListEntriesUpdate.Remove -> {
                        val i = u.index.toInt()
                        if (i in orderedRooms.indices) orderedRooms.removeAt(i)
                    }
                    is RoomListEntriesUpdate.Set -> {
                        val i = u.index.toInt()
                        if (i in orderedRooms.indices) orderedRooms[i] = u.value
                    }
                    is RoomListEntriesUpdate.Truncate -> {
                        val len = u.length.toInt()
                        while (orderedRooms.size > len) orderedRooms.removeAt(orderedRooms.size - 1)
                    }
                    is RoomListEntriesUpdate.Clear -> orderedRooms.clear()
                }
            }
            for (room in orderedRooms) {
                try {
                    subscribeRoomInfo(room)
                } catch (e: Exception) {
                    Log.w(TAG, "room info subscribe failed for ${room.id()}", e)
                }
            }
        }
        Log.i(TAG, "room entries applied: ${orderedRooms.size} rooms")
        rebuildLists()
        loadMoreRoomPagesIfNeeded()
    }

    /** The dynamic room list only emits entries for pages explicitly requested. */
    private fun loadMoreRoomPagesIfNeeded() {
        val expected = expectedRoomCount
        if (expected == null || orderedRooms.size < expected) {
            entriesResult?.controller()?.addOnePage()
        }
    }

    private fun subscribeRoomInfo(room: Room) {
        val roomId = room.id()
        if (infoHandles.containsKey(roomId)) return
        infoHandles[roomId] = room.subscribeToRoomInfoUpdates(object : RoomInfoListener {
            override fun call(roomInfo: RoomInfo) {
                scope.launch {
                    listLock.withLock { roomInfos[roomId] = roomInfo }
                    detectCallTransition(roomInfo)
                    refreshLatestEvent(roomId)
                    rebuildLists()
                }
            }
        })
        scope.launch {
            try {
                val info = room.roomInfo()
                listLock.withLock { roomInfos[roomId] = info }
                detectCallTransition(info)
                refreshLatestEvent(roomId)
                rebuildLists()
            } catch (e: Exception) {
                Log.w(TAG, "roomInfo() failed for $roomId: ${e.message}")
            }
        }
    }

    /** Detects MatrixRTC call transitions from RoomInfo updates pushed by
     * sliding sync (m.call.member state changes). Emits [_incomingCall] when
     * a call starts in a room we are joined to but are not a participant of,
     * and clears it when the call ends. */
    private fun detectCallTransition(info: RoomInfo) {
        if (info.membership != Membership.JOINED) return
        val roomId = info.id
        val wasActive = roomCallActive[roomId] == true
        val isActive = info.hasRoomCall
        roomCallActive[roomId] = isActive

        if (isActive == wasActive) return

        if (!isActive) {
            // Call ended — clear any pending incoming banner for this room.
            if (_incomingCall.value?.roomId == roomId) {
                _incomingCall.value = null
                Log.i(TAG, "Incoming call in $roomId ended")
            }
            return
        }

        // Call started. Ignore if we are already a participant (our own
        // outgoing call or a call we joined on another device).
        val ownUserId = try { client?.userId() } catch (e: Exception) { null }
        val participants = info.activeRoomCallParticipants
        if (ownUserId != null && participants.contains(ownUserId)) return
        if (localCallRooms.contains(roomId)) return

        val callerId = participants.firstOrNull { it != ownUserId } ?: ""
        val callerName = info.heroes.firstOrNull { it.userId == callerId }?.displayName
            ?: callerId.removePrefix("@").substringBefore(":")
            .ifBlank { info.displayName ?: roomId }
        val isVideo = (info.activeRoomCallConsensusIntent as? RtcCallIntentConsensus.Full)
            ?.v1 == RtcCallIntent.VIDEO
        Log.i(TAG, "Incoming call detected in $roomId from $callerId (video=$isVideo)")
        _incomingCall.value = IncomingCallInfo(
            roomId = roomId,
            roomName = info.displayName ?: roomId,
            callerId = callerId,
            callerName = callerName,
            callerAvatarUrl = info.heroes.firstOrNull { it.userId == callerId }?.avatarUrl
                ?: info.avatarUrl,
            isVideo = isVideo,
            isDirect = info.isDirect || info.isDm,
            detectedAt = System.currentTimeMillis()
        )
    }

    fun dismissIncomingCall() {
        _incomingCall.value = null
    }

    /** Declines the ringing call by sending an m.rtc.decline for the latest
     * m.rtc.notification event in the room (MSC4310). If the notification
     * event can't be found, the banner is just dismissed locally. */
    suspend fun declineIncomingCall(roomId: String) = withContext(Dispatchers.IO) {
        _incomingCall.value = null
        try {
            val room = client?.getRoom(roomId) ?: return@withContext
            val notificationEventId = findLatestRtcNotificationEventId(room)
            if (notificationEventId != null) {
                room.declineCall(notificationEventId)
                Log.i(TAG, "Declined call in $roomId (notification $notificationEventId)")
            } else {
                Log.w(TAG, "No rtc.notification event found to decline in $roomId")
            }
        } catch (e: Exception) {
            Log.w(TAG, "declineIncomingCall failed for $roomId: ${e.message}")
        }
    }

    /** Builds a short-lived timeline for [room] and returns the event id of
     * the most recent m.rtc.notification event, or null. */
    private suspend fun findLatestRtcNotificationEventId(room: Room): String? {
        val deferred = kotlinx.coroutines.CompletableDeferred<String?>()
        var timeline: Timeline? = null
        var handle: TaskHandle? = null
        try {
            timeline = room.timeline()
            handle = timeline.addListener(object : TimelineListener {
                override fun onUpdate(diffs: List<TimelineDiff>) {
                    for (d in diffs) {
                        val items = when (d) {
                            is TimelineDiff.Reset -> d.values
                            is TimelineDiff.Append -> d.values
                            is TimelineDiff.PushBack -> listOf(d.value)
                            is TimelineDiff.Insert -> listOf(d.value)
                            else -> emptyList()
                        }
                        items.asReversed().forEach { item ->
                            val ev = item.asEvent() ?: return@forEach
                            if (ev.eventTypeRaw?.contains("rtc.notification") == true) {
                                val id = (ev.eventOrTransactionId as? EventOrTransactionId.EventId)?.eventId
                                if (id != null && !deferred.isCompleted) deferred.complete(id)
                            }
                        }
                    }
                }
            })
            timeline.paginateBackwards(20u.toUShort())
            return kotlinx.coroutines.withTimeoutOrNull(6000) { deferred.await() }
        } catch (e: Exception) {
            Log.w(TAG, "findLatestRtcNotificationEventId failed: ${e.message}")
            return null
        } finally {
            try { handle?.cancel() } catch (_: Exception) {}
            try { timeline?.destroy() } catch (_: Exception) {}
        }
    }

    private suspend fun refreshLatestEvent(roomId: String) {
        try {
            val room = client?.getRoom(roomId) ?: return
            latestEvents[roomId] = room.latestEvent()
        } catch (_: Exception) {
        }
    }

    private suspend fun rebuildLists() {
        listLock.withLock {
            val chats = mutableListOf<RoomEntity>()
            val invites = mutableListOf<RoomEntity>()
            val communities = mutableListOf<RoomEntity>()
            val channels = mutableListOf<RoomEntity>()
            val contacts = mutableListOf<ContactEntity>()
            val all = mutableListOf<RoomEntity>()

            // Positional diff updates can leave duplicate entries; dedupe by
            // room id before building UI lists.
            for (room in orderedRooms.distinctBy { it.id() }) {
                val info = roomInfos[room.id()] ?: continue
                when (info.membership) {
                    Membership.INVITED -> {
                        // Stories rooms are joined silently — a status invite
                        // must not look like a chat invitation.
                        if (isStoriesRoom(info)) {
                            if (storyRoomJoinAttempts.add(info.id)) {
                                scope.launch(Dispatchers.IO) {
                                    try { joinInvitedRoom(info.id) } catch (_: Exception) {}
                                }
                            }
                            continue
                        }
                        invites.add(inviteToUi(info))
                    }
                    Membership.JOINED -> {
                        // Stories rooms are not conversations — they feed the
                        // Estados tab instead.
                        if (isStoriesRoom(info)) continue
                        val ui = roomToUi(info)
                        all.add(ui)
                        when {
                            info.isSpace -> communities.add(ui)
                            spaceParents.containsKey(info.id) -> {
                                // Space children live under their community
                            }
                            ui.roomType == "CHANNEL" -> {
                                channels.add(ui)
                                chats.add(ui)
                            }
                            else -> chats.add(ui)
                        }
                        if (ui.directUserId != null) {
                            val hero = info.heroes.firstOrNull()
                            contacts.add(
                                ContactEntity(
                                    userId = ui.directUserId,
                                    displayName = hero?.displayName ?: ui.name,
                                    avatarUrl = hero?.avatarUrl ?: ui.avatarUrl,
                                    statusMessage = "Contacto en Matrix",
                                    lastSeen = "en línea"
                                )
                            )
                        }
                    }
                    else -> {}
                }
            }

            // WhatsApp semantics: a new conversation that invites us shows up
            // in the chat list directly (not hidden behind a badge) — tapping
            // it accepts the invite in openRoom(). Merge BEFORE the DM dedup
            // so a fresh DM invite replaces the stale room of the same contact.
            chats.addAll(invites)

            // WhatsApp order: pinned first, then most recent
            chats.sortWith(compareByDescending<RoomEntity> { it.isPinned }.thenByDescending { it.lastTimestamp })

            // WhatsApp semantics: one conversation per contact. Matrix allows
            // several DM rooms with the same user (created by different
            // clients). Pick the room where the peer is still an active member
            // (stale rooms where the peer left never receive new messages),
            // then the most recently active, then pinned.
            val dmGroups = chats.filter { it.directUserId != null }
                .groupBy { it.directUserId!! }
            val bestDms = dmGroups.map { (_, group) ->
                group.sortedWith(
                    compareByDescending<RoomEntity> { c ->
                        val info = roomInfos[c.roomId]
                        if (info != null &&
                            (info.heroes.any { h -> h.userId == c.directUserId } ||
                             info.joinedMembersCount + info.invitedMembersCount >= 2uL)) 1 else 0
                    }.thenByDescending { it.lastTimestamp }
                        .thenByDescending { it.isPinned }
                ).first()
            }
            val dmIds = dmGroups.values.flatten().map { it.roomId }.toSet()
            val keepDmIds = bestDms.map { it.roomId }.toSet()
            // Losers of the DM dedup become archived (WhatsApp "Archivados") —
            // their history stays openable, they just don't clutter the list.
            val archived = chats.filter { it.roomId in dmIds && it.roomId !in keepDmIds }
            chats.removeAll { it.roomId in dmIds && it.roomId !in keepDmIds }
            invites.sortByDescending { it.lastTimestamp }

            _roomsFlow.value = chats
            _archivedRoomsFlow.value = archived.sortedByDescending { it.lastTimestamp }
            _invitesFlow.value = invites
            _allRoomsFlow.value = all
            _channelsFlow.value = channels
            _communitiesFlow.value = communities
            _contactsFlow.value = contacts.distinctBy { it.userId }
            Log.i(
                TAG,
                "rebuildLists: entries=${orderedRooms.size} infos=${roomInfos.size} " +
                    "chats=${chats.size} invites=${invites.size} all=${all.size} " +
                    "communities=${communities.size} channels=${channels.size} contacts=${contacts.size}"
            )
        }
    }

    private fun roomToUi(info: RoomInfo): RoomEntity {
        val isDirect = info.isDirect || info.isDm
        val hero = info.heroes.firstOrNull { it.userId != _sessionFlow.value?.userId }
        // WhatsApp semantics for private chats: the conversation is titled
        // after the OTHER person, even if m.room.name was set to something
        // else (e.g. another client naming the DM after its creator, which
        // would show our own name to ourselves).
        val name = if (isDirect) {
            hero?.displayName
                ?: info.displayName?.takeIf { it != _sessionFlow.value?.displayName }
                ?: hero?.userId?.removePrefix("@")?.substringBefore(":")
                ?: info.canonicalAlias
                ?: "Sala ${info.id.take(12)}"
        } else {
            info.displayName
                ?: info.rawName
                ?: hero?.displayName
                ?: info.canonicalAlias
                ?: "Sala ${info.id.take(12)}"
        }
        val latest = latestEvents[info.id]
        val preview = latestPreview(latest)
        val ts = latestTimestamp(latest)

        val roomType = when {
            info.isSpace -> "COMMUNITY"
            isDirect -> "DIRECT"
            info.isPublic == true -> "CHANNEL"
            else -> "GROUP"
        }

        return RoomEntity(
            roomId = info.id,
            name = name,
            topic = info.topic ?: "",
            avatarUrl = info.avatarUrl ?: hero?.avatarUrl,
            roomType = roomType,
            lastMessage = preview,
            lastTimestamp = ts,
            unreadCount = info.numUnreadNotifications.toInt().coerceAtLeast(info.numUnreadMessages.toInt()),
            isPinned = info.isFavourite,
            isMuted = false,
            isEncrypted = info.encryptionState == EncryptionState.ENCRYPTED,
            parentSpaceId = spaceParents[info.id],
            directUserId = if (isDirect) hero?.userId else null,
            hasActiveCall = info.hasRoomCall
        )
    }

    private fun inviteToUi(info: RoomInfo): RoomEntity {
        val inviter = info.inviter
        // Federated joins need `via` servers or the homeserver answers
        // M_NOT_FOUND. Element X collects them from the domains of every user
        // known to be in the room (inviter + heroes) — the inviter's server
        // alone may not host the room anymore (e.g. stale invites).
        val servers = buildList {
            info.id.substringAfter(":", "").takeIf { it.isNotBlank() }?.let { add(it) }
            inviter?.userId?.substringAfter(":", "")?.takeIf { it.isNotBlank() }?.let { add(it) }
            info.heroes.forEach { hero ->
                hero.userId.substringAfter(":", "").takeIf { it.isNotBlank() }?.let { add(it) }
            }
        }.distinct()
        if (servers.isNotEmpty()) inviteViaServers[info.id] = servers
        val isDirect = info.isDirect || info.isDm
        val otherHero = info.heroes.firstOrNull { it.userId != _sessionFlow.value?.userId }
        val name = if (isDirect) {
            otherHero?.displayName ?: inviter?.displayName
                ?: inviter?.userId?.removePrefix("@")?.substringBefore(":")
                ?: "Contacto"
        } else {
            info.displayName
                ?: inviter?.let { "Invitación de ${it.displayName ?: it.userId}" }
                ?: "Invitación a sala"
        }
        return RoomEntity(
            roomId = info.id,
            name = name,
            topic = "Invitación pendiente de Matrix",
            avatarUrl = info.avatarUrl ?: inviter?.avatarUrl ?: otherHero?.avatarUrl,
            roomType = "INVITE",
            // DM invites look like a normal chat entry (WhatsApp semantics) —
            // group/community invites keep the explicit invitation label.
            lastMessage = if (isDirect) {
                latestEvents[info.id]?.let { latestPreview(it) }?.takeIf { it.isNotBlank() }
                    ?: "Nueva conversación"
            } else "Has sido invitado a unirte a esta conversación",
            lastTimestamp = System.currentTimeMillis(),
            unreadCount = 1,
            directUserId = if (isDirect) (otherHero?.userId ?: inviter?.userId) else null
        )
    }

    private fun latestPreview(value: LatestEventValue?): String = when (value) {
        is LatestEventValue.Remote -> contentPreview(value.content).ifBlank { "Sala conectada" }
        is LatestEventValue.Local -> "Mensaje enviándose…"
        is LatestEventValue.RemoteInvite -> "Invitación recibida"
        else -> "Sala conectada"
    }

    private fun latestTimestamp(value: LatestEventValue?): Long = when (value) {
        is LatestEventValue.Remote -> value.timestamp.toLong()
        is LatestEventValue.Local -> value.timestamp.toLong()
        is LatestEventValue.RemoteInvite -> value.timestamp.toLong()
        // No event yet → sort last, not first (was System.currentTimeMillis(),
        // which pushed rooms without a loaded event to the top of the list).
        else -> 0L
    }

    private fun contentPreview(content: TimelineItemContent): String = when (content) {
        is TimelineItemContent.MsgLike -> when (val kind = content.content.kind) {
            is MsgLikeKind.Message -> kind.content.body
            is MsgLikeKind.Redacted -> "Mensaje eliminado"
            is MsgLikeKind.UnableToDecrypt -> "🔒 Mensaje cifrado no disponible"
            is MsgLikeKind.Poll -> "📊 Encuesta"
            is MsgLikeKind.Sticker -> kind.body.ifBlank { "Sticker" }
            is MsgLikeKind.LiveLocation -> "📍 Ubicación en vivo"
            else -> "Mensaje"
        }
        is TimelineItemContent.CallInvite -> "📞 Llamada"
        is TimelineItemContent.RtcNotification -> "📞 Llamada"
        is TimelineItemContent.RoomMembership -> "Cambio de miembros de la sala"
        is TimelineItemContent.ProfileChange -> "Actualización de perfil"
        is TimelineItemContent.State -> "Evento de sala"
        else -> ""
    }

    // ====================================================================
    // Timeline (conversation)
    // ====================================================================

    suspend fun openRoom(roomId: String) = withContext(Dispatchers.IO) {
        closeTimeline()
        _currentRoomId.value = roomId
        _currentMessages.value = emptyList()
        timelineItems.clear()

        val room = client?.getRoom(roomId) ?: return@withContext
        try {
            val info = room.roomInfo()
            _currentRoom.value = roomToUi(info)
            // WhatsApp semantics: tapping an invited conversation joins it —
            // no separate accept step needed to see the messages.
            if (info.membership == Membership.INVITED) {
                try {
                    joinInvitedRoom(roomId)
                    Log.i(TAG, "openRoom: auto-joined invited room $roomId")
                } catch (e: Exception) {
                    Log.w(TAG, "openRoom: join invited room failed: ${e.message}")
                }
            }
        } catch (_: Exception) {
        }

        try {
            val timeline = room.timeline()
            activeTimeline = timeline
            timelineHandle = timeline.addListener(object : TimelineListener {
                override fun onUpdate(diffs: List<TimelineDiff>) {
                    scope.launch { applyTimelineDiffs(diffs) }
                }
            })
            timeline.paginateBackwards(50u.toUShort())
            // Typing notifications (m.typing) for the "escribiendo…" indicator.
            try {
                val myId = _sessionFlow.value?.userId
                typingHandle?.cancel()
                typingHandle = room.subscribeToTypingNotifications(
                    object : TypingNotificationsListener {
                        override fun call(userIds: List<String>) {
                            _typingUsersFlow.value = userIds.filter { it != myId }
                        }
                    }
                )
            } catch (_: Exception) {
            }
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo abrir la conversación: ${e.localizedMessage}")
        }

        markRoomAsRead(roomId)
    }

    private suspend fun applyTimelineDiffs(diffs: List<TimelineDiff>) {
        synchronized(timelineItems) {
            for (d in diffs) {
                when (d) {
                    is TimelineDiff.Reset -> {
                        timelineItems.clear()
                        timelineItems.addAll(d.values)
                    }
                    is TimelineDiff.Append -> timelineItems.addAll(d.values)
                    is TimelineDiff.PushBack -> timelineItems.add(d.value)
                    is TimelineDiff.PushFront -> timelineItems.add(0, d.value)
                    is TimelineDiff.PopBack -> if (timelineItems.isNotEmpty()) timelineItems.removeAt(timelineItems.size - 1)
                    is TimelineDiff.PopFront -> if (timelineItems.isNotEmpty()) timelineItems.removeAt(0)
                    is TimelineDiff.Insert -> {
                        val i = d.index.toInt().coerceIn(0, timelineItems.size)
                        timelineItems.add(i, d.value)
                    }
                    is TimelineDiff.Remove -> {
                        val i = d.index.toInt()
                        if (i in timelineItems.indices) timelineItems.removeAt(i)
                    }
                    is TimelineDiff.Set -> {
                        val i = d.index.toInt()
                        if (i in timelineItems.indices) timelineItems[i] = d.value
                    }
                    is TimelineDiff.Truncate -> {
                        val len = d.length.toInt()
                        while (timelineItems.size > len) timelineItems.removeAt(timelineItems.size - 1)
                    }
                    is TimelineDiff.Clear -> timelineItems.clear()
                }
            }
            _currentMessages.value = timelineItems.mapNotNull { timelineItemToMessage(it) }
        }
    }

    private fun timelineItemToMessage(item: TimelineItem): MessageEntity? {
        val event = item.asEvent() ?: return null
        val content = event.content
        val text = contentPreview(content)
        if (text.isBlank()) return null

        val eventId = when (val id = event.eventOrTransactionId) {
            is EventOrTransactionId.EventId -> id.eventId
            is EventOrTransactionId.TransactionId -> id.transactionId
        }

        val senderName = (event.senderProfile as? ProfileDetails.Ready)?.displayName
            ?: if (event.isOwn) "Yo" else event.sender.removePrefix("@").substringBefore(":")

        val status = when (val sendState = event.localSendState) {
            null -> "READ"
            is EventSendState.Sent -> "DELIVERED"
            is EventSendState.NotSentYet -> "SENDING"
            is EventSendState.SendingFailed -> "FAILED"
            else -> "READ"
        }

        var mediaUrl: String? = null
        var mediaSourceJson: String? = null
        var mediaFilename: String? = null
        var callIsVideo = false
        var pollQuestion: String? = null
        var pollAnswerIds = emptyList<String>()
        var pollAnswers = emptyList<String>()
        var pollMaxSelections = 1
        var locationGeoUri: String? = null
        var reactions = emptyList<com.example.data.model.ReactionUi>()
        var replyToEventId: String? = null
        var replyToSender: String? = null
        var replyToText: String? = null
        var isEdited = false
        var isDeleted = false

        fun mediaUrlFor(source: MediaSource): String {
            // Keep the full JSON — it carries the E2EE decryption key that
            // url() alone drops.
            mediaSourceJson = try { source.toJson() } catch (_: Exception) { null }
            val url = source.url()
            // Local echo URLs (send-queue.localhost/<txn>/<filename>) can't be
            // opened — swap in the real file we just uploaded.
            if (url.contains("send-queue.localhost")) {
                val name = try {
                    java.net.URLDecoder.decode(url.substringAfterLast('/'), "UTF-8")
                } catch (_: Exception) {
                    url.substringAfterLast('/')
                }
                pendingLocalMedia[name]?.let { return it }
                // Filename may differ after the send queue rewrites it —
                // match any pending upload whose name appears in the URL.
                pendingLocalMedia.entries.firstOrNull { url.contains(it.key) }
                    ?.let { return it.value }
                // Last resort: the most recently queued upload.
                pendingLocalMedia.entries.lastOrNull()?.let { return it.value }
            }
            return url
        }

        val messageType = when (content) {
            is TimelineItemContent.RtcNotification -> {
                callIsVideo = content.callIntent?.contains("video", ignoreCase = true) == true
                "CALL"
            }
            is TimelineItemContent.MsgLike -> {
                // Reactions (emoji → senders), reply info, redactions, edits.
                val myId = _sessionFlow.value?.userId
                reactions = content.content.reactions.map { r ->
                    com.example.data.model.ReactionUi(
                        emoji = r.key,
                        count = r.senders.size,
                        includesMe = myId != null && r.senders.any { it.senderId == myId },
                        senders = r.senders.map { it.senderId }
                    )
                }
                val reply = content.content.inReplyTo
                if (reply != null) {
                    replyToEventId = reply.eventId()
                    val ready = reply.event() as? EmbeddedEventDetails.Ready
                    replyToSender = (ready?.senderProfile as? ProfileDetails.Ready)?.displayName
                        ?: ready?.sender?.removePrefix("@")?.substringBefore(":")
                    replyToText = ready?.content?.let { rc ->
                        (rc as? TimelineItemContent.MsgLike)?.let { ml ->
                            (ml.content.kind as? MsgLikeKind.Message)?.content?.body
                                ?: (ml.content.kind as? MsgLikeKind.Poll)?.question
                                ?: (ml.content.kind as? MsgLikeKind.Redacted)?.let { "Mensaje eliminado" }
                                ?: (ml.content.kind as? MsgLikeKind.Sticker)?.let { "Sticker" }
                                ?: "Adjunto"
                        }
                    }
                }
                when (val kind = content.content.kind) {
                is MsgLikeKind.Message -> {
                    isEdited = kind.content.isEdited
                    when (val t = kind.content.msgType) {
                    is org.matrix.rustcomponents.sdk.MessageType.Image -> {
                        mediaUrl = mediaUrlFor(t.content.source)
                        mediaFilename = t.content.filename
                        "IMAGE"
                    }
                    is org.matrix.rustcomponents.sdk.MessageType.Audio -> {
                        mediaUrl = mediaUrlFor(t.content.source)
                        mediaFilename = t.content.filename
                        "AUDIO"
                    }
                    is org.matrix.rustcomponents.sdk.MessageType.Video -> {
                        mediaUrl = mediaUrlFor(t.content.source)
                        mediaFilename = t.content.filename
                        "VIDEO"
                    }
                    is org.matrix.rustcomponents.sdk.MessageType.File -> {
                        mediaUrl = mediaUrlFor(t.content.source)
                        mediaFilename = t.content.filename
                        "DOCUMENT"
                    }
                    is org.matrix.rustcomponents.sdk.MessageType.Location -> {
                        locationGeoUri = t.content.geoUri
                        mediaFilename = null
                        "LOCATION"
                    }
                        else -> "TEXT"
                    }
                }
                is MsgLikeKind.Poll -> {
                    pollQuestion = kind.question
                    pollAnswerIds = kind.answers.map { it.id }
                    pollAnswers = kind.answers.map { it.text }
                    pollMaxSelections = kind.maxSelections.toInt().coerceAtLeast(1)
                    "POLL"
                }
                is MsgLikeKind.Sticker -> {
                    mediaUrl = mediaUrlFor(kind.source)
                    "IMAGE"
                }
                is MsgLikeKind.Redacted -> {
                    isDeleted = true
                    "TEXT"
                }
                else -> "TEXT"
                }
            }
            else -> "SYSTEM"
        }

        return MessageEntity(
            id = eventId,
            roomId = _currentRoomId.value ?: "",
            senderId = event.sender,
            senderName = senderName,
            content = if (mediaFilename != null && text.isBlank()) mediaFilename else text,
            timestamp = event.timestamp.toLong(),
            status = status,
            isOutgoing = event.isOwn,
            messageType = messageType,
            mediaUrl = mediaUrl,
            mediaSourceJson = mediaSourceJson,
            callIsVideo = callIsVideo,
            pollQuestion = pollQuestion,
            pollAnswerIds = pollAnswerIds,
            pollAnswers = pollAnswers,
            pollMaxSelections = pollMaxSelections,
            locationGeoUri = locationGeoUri,
            reactions = reactions,
            replyToEventId = replyToEventId,
            replyToSender = replyToSender,
            replyToText = replyToText,
            isEdited = isEdited,
            isDeleted = isDeleted,
            isPinned = roomInfos[_currentRoomId.value]?.pinnedEventIds?.contains(eventId) == true
        )
    }

    /**
     * Resolves an mxc:// media URL to a local decrypted file path using the
     * SDK's media cache (handles E2EE attachments transparently).
     */
    /**
     * [sourceOrUrl] is the MediaSource JSON (keeps E2EE keys); falls back to
     * treating it as a plain mxc:// URL for unencrypted rooms.
     */
    suspend fun resolveMediaFile(sourceOrUrl: String, mimeType: String, filename: String): String? =
        withContext(Dispatchers.IO) {
            try {
                val source = try {
                    MediaSource.fromJson(sourceOrUrl)
                } catch (_: Exception) {
                    MediaSource.fromUrl(sourceOrUrl)
                }
                // getMediaFile parses the mime strictly — events can carry a
                // malformed mimetype (e.g. "jpeg" or empty); fall back to
                // octet-stream instead of failing the whole download.
                val mime = if (mimeType.contains('/')) mimeType else "application/octet-stream"
                val handle = client?.getMediaFile(
                    source,
                    mime,
                    filename,
                    true,
                    mediaCacheDir.absolutePath
                ) ?: return@withContext null
                val path = handle.path()
                handle.destroy()
                path
            } catch (e: Exception) {
                Log.e(TAG, "resolveMediaFile(${sourceOrUrl.take(120)}) failed", e)
                null
            }
        }

    private val mediaCacheDir: java.io.File by lazy {
        java.io.File(sessionManager.mediaCachePath).apply { mkdirs() }
    }

    /** Copies a content:// URI picked by the user into a cache file so the SDK
     * (which needs real filesystem paths) can upload it. Returns null on
     * failure. */
    suspend fun copyUriToCache(uri: android.net.Uri): String? = withContext(Dispatchers.IO) {
        try {
            val resolver = sessionManager.appContext.contentResolver
            val name = resolver.query(uri, null, null, null, null)?.use { c ->
                val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (c.moveToFirst() && idx >= 0) c.getString(idx) else null
            } ?: "attachment_${System.currentTimeMillis()}"
            val safeName = name.replace(Regex("[^A-Za-z0-9._() -]"), "_")
            val uploadDir = java.io.File(
                sessionManager.appContext.cacheDir,
                "uploads/${System.currentTimeMillis()}"
            ).apply { mkdirs() }
            val out = java.io.File(uploadDir, safeName)
            resolver.openInputStream(uri)?.use { input ->
                out.outputStream().use { input.copyTo(it) }
            } ?: return@withContext null
            out.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "copyUriToCache failed", e)
            null
        }
    }

    /** Best-effort MIME type for a picked URI or its copied file. */
    fun mimeTypeFor(uri: android.net.Uri, path: String): String {
        sessionManager.appContext.contentResolver.getType(uri)?.let { return it }
        val ext = path.substringAfterLast('.', "")
        return android.webkit.MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(ext.lowercase())
            ?: "application/octet-stream"
    }

    suspend fun loadMoreHistory(): Boolean = withContext(Dispatchers.IO) {
        val timeline = activeTimeline ?: return@withContext false
        try {
            timeline.paginateBackwards(50u.toUShort())
        } catch (_: Exception) {
            false
        }
    }

    suspend fun closeTimeline() = withContext(Dispatchers.IO) {
        // TaskHandle.cancel() / Timeline.destroy() are FFI calls that wait on
        // Rust-side locks — if the timeline is mid-sync they block the caller.
        // Never run this on the main thread (caused chat-exit freezes).
        timelineHandle?.cancel()
        timelineHandle = null
        typingHandle?.cancel()
        typingHandle = null
        _typingUsersFlow.value = emptyList()
        activeTimeline?.destroy()
        activeTimeline = null
        timelineItems.clear()
    }

    // ====================================================================
    // Messaging / rooms
    // ====================================================================

    suspend fun sendMessage(roomId: String, text: String): Boolean = withContext(Dispatchers.IO) {
        if (text.isBlank()) return@withContext false
        val session = _sessionFlow.value
        if (session?.isDemoMode == true) {
            return@withContext true
        }
        try {
            val timeline = timelineFor(roomId)
            timeline?.send(messageEventContentFromMarkdown(text.trim()))
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo enviar el mensaje: ${e.localizedMessage}")
            false
        }
    }

    /** Sends [text] as a reply (m.in_reply_to) to the event [replyToEventId]. */
    suspend fun sendReply(roomId: String, replyToEventId: String, text: String): Boolean =
        withContext(Dispatchers.IO) {
            if (text.isBlank()) return@withContext false
            try {
                timelineFor(roomId)?.sendReply(
                    messageEventContentFromMarkdown(text.trim()), replyToEventId
                )
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo responder: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Edits a sent message (m.replace). Only own messages are editable. */
    suspend fun editMessage(roomId: String, eventId: String, newText: String): Boolean =
        withContext(Dispatchers.IO) {
            if (newText.isBlank()) return@withContext false
            try {
                timelineFor(roomId)?.edit(
                    EventOrTransactionId.EventId(eventId),
                    org.matrix.rustcomponents.sdk.EditedContent.RoomMessage(
                        messageEventContentFromMarkdown(newText.trim())
                    )
                )
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo editar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Deletes a message (redaction — "Eliminar para todos"). */
    suspend fun redactMessage(roomId: String, eventId: String, reason: String? = null): Boolean =
        withContext(Dispatchers.IO) {
            try {
                timelineFor(roomId)?.redactEvent(EventOrTransactionId.EventId(eventId), reason)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo eliminar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Toggles an emoji reaction (m.reaction annotation) on a message. */
    suspend fun toggleReaction(roomId: String, eventId: String, emoji: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                timelineFor(roomId)?.toggleReaction(EventOrTransactionId.EventId(eventId), emoji)
                true
            } catch (e: Exception) {
                Log.w(TAG, "toggleReaction failed: ${e.message}")
                false
            }
        }

    /** Pins/unpins a message in the room (m.pinned_events). */
    suspend fun setMessagePinned(roomId: String, eventId: String, pinned: Boolean): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val timeline = timelineFor(roomId)
                if (pinned) timeline?.pinEvent(eventId) else timeline?.unpinEvent(eventId)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo fijar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Sends a typing notification (debounced by the caller). */
    suspend fun sendTypingNotice(roomId: String, isTyping: Boolean) = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.typingNotice(isTyping)
        } catch (_: Exception) {
        }
    }

    /** Marks the timeline as read (m.read receipt to latest event). */
    suspend fun markTimelineRead(roomId: String) = withContext(Dispatchers.IO) {
        try {
            timelineFor(roomId)?.markAsRead(ReceiptType.READ)
        } catch (_: Exception) {
        }
    }

    /** Reports a message to the homeserver admin (CS API /report). */
    suspend fun reportEvent(roomId: String, eventId: String, reason: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.reportContent(eventId, reason)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo reportar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Reports the room itself to the homeserver admin. */
    suspend fun reportRoom(roomId: String, reason: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.reportRoom(reason)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo reportar la sala: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** User-defined notification mode for a room (null = default). */
    suspend fun getRoomNotificationMode(roomId: String): RoomNotificationMode? =
        withContext(Dispatchers.IO) {
            try {
                client?.getNotificationSettings()
                    ?.getUserDefinedRoomNotificationMode(roomId)
            } catch (_: Exception) {
                null
            }
        }

    /** Sets the per-room notification mode (push rules — like Element's
     *  All messages / Mentions & keywords / Mute). */
    suspend fun setRoomNotificationMode(roomId: String, mode: RoomNotificationMode): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getNotificationSettings()?.setRoomNotificationMode(roomId, mode)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo cambiar notificaciones: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Timeline for the currently open room (falls back to building one).
     * getRoom()/timeline() are synchronous FFI calls — keep off the main
     * thread even when callers forget. */
    private suspend fun timelineFor(roomId: String): Timeline? = withContext(Dispatchers.IO) {
        if (_currentRoomId.value == roomId) activeTimeline
            ?: client?.getRoom(roomId)?.timeline()
        else client?.getRoom(roomId)?.timeline()
    }

    // Local echo of sent attachments uses send-queue.localhost URLs that can't
    // be opened. Keep filename -> local path so own bubbles render instantly.
    private val pendingLocalMedia = java.util.concurrent.ConcurrentHashMap<String, String>()

    private fun uploadParams(path: String, caption: String? = null) = UploadParameters(
        source = UploadSource.File(path),
        caption = caption,
        formattedCaption = null,
        mentions = null,
        inReplyTo = null,
        extraContentJson = null
    )

    /** Rooms whose stories invite we already tried to auto-join. */
    private val storyRoomJoinAttempts = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    /** Display names of everyone who responded to a poll (m.reference
     * relations of the poll start event). */
    suspend fun pollVoters(roomId: String, pollStartEventId: String): List<String> =
        withContext(Dispatchers.IO) {
            try {
                val room = client?.getRoom(roomId) ?: return@withContext emptyList()
                val result = room.loadOrFetchEventWithRelations(
                    pollStartEventId, listOf(RelationType.REFERENCE)
                )
                result.relatedEvents.map { ev ->
                    val sender = ev.senderId()
                    try {
                        room.member(sender)?.displayName
                            ?: sender.removePrefix("@").substringBefore(":")
                    } catch (_: Exception) {
                        sender
                    }
                }.distinct()
            } catch (e: Exception) {
                Log.w(TAG, "pollVoters failed: ${e.message}")
                emptyList()
            }
        }

    /** Votes in a poll (m.poll.response) — answerIds reference the poll's
     * m.poll.start event answers. */
    suspend fun votePoll(roomId: String, pollStartEventId: String, answerIds: List<String>): Boolean =
        withContext(Dispatchers.IO) {
            try {
                timelineFor(roomId)?.sendPollResponse(pollStartEventId, answerIds)
                true
            } catch (e: Exception) {
                Log.e(TAG, "votePoll failed", e)
                errorEvents.tryEmit("No se pudo votar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /**
     * Sends an attachment (image/video/audio/file/voice note) through the SDK
     * timeline. [kind] is one of "image", "video", "audio", "voice", "file".
     * The file must already live on the filesystem (content URIs are copied to
     * the app cache by the caller).
     */
    suspend fun sendAttachment(
        roomId: String,
        path: String,
        mimeType: String,
        kind: String,
        caption: String? = null,
        durationMs: Long? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val timeline = timelineFor(roomId) ?: return@withContext false
            val file = java.io.File(path)
            val size = file.length().toULong()
            pendingLocalMedia[file.name] = path
            val params = uploadParams(path, caption)
            val handle = when (kind) {
                "image" -> {
                    val dim = imageDimensions(path)
                    timeline.sendImage(
                        params,
                        UploadSource.File(path),
                        ImageInfo(
                            height = dim?.second?.toULong(),
                            width = dim?.first?.toULong(),
                            mimetype = mimeType,
                            size = size,
                            thumbnailInfo = null,
                            thumbnailSource = null,
                            blurhash = null,
                            isAnimated = null
                        )
                    )
                }
                "video" -> timeline.sendVideo(
                    params,
                    UploadSource.File(path),
                    VideoInfo(
                        duration = durationMs?.let { java.time.Duration.ofMillis(it) },
                        height = null,
                        width = null,
                        mimetype = mimeType,
                        size = size,
                        thumbnailInfo = null,
                        thumbnailSource = null,
                        blurhash = null
                    )
                )
                "voice" -> timeline.sendVoiceMessage(
                    params,
                    AudioInfo(
                        duration = durationMs?.let { java.time.Duration.ofMillis(it) },
                        mimetype = mimeType,
                        size = size
                    ),
                    emptyList()
                )
                "audio" -> timeline.sendAudio(
                    params,
                    AudioInfo(
                        duration = durationMs?.let { java.time.Duration.ofMillis(it) },
                        mimetype = mimeType,
                        size = size
                    )
                )
                else -> timeline.sendFile(
                    params,
                    FileInfo(
                        mimetype = mimeType,
                        size = size,
                        thumbnailInfo = null,
                        thumbnailSource = null
                    )
                )
            }
            handle.join()
            true
        } catch (e: Exception) {
            Log.e(TAG, "sendAttachment($kind) failed", e)
            errorEvents.tryEmit("No se pudo enviar el adjunto: ${friendlyMatrixError(e)}")
            false
        }
    }

    private fun imageDimensions(path: String): Pair<Int, Int>? = try {
        val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(path, opts)
        if (opts.outWidth > 0 && opts.outHeight > 0) opts.outWidth to opts.outHeight else null
    } catch (_: Exception) {
        null
    }

    suspend fun sendLocation(roomId: String, latitude: Double, longitude: Double): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val timeline = timelineFor(roomId) ?: return@withContext false
                val geoUri = "geo:$latitude,$longitude"
                timeline.sendLocation(
                    "Ubicación compartida",
                    geoUri,
                    "Ubicación actual",
                    null,
                    org.matrix.rustcomponents.sdk.AssetType.PIN,
                    null
                )
                true
            } catch (e: Exception) {
                Log.e(TAG, "sendLocation failed", e)
                errorEvents.tryEmit("No se pudo enviar la ubicación: ${friendlyMatrixError(e)}")
                false
            }
        }

    suspend fun sendPoll(
        roomId: String,
        question: String,
        answers: List<String>,
        allowMultipleAnswers: Boolean
    ): Boolean = withContext(Dispatchers.IO) {
            try {
                val timeline = timelineFor(roomId) ?: return@withContext false
                timeline.createPoll(
                    question,
                    answers.filter { it.isNotBlank() },
                    (if (allowMultipleAnswers) answers.size.coerceAtMost(255) else 1).toUByte(),
                    org.matrix.rustcomponents.sdk.PollKind.DISCLOSED
                )
                true
            } catch (e: Exception) {
                Log.e(TAG, "createPoll failed", e)
                errorEvents.tryEmit("No se pudo crear la encuesta: ${friendlyMatrixError(e)}")
                false
            }
        }

    // ----- Room details / members -----

    data class RoomMemberUi(
        val userId: String,
        val displayName: String,
        val avatarUrl: String?,
        val role: String // "ADMIN", "MODERATOR", "USER"
    )

    suspend fun getRoomMembers(roomId: String): List<RoomMemberUi> = withContext(Dispatchers.IO) {
        try {
            val room = client?.getRoom(roomId) ?: return@withContext emptyList()
            val iterator = room.members()
            val out = mutableListOf<RoomMemberUi>()
            val total = iterator.len().toInt()
            var fetched = 0
            while (fetched < total) {
                val chunk = iterator.nextChunk(50u) ?: break
                if (chunk.isEmpty()) break
                fetched += chunk.size
                chunk.forEach { m ->
                    if (m.membership == MembershipState.Join) {
                        out.add(
                            RoomMemberUi(
                                userId = m.userId,
                                displayName = m.displayName ?: m.userId,
                                avatarUrl = m.avatarUrl,
                                role = m.suggestedRoleForPowerLevel.name
                            )
                        )
                    }
                }
            }
            iterator.destroy()
            out.sortedBy { it.displayName.lowercase() }
        } catch (e: Exception) {
            Log.e(TAG, "getRoomMembers($roomId) failed", e)
            emptyList()
        }
    }

    suspend fun inviteUserToRoom(roomId: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.inviteUserById(userId.trim())
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo invitar: ${friendlyMatrixError(e)}")
            false
        }
    }

    /** My power level in [roomId] (0 user, 50 moderator, 100 admin). */
    suspend fun getMyPowerLevel(roomId: String): Long = withContext(Dispatchers.IO) {
        try {
            val room = client?.getRoom(roomId) ?: return@withContext 0L
            val myId = client?.userId() ?: return@withContext 0L
            val pl = room.member(myId).powerLevel
            (pl as? org.matrix.rustcomponents.sdk.PowerLevel.Value)?.value ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    suspend fun renameRoom(roomId: String, name: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.setName(name.trim())
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo renombrar: ${friendlyMatrixError(e)}")
            false
        }
    }

    suspend fun setRoomTopic(roomId: String, topic: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.setTopic(topic.trim())
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo cambiar el tema: ${friendlyMatrixError(e)}")
            false
        }
    }

    suspend fun kickRoomMember(roomId: String, userId: String, reason: String? = null): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.kickUser(userId, reason)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo eliminar: ${friendlyMatrixError(e)}")
                false
            }
        }

    suspend fun banRoomMember(roomId: String, userId: String, reason: String? = null): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.banUser(userId, reason)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo bloquear: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Sets a member's power level: 0 = usuario, 50 = moderador, 100 = admin. */
    suspend fun setMemberPowerLevel(roomId: String, userId: String, powerLevel: Long): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.updatePowerLevelsForUsers(
                    listOf(org.matrix.rustcomponents.sdk.UserPowerLevelUpdate(userId, powerLevel))
                )
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo cambiar el rol: ${friendlyMatrixError(e)}")
                false
            }
        }

    suspend fun leaveRoom(roomId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.leave()
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo salir de la sala: ${friendlyMatrixError(e)}")
            false
        }
    }

    /** Leaves AND forgets the room — removes it from the account and purges
     * its local data (what users expect from "eliminar chat/grupo"). */
    suspend fun deleteRoom(roomId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val room = client?.getRoom(roomId) ?: return@withContext false
            runCatching { room.leave() }
            room.forget()
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo eliminar: ${friendlyMatrixError(e)}")
            false
        }
    }

    /** Uploads a new avatar image for the room (m.room.avatar state event). */
    suspend fun setRoomAvatar(roomId: String, data: ByteArray, mime: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.uploadAvatar(
                    mime, data,
                    ImageInfo(
                        height = null, width = null, mimetype = mime,
                        size = data.size.toULong(), thumbnailInfo = null,
                        thumbnailSource = null, blurhash = null, isAnimated = null
                    )
                )
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo cambiar la foto: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Changes the room's visibility (public directory ↔ invite-only). */
    suspend fun setRoomPublic(roomId: String, public: Boolean): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.getRoom(roomId)?.updateRoomVisibility(
                    if (public) RoomVisibility.Public else RoomVisibility.Private
                )
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo cambiar la visibilidad: ${friendlyMatrixError(e)}")
                false
            }
        }

    // ====================================================================
    // Account / settings (Element-style settings screen)
    // ====================================================================

    /** Uploads the account's own avatar (profile avatar_url). */
    suspend fun uploadAccountAvatar(data: ByteArray, mime: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                client?.uploadAvatar(mime, data)
                refreshSessionInfo()
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo subir la foto: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** This device's public E2EE identity keys (Element's "Clave de sesión"). */
    suspend fun getSessionKeys(): Pair<String?, String?> = withContext(Dispatchers.IO) {
        try {
            client?.encryption()?.let { it.ed25519Key() to it.curve25519Key() }
                ?: (null to null)
        } catch (_: Exception) {
            null to null
        }
    }

    /** Global notification preferences (push rules) for the settings screen. */
    data class NotificationPrefs(
        val userMentions: Boolean,
        val roomMentions: Boolean,
        val invites: Boolean,
        val calls: Boolean
    )

    suspend fun getNotificationPrefs(): NotificationPrefs? = withContext(Dispatchers.IO) {
        try {
            val ns = client?.getNotificationSettings() ?: return@withContext null
            NotificationPrefs(
                userMentions = ns.isUserMentionEnabled(),
                roomMentions = ns.isRoomMentionEnabled(),
                invites = ns.isInviteForMeEnabled(),
                calls = ns.isCallEnabled()
            )
        } catch (_: Exception) {
            null
        }
    }

    suspend fun setNotificationPrefs(prefs: NotificationPrefs): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val ns = client?.getNotificationSettings() ?: return@withContext false
                ns.setUserMentionEnabled(prefs.userMentions)
                ns.setRoomMentionEnabled(prefs.roomMentions)
                ns.setInviteForMeEnabled(prefs.invites)
                ns.setCallEnabled(prefs.calls)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo guardar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Account management URL (MSC2965) for session/device management —
     * returns null on homeservers without the account management API. */
    suspend fun accountManagementUrl(action: AccountManagementAction): String? =
        withContext(Dispatchers.IO) {
            try {
                client?.accountUrl(action)
            } catch (_: Exception) {
                null
            }
        }

    suspend fun getIgnoredUsers(): List<String> = withContext(Dispatchers.IO) {
        try {
            client?.ignoredUsers() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun setUserIgnored(userId: String, ignored: Boolean): Boolean =
        withContext(Dispatchers.IO) {
            try {
                if (ignored) client?.ignoreUser(userId) else client?.unignoreUser(userId)
                true
            } catch (e: Exception) {
                errorEvents.tryEmit("No se pudo actualizar: ${friendlyMatrixError(e)}")
                false
            }
        }

    /** Purges the SDK's local media/event caches (keeps the session). */
    suspend fun clearLocalCaches(): Boolean = withContext(Dispatchers.IO) {
        try {
            val service = sessionManager.syncService ?: return@withContext false
            client?.clearCaches(service)
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo limpiar la caché: ${friendlyMatrixError(e)}")
            false
        }
    }

    /** User directory search (POST /user_directory/search) — for starting
     * chats with people who aren't contacts yet, like Element's picker. */
    data class DirectoryUser(
        val userId: String,
        val displayName: String?,
        val avatarUrl: String?
    )

    suspend fun searchUserDirectory(query: String): List<DirectoryUser> =
        withContext(Dispatchers.IO) {
            try {
                client?.searchUsers(query, 20u)?.results?.map {
                    DirectoryUser(it.userId, it.displayName, it.avatarUrl)
                } ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
        }

    suspend fun getRoomTopic(roomId: String): String? = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.roomInfo()?.topic
        } catch (_: Exception) {
            null
        }
    }

    // ----- Public room directory (explore) -----

    data class PublicRoomUi(
        val roomId: String,
        val name: String,
        val topic: String,
        val numJoinedMembers: Int,
        val alias: String?,
        val avatarUrl: String?,
        val isWorldReadable: Boolean
    )

    private fun RoomDescription.toUi() = PublicRoomUi(
        roomId = roomId,
        name = name ?: alias ?: roomId,
        topic = topic ?: "",
        numJoinedMembers = joinedMembers.toInt(),
        alias = alias,
        avatarUrl = avatarUrl,
        isWorldReadable = isWorldReadable
    )

    suspend fun searchPublicRooms(query: String): List<PublicRoomUi> = withContext(Dispatchers.IO) {
        try {
            val search = client?.roomDirectorySearch() ?: return@withContext emptyList()
            withTimeoutOrNull(20_000) {
                kotlinx.coroutines.suspendCancellableCoroutine<List<PublicRoomUi>> { cont ->
                    scope.launch {
                        try {
                            search.results(object : RoomDirectorySearchEntriesListener {
                                override fun onUpdate(entries: List<RoomDirectorySearchEntryUpdate>) {
                                    val rooms = mutableListOf<PublicRoomUi>()
                                    entries.forEach { update ->
                                        when (update) {
                                            is RoomDirectorySearchEntryUpdate.Set -> rooms.add(update.value.toUi())
                                            is RoomDirectorySearchEntryUpdate.Append -> rooms.addAll(update.values.map { it.toUi() })
                                            is RoomDirectorySearchEntryUpdate.Reset -> rooms.addAll(update.values.map { it.toUi() })
                                            else -> {}
                                        }
                                    }
                                    if (rooms.isNotEmpty() && cont.isActive) cont.resume(rooms) {}
                                }
                            })
                            search.search(query.ifBlank { "" }, 30u, null)
                        } catch (e: Exception) {
                            if (cont.isActive) cont.resumeWith(Result.failure(e))
                        }
                    }
                }
            } ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "searchPublicRooms failed", e)
            emptyList()
        }
    }

    /** Finds an existing DM room with [userId] — first via the m.direct
     * account data (client.getDmRoom, same lookup Element uses), then by
     * scanning joined direct rooms whose other member is that user (covers
     * rooms other clients forgot to register in m.direct). */
    suspend fun findDmRoom(userId: String): String? = withContext(Dispatchers.IO) {
        try {
            client?.getDmRoom(userId)?.let { return@withContext it.id() }
        } catch (_: Exception) {
        }
        listLock.withLock {
            roomInfos.values.firstOrNull { info ->
                info.membership == Membership.JOINED &&
                    (info.isDirect || info.isDm) &&
                    info.joinedMembersCount <= 2uL &&
                    info.heroes.any { it.userId == userId }
            }?.id
        }
    }

    suspend fun joinPublicRoom(roomIdOrAlias: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val server = roomIdOrAlias.substringAfter(":", "").takeIf { it.isNotBlank() }
            client?.joinRoomByIdOrAlias(roomIdOrAlias, listOfNotNull(server))
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo unir a la sala: ${friendlyMatrixError(e)}")
            false
        }
    }

    suspend fun createRoom(
        name: String?,
        topic: String = "",
        roomType: String = "GROUP",
        isDirect: Boolean = false,
        inviteUserId: String? = null,
        parentSpaceId: String? = null,
        isPublic: Boolean = false,
        inviteIds: List<String> = emptyList(),
        encrypt: Boolean = true
    ): String = withContext(Dispatchers.IO) {
        val session = _sessionFlow.value
        if (session?.isDemoMode == true) {
            val demoId = "!demo_" + UUID.randomUUID().toString().take(8) + ":demo"
            return@withContext demoId
        }
        val c = client ?: return@withContext ""
        val publicRoom = isPublic || roomType == "CHANNEL"
        try {
            c.createRoom(
                CreateRoomParameters(
                    name = name,
                    topic = topic,
                    // Public rooms can't be E2EE (Element forces this off too).
                    isEncrypted = if (publicRoom) false else encrypt,
                    isDirect = isDirect,
                    visibility = if (publicRoom) RoomVisibility.Public else RoomVisibility.Private,
                    preset = if (publicRoom) RoomPreset.PUBLIC_CHAT else RoomPreset.TRUSTED_PRIVATE_CHAT,
                    invite = (inviteIds + listOfNotNull(inviteUserId)).distinct(),
                    avatar = null,
                    powerLevelContentOverride = null,
                    joinRuleOverride = null,
                    historyVisibilityOverride = null,
                    canonicalAlias = null,
                    isSpace = roomType == "COMMUNITY"
                )
            )
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo crear la sala: ${e.localizedMessage}")
            ""
        }
    }

    suspend fun acceptInvite(roomId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            joinInvitedRoom(roomId)
            true
        } catch (e: Exception) {
            Log.e(TAG, "acceptInvite($roomId) failed", e)
            errorEvents.tryEmit("No se pudo aceptar la invitación: ${friendlyMatrixError(e)}")
            false
        }
    }

    suspend fun rejectInvite(roomId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val room = client?.getRoom(roomId)
            if (room == null) {
                errorEvents.tryEmit("Sala no encontrada")
                return@withContext false
            }
            room.leave()
            true
        } catch (e: Exception) {
            Log.e(TAG, "rejectInvite($roomId) failed", e)
            errorEvents.tryEmit("No se pudo rechazar la invitación: ${friendlyMatrixError(e)}")
            false
        }
    }

    /** Extracts a readable message from SDK exceptions, which often embed the
     * server's JSON error body ({"errcode":…,"error":…}) in their message. */
    private fun friendlyMatrixError(e: Exception): String {
        val raw = e.localizedMessage ?: return "Error desconocido"
        val jsonStart = raw.indexOf('{')
        if (jsonStart >= 0) {
            try {
                val json = JSONObject(raw.substring(jsonStart))
                json.optString("error").takeIf { it.isNotBlank() }?.let { return it }
            } catch (_: Exception) {
            }
        }
        // SDK errors can be multi-line dumps — keep snackbars readable.
        return raw.lineSequence().firstOrNull()?.take(140) ?: "Error desconocido"
    }

    /** Joins an invited room. Prefer the Room object's join() (the SDK knows
     * the invite context); fall back to a federated join with the inviter's
     * server as `via` to avoid M_NOT_FOUND on remote rooms. A timeout keeps a
     * stuck federated join from hanging the call forever. */
    private suspend fun joinInvitedRoom(roomId: String) {
        val via = inviteViaServers[roomId].orEmpty()
        withContext(Dispatchers.IO) {
            withTimeoutOrNull(45_000) {
                try {
                    client?.getRoom(roomId)?.join() ?: client?.joinRoomByIdOrAlias(roomId, via)
                } catch (e: Exception) {
                    Log.w(TAG, "room.join() failed for $roomId (${friendlyMatrixError(e)}), retrying with via=$via")
                    client?.joinRoomByIdOrAlias(roomId, via) ?: throw e
                }
            } ?: error("El servidor tardó demasiado en responder al unirse a la sala")
        }
    }

    suspend fun acceptAllInvites(): Int = withContext(Dispatchers.IO) {
        var accepted = 0
        for (inv in _invitesFlow.value) {
            try {
                joinInvitedRoom(inv.roomId)
                accepted++
            } catch (e: Exception) {
                Log.e(TAG, "acceptAllInvites(${inv.roomId}) failed", e)
                errorEvents.tryEmit("Fallo al unirse a ${inv.name}: ${friendlyMatrixError(e)}")
            }
        }
        accepted
    }

    suspend fun rejectAllInvites(): Int = withContext(Dispatchers.IO) {
        var rejected = 0
        for (inv in _invitesFlow.value) {
            try {
                client?.getRoom(inv.roomId)?.leave()
                rejected++
            } catch (e: Exception) {
                Log.e(TAG, "rejectAllInvites(${inv.roomId}) failed", e)
                errorEvents.tryEmit("Fallo al rechazar ${inv.name}: ${friendlyMatrixError(e)}")
            }
        }
        rejected
    }

    suspend fun markRoomAsRead(roomId: String) = withContext(Dispatchers.IO) {
        try {
            client?.getRoom(roomId)?.markAsRead(ReceiptType.FULLY_READ)
        } catch (_: Exception) {
        }
    }

    suspend fun refreshSync() = withContext(Dispatchers.IO) {
        _isSyncing.value = true
        try {
            sessionManager.syncService?.let { service ->
                service.stop()
                service.start()
            }
        } catch (_: Exception) {
        }
    }

    // ====================================================================
    // Device verification (SAS / emojis)
    // ====================================================================

    private fun attachVerificationDelegate() {
        sessionManager.verificationController?.setDelegate(object : SessionVerificationControllerDelegate {
            override fun didReceiveVerificationRequest(details: SessionVerificationRequestDetails) {
                Log.i(TAG, "verification: incoming request from ${details.senderProfile?.userId} device=${details.deviceId}")
                // Do not stomp an in-progress flow; a new request only replaces
                // an idle or already-pending incoming request.
                val current = _verificationUi.value
                if (current !is VerificationUiState.Idle && current !is VerificationUiState.IncomingRequest) return
                _verificationUi.value = VerificationUiState.IncomingRequest(
                    senderId = details.senderProfile?.displayName
                        ?: details.senderProfile?.userId
                        ?: "Otro dispositivo",
                    deviceId = details.deviceId,
                    deviceDisplayName = details.deviceDisplayName ?: "Dispositivo Matrix"
                )
            }

            override fun didAcceptVerificationRequest() {
                Log.i(TAG, "verification: request accepted, starting SAS")
                _verificationUi.value = VerificationUiState.RequestAccepted
                scope.launch {
                    try {
                        sessionManager.verificationController?.startSasVerification()
                    } catch (_: Exception) {
                    }
                }
            }

            override fun didStartSasVerification() {
                Log.i(TAG, "verification: SAS started")
                _verificationUi.value = VerificationUiState.SasStarted
            }

            override fun didReceiveVerificationData(data: SessionVerificationData) {
                if (data is SessionVerificationData.Emojis) {
                    Log.i(TAG, "verification: emojis received")
                    _verificationUi.value = VerificationUiState.ShowEmojis(
                        data.emojis.map { it.symbol() to it.description() }
                    )
                }
            }

            override fun didFinish() {
                Log.i(TAG, "verification: flow finished, checking real state")
                // Same check Element X does: didFinish can fire even when the
                // session did NOT become verified (e.g. the other side accepted
                // without holding the private cross-signing keys — a known
                // Element Web issue). Only report success if the SDK actually
                // reports VERIFIED, otherwise tell the user the truth.
                scope.launch {
                    val verified = awaitVerifiedState(timeoutMs = 15_000)
                    _verificationUi.value = if (verified) {
                        VerificationUiState.Verified
                    } else {
                        VerificationUiState.Failed(
                            "Los emojis coincidieron, pero el otro dispositivo no pudo firmar esta sesión " +
                                "(le faltan las claves privadas de firma cruzada). Verifica con un cliente que " +
                                "tenga las claves (Element en el teléfono) o usa tu clave de recuperación."
                        )
                    }
                }
            }

            override fun didCancel() {
                Log.i(TAG, "verification: cancelled")
                _verificationUi.value = VerificationUiState.Cancelled
            }

            override fun didFail() {
                Log.w(TAG, "verification: failed")
                _verificationUi.value = VerificationUiState.Failed("La verificación falló o expiró")
            }
        })
    }

    /** Polls the real SDK verification state after a finished flow (the state
     * can lag behind didFinish). Returns true once VERIFIED is reported. */
    private suspend fun awaitVerifiedState(timeoutMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            try {
                val state = client?.encryption()?.verificationState()
                Log.i(TAG, "verification: state check -> $state")
                if (state == VerificationState.VERIFIED) return true
            } catch (e: Exception) {
                Log.w(TAG, "verification: state check failed: ${e.javaClass.simpleName}")
            }
            delay(300)
        }
        return false
    }

    suspend fun startVerification() {
        _verificationUi.value = VerificationUiState.RequestAccepted
        try {
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.requestDeviceVerification()
            } ?: errorEvents.tryEmit("La verificación no está disponible todavía")
        } catch (e: Exception) {
            _verificationUi.value = VerificationUiState.Idle
            errorEvents.tryEmit("No se pudo iniciar la verificación: ${e.localizedMessage}")
        }
    }

    /** Reverse direction: this device asks to verify OTHER devices of the same
     * user (e.g. verify your Element session from TqApp). */
    suspend fun startUserVerification() {
        _verificationUi.value = VerificationUiState.RequestAccepted
        try {
            val userId = client?.userId() ?: return
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.requestUserVerification(userId)
            } ?: errorEvents.tryEmit("La verificación no está disponible todavía")
        } catch (e: Exception) {
            _verificationUi.value = VerificationUiState.Idle
            errorEvents.tryEmit("No se pudo iniciar la verificación: ${e.localizedMessage}")
        }
    }

    suspend fun acceptVerificationRequest() {
        _verificationUi.value = VerificationUiState.RequestAccepted
        try {
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.acceptVerificationRequest()
            }
        } catch (e: Exception) {
            _verificationUi.value = VerificationUiState.Failed(e.localizedMessage ?: "Error al aceptar")
        }
    }

    suspend fun approveVerificationEmojis() {
        try {
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.approveVerification()
            }
        } catch (_: Exception) {
        }
    }

    suspend fun declineVerificationEmojis() {
        try {
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.declineVerification()
            }
        } catch (_: Exception) {
        }
    }

    suspend fun cancelVerification() {
        try {
            withContext(Dispatchers.IO) {
                sessionManager.verificationController?.cancelVerification()
            }
        } catch (_: Exception) {
        }
        _verificationUi.value = VerificationUiState.Idle
    }

    fun dismissVerification() {
        _verificationUi.value = VerificationUiState.Idle
    }

    // ====================================================================
    // E2EE backup / recovery (real, via SDK crypto)
    // ====================================================================

    private fun observeEncryptionState() {
        val c = client ?: return
        try {
            val enc = c.encryption()
            _deviceVerification.value = enc.verificationState()
            _backupState.value = enc.backupState()
            verificationStateHandle = enc.verificationStateListener(object : org.matrix.rustcomponents.sdk.VerificationStateListener {
                override fun onUpdate(status: VerificationState) {
                    Log.i(TAG, "device verification state -> $status")
                    _deviceVerification.value = status
                }
            })
            backupStateHandle = enc.backupStateListener(object : org.matrix.rustcomponents.sdk.BackupStateListener {
                override fun onUpdate(status: BackupState) {
                    _backupState.value = status
                }
            })
        } catch (_: Exception) {
        }
    }

    suspend fun enableBackupNow(): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.encryption()?.enableBackups()
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo activar el respaldo de claves: ${e.localizedMessage}")
            false
        }
    }

    suspend fun restoreWithRecoveryKey(recoveryKey: String): Boolean = withContext(Dispatchers.IO) {
        try {
            client?.encryption()?.recover(recoveryKey.trim())
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("Clave de recuperación inválida: ${e.localizedMessage}")
            false
        }
    }

    suspend fun resetRecoveryKey(): String? = withContext(Dispatchers.IO) {
        try {
            client?.encryption()?.resetRecoveryKey()
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo generar la clave de recuperación: ${e.localizedMessage}")
            null
        }
    }

    // ====================================================================
    // Profile
    // ====================================================================

    suspend fun updateDisplayName(newDisplayName: String): Boolean = withContext(Dispatchers.IO) {
        val session = _sessionFlow.value ?: return@withContext false
        try {
            if (!session.isDemoMode) client?.setDisplayName(newDisplayName)
            _sessionFlow.value = session.copy(displayName = newDisplayName)
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo actualizar el nombre: ${e.localizedMessage}")
            false
        }
    }

    suspend fun updateAvatarUrl(newAvatarUrl: String): Boolean = withContext(Dispatchers.IO) {
        val session = _sessionFlow.value ?: return@withContext false
        try {
            if (!session.isDemoMode) client?.setAvatarUrl(newAvatarUrl)
            _sessionFlow.value = session.copy(avatarUrl = newAvatarUrl)
            true
        } catch (e: Exception) {
            errorEvents.tryEmit("No se pudo actualizar el avatar: ${e.localizedMessage}")
            false
        }
    }

    // ====================================================================
    // Real Matrix calls (MatrixRTC / Element Call embedded widget)
    // ====================================================================

    /** Live handle to an ongoing Element Call widget session. Bridges the
     * widget's postMessage protocol between the WebView and the Rust SDK's
     * WidgetDriver, which talks MatrixRTC over the room's timeline. */
    inner class ElementCallSession(
        val roomId: String,
        val roomName: String,
        val widgetUrl: String,
        val widgetId: String,
        val isVideo: Boolean = true,
        private val driverHandle: WidgetDriverHandle,
        private val runJob: kotlinx.coroutines.Job
    ) {
        private var closed = false
        /** Message coming from the SDK/room that must be delivered to the
         * WebView via `window.postMessage`. */
        suspend fun nextOutgoingMessage(): String? = try {
            withContext(Dispatchers.IO) { driverHandle.recv() }
        } catch (e: Exception) {
            Log.e(TAG, "ElementCall driverHandle.recv() failed", e)
            null
        }

        /** Message coming from the widget's JS (via the JS bridge) that must
         * be forwarded into the SDK's widget driver. */
        suspend fun sendFromWidget(message: String): Boolean = try {
            withContext(Dispatchers.IO) { driverHandle.send(message) }
        } catch (e: Exception) {
            Log.e(TAG, "ElementCall driverHandle.send() failed", e)
            false
        }

        fun close() {
            if (closed) return
            closed = true
            localCallRooms.remove(roomId)
            runJob.cancel()
            driverHandle.destroy()
        }
    }

    /** Builds a real MatrixRTC call for [roomId] using the Element Call
     * embedded widget shipped in the app (io.element.android:element-call-embedded).
     * The returned session must be closed with [ElementCallSession.close]. */
    suspend fun prepareElementCall(roomId: String, isVideo: Boolean, joinExisting: Boolean = false): ElementCallSession? =
        withContext(Dispatchers.IO) {
            try {
                val currentClient = client ?: return@withContext null
                val room = currentClient.getRoom(roomId) ?: return@withContext null
                try {
                    Log.d(TAG, "LiveKit RTC supported by homeserver: ${currentClient.isLivekitRtcSupported()}")
                } catch (e: Exception) {
                    Log.w(TAG, "isLivekitRtcSupported check failed: ${e.message}")
                }
                val userId = currentClient.userId()
                val deviceId = currentClient.deviceId()
                val widgetId = "tqapp_call_${UUID.randomUUID()}"

                // Same intent selection as Element X's
                // DefaultCallWidgetSettingsProvider: DM calls get dedicated
                // start/join intents so they ring the other party directly
                // (WhatsApp-style), group calls use the generic intents.
                val direct = try { room.isDirect() } catch (e: Exception) { false }
                // joinExisting=true only when answering an incoming ring.
                // When the user taps the call button we always START_CALL so
                // Element Call sends the m.rtc.notification that rings the
                // other side — even if a stale m.call.member makes
                // hasActiveRoomCall() return true, START_CALL still joins the
                // shared MatrixRTC session (there is only one per room).
                val intent = when {
                    joinExisting && direct ->
                        if (isVideo) ElementCallIntent.JOIN_EXISTING_DM else ElementCallIntent.JOIN_EXISTING_DM_VOICE
                    joinExisting -> ElementCallIntent.JOIN_EXISTING
                    direct ->
                        if (isVideo) ElementCallIntent.START_CALL_DM else ElementCallIntent.START_CALL_DM_VOICE
                    else -> ElementCallIntent.START_CALL
                }
                Log.d(TAG, "Element Call intent=$intent direct=$direct joinExisting=$joinExisting")

                val properties = VirtualElementCallWidgetProperties(
                    "https://appassets.androidplatform.net/assets/element-call/index.html",
                    widgetId,
                    "https://appassets.androidplatform.net",
                    null,
                    null,
                    EncryptionSystem.PerParticipantKeys,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                )
                val config = VirtualElementCallWidgetConfig(
                    intent = intent,
                    skipLobby = true,
                    header = HeaderStyle.NONE,
                    hideHeader = null,
                    preload = null,
                    appPrompt = false,
                    confineToRoom = null,
                    hideScreensharing = true,
                    controlledAudioDevices = false,
                    sendNotificationType = NotificationType.RING
                )
                val widgetSettings = newVirtualElementCallWidget(properties, config)
                val requiredPermissions = getElementCallRequiredPermissions(userId, deviceId)
                val driverAndHandle = makeWidgetDriver(widgetSettings)
                val job = scope.launch(Dispatchers.IO) {
                    try {
                        driverAndHandle.driver.run(room, object : WidgetCapabilitiesProvider {
                            override fun acquireCapabilities(desired: WidgetCapabilities): WidgetCapabilities =
                                requiredPermissions
                        })
                    } catch (e: Exception) {
                        Log.e(TAG, "Element Call widget driver stopped", e)
                    }
                }
                val webviewUrl = generateWebviewUrl(
                    widgetSettings,
                    room,
                    org.matrix.rustcomponents.sdk.ClientProperties("com.aistudio.matrixwhatz", "es", "dark")
                )
                Log.d(TAG, "Element Call widget URL: $webviewUrl")
                localCallRooms.add(roomId)
                ElementCallSession(
                    roomId = roomId,
                    roomName = roomInfos[roomId]?.let { it.displayName ?: it.id } ?: roomId,
                    widgetUrl = webviewUrl,
                    widgetId = widgetId,
                    isVideo = isVideo,
                    driverHandle = driverAndHandle.handle,
                    runJob = job
                )
            } catch (e: Exception) {
                Log.e(TAG, "prepareElementCall failed", e)
                errorEvents.tryEmit("No se pudo iniciar la llamada: ${friendlyMatrixError(e)}")
                null
            }
        }

    // ====================================================================
    // Local-only features (stories, calls)
    // ====================================================================

    suspend fun postStory(text: String, backgroundColorHex: String = "#075E54") = withContext(Dispatchers.IO) {
        val session = _sessionFlow.value
        val now = System.currentTimeMillis()
        database.storyDao().insertStory(
            StoryEntity(
                id = "story_" + UUID.randomUUID().toString(),
                userId = session?.userId ?: "@me",
                userName = session?.displayName ?: "Mi estado",
                content = text.trim(),
                backgroundColorHex = backgroundColorHex,
                timestamp = now,
                expiresAt = now + 86400000L,
                isViewed = false,
                viewsCount = 0,
                isMine = true
            )
        )
        publishTextStory(text.trim())
    }

    suspend fun postMediaStory(uri: android.net.Uri, caption: String = ""): Boolean = withContext(Dispatchers.IO) {
        try {
            val resolver = sessionManager.appContext.contentResolver
            val mimeType = resolver.getType(uri) ?: "application/octet-stream"
            val extension = android.webkit.MimeTypeMap.getSingleton()
                .getExtensionFromMimeType(mimeType)
                ?: uri.lastPathSegment?.substringAfterLast('.', "bin")
                ?: "bin"
            Log.i(TAG, "postMediaStory: uri=$uri mime=$mimeType ext=$extension")
            val storyFile = java.io.File(
                java.io.File(sessionManager.appContext.filesDir, "stories").apply { mkdirs() },
                "${UUID.randomUUID()}.$extension"
            )
            val copied = resolver.openInputStream(uri)?.use { input ->
                storyFile.outputStream().use { output -> input.copyTo(output) }
            }
            if (copied == null || storyFile.length() == 0L) {
                Log.e(TAG, "postMediaStory: openInputStream returned $copied, fileSize=${storyFile.length()}")
                errorEvents.tryEmit("No se pudo leer el archivo seleccionado")
                return@withContext false
            }
            Log.i(TAG, "postMediaStory: copied ${storyFile.length()} bytes to ${storyFile.absolutePath}")
            val session = _sessionFlow.value
            val now = System.currentTimeMillis()
            database.storyDao().insertStory(
                StoryEntity(
                    id = "story_${UUID.randomUUID()}",
                    userId = session?.userId ?: "@me",
                    userName = session?.displayName ?: "Mi estado",
                    content = caption.ifBlank {
                        if (mimeType.startsWith("video/")) "Video" else "Foto"
                    },
                    mediaUrl = storyFile.absolutePath,
                    timestamp = now,
                    expiresAt = now + 86400000L,
                    isMine = true
                )
            )
            publishMediaStory(storyFile.absolutePath, mimeType, caption)
            true
        } catch (e: Exception) {
            Log.e(TAG, "postMediaStory failed", e)
            errorEvents.tryEmit("No se pudo guardar el estado multimedia")
            false
        }
    }

    suspend fun markStoryViewed(storyId: String) = withContext(Dispatchers.IO) {
        database.storyDao().markStoryViewed(storyId)
    }

    // ----- Matrix-backed stories -----
    // Each user's statuses live in a dedicated private room (FluffyChat
    // convention): every member message in that room is a story that expires
    // locally after 24 h. The room is detected by a marker in its topic.

    private fun isStoriesRoom(info: RoomInfo): Boolean =
        info.topic?.contains(STORY_TOPIC_MARKER) == true

    private fun storiesPrefs() = sessionManager.appContext
        .getSharedPreferences("tqapp_stories", android.content.Context.MODE_PRIVATE)

    /**
     * My dedicated stories room — created on first use, private+encrypted, with
     * all DM contacts invited so they can see the statuses.
     */
    private suspend fun ensureStoriesRoom(): Room? {
        val c = client ?: return null
        val myId = try { c.userId() } catch (_: Exception) { return null }
        val prefs = storiesPrefs()
        prefs.getString("room_$myId", null)?.let { rid ->
            try {
                val room = c.getRoom(rid)
                if (room != null && room.membership() == Membership.JOINED) return room
            } catch (_: Exception) {
            }
        }
        // The room may exist already (prefs cleared / other device).
        val existingId = try {
            listLock.withLock {
                roomInfos.values.firstOrNull { info ->
                    info.membership == Membership.JOINED && isStoriesRoom(info) &&
                        info.creators?.contains(myId) == true
                }?.id
            }
        } catch (_: Exception) {
            null
        }
        if (existingId != null) {
            prefs.edit().putString("room_$myId", existingId).apply()
            return try {
                c.getRoom(existingId)
            } catch (_: Exception) {
                null
            }
        }
        val displayName = _sessionFlow.value?.displayName
            ?: myId.removePrefix("@").substringBefore(":")
        val roomId = try {
            c.createRoom(
                CreateRoomParameters(
                    name = "Estados de $displayName",
                    topic = "Historias con caducidad de 24 h $STORY_TOPIC_MARKER",
                    isEncrypted = true,
                    isDirect = false,
                    visibility = RoomVisibility.Private,
                    preset = RoomPreset.PRIVATE_CHAT,
                    // Homeservers reject bulk invites at creation ("Cannot invite
                    // so many users at once"); contacts are invited one-by-one
                    // afterwards via inviteContactsToStoriesRoom.
                    invite = emptyList(),
                    avatar = null,
                    powerLevelContentOverride = null,
                    joinRuleOverride = null,
                    historyVisibilityOverride = null,
                    canonicalAlias = null,
                    isSpace = false
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "ensureStoriesRoom: createRoom failed", e)
            return null
        }
        prefs.edit().putString("room_$myId", roomId).apply()
        return try {
            c.getRoom(roomId)
        } catch (_: Exception) {
            null
        }
    }

    /** Re-invites current DM contacts so new contacts also receive statuses. */
    private suspend fun inviteContactsToStoriesRoom(room: Room) {
        for (contact in _contactsFlow.value) {
            try {
                room.inviteUserById(contact.userId)
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Reads the last 24 h of messages from every joined stories room owned by
     * someone else and stores them as remote [StoryEntity]s. Called when the
     * Estados tab opens (the SDK keeps the rooms synced in the background).
     */
    suspend fun refreshRemoteStories() = withContext(Dispatchers.IO) {
        // Hard-delete expired statuses so they can never resurface.
        database.storyDao().cleanExpiredStories()
        val c = client ?: return@withContext
        val myId = try {
            c.userId()
        } catch (_: Exception) {
            null
        }
        val myRoomId = myId?.let { storiesPrefs().getString("room_$it", null) }
        val cutoff = System.currentTimeMillis() - STORY_TTL_MS
        val storyRoomIds = listLock.withLock {
            roomInfos.values.filter { info ->
                info.membership == Membership.JOINED && isStoriesRoom(info) &&
                    info.id != myRoomId && (myId == null || info.creators?.contains(myId) != true)
            }.map { it.id }
        }
        val seenIds = mutableListOf<String>()
        for (roomId in storyRoomIds) {
            try {
                val room = c.getRoom(roomId) ?: continue
                seenIds.addAll(syncStoriesFromRoom(room, myId, cutoff))
            } catch (e: Exception) {
                Log.w(TAG, "refreshRemoteStories($roomId) failed: ${e.message}")
            }
        }
        if (seenIds.isEmpty()) {
            database.storyDao().deleteRemoteStories()
        } else {
            database.storyDao().deleteRemoteStoriesNotIn(seenIds)
        }
    }

    /** Collects the timeline items of a room within a short window. */
    private suspend fun collectRecentTimelineItems(room: Room): List<EventTimelineItem> {
        val collected = java.util.concurrent.CopyOnWriteArrayList<EventTimelineItem>()
        var timeline: Timeline? = null
        var handle: TaskHandle? = null
        try {
            timeline = room.timeline()
            handle = timeline.addListener(object : TimelineListener {
                override fun onUpdate(diffs: List<TimelineDiff>) {
                    for (d in diffs) {
                        when (d) {
                            is TimelineDiff.Reset -> collected.addAll(d.values.mapNotNull { it.asEvent() })
                            is TimelineDiff.Append -> collected.addAll(d.values.mapNotNull { it.asEvent() })
                            is TimelineDiff.PushBack -> d.value.asEvent()?.let { collected.add(it) }
                            is TimelineDiff.PushFront -> d.value.asEvent()?.let { collected.add(it) }
                            is TimelineDiff.Insert -> d.value.asEvent()?.let { collected.add(it) }
                            is TimelineDiff.Set -> d.value.asEvent()?.let { collected.add(it) }
                            else -> {}
                        }
                    }
                }
            })
            try {
                timeline.paginateBackwards(50u.toUShort())
            } catch (_: Exception) {
            }
            kotlinx.coroutines.delay(2500)
            return collected.distinctBy { ev ->
                when (val id = ev.eventOrTransactionId) {
                    is EventOrTransactionId.EventId -> id.eventId
                    is EventOrTransactionId.TransactionId -> id.transactionId
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "collectRecentTimelineItems failed: ${e.message}")
            return emptyList()
        } finally {
            try {
                handle?.cancel()
            } catch (_: Exception) {
            }
            try {
                timeline?.destroy()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Turns the recent timeline messages of a stories room into local
     * [StoryEntity] rows. Returns the ids that were (re)inserted.
     */
    private suspend fun syncStoriesFromRoom(room: Room, myId: String?, cutoff: Long): List<String> {
        val items = collectRecentTimelineItems(room)
        val storyIds = mutableListOf<String>()
        for (ev in items) {
            if (ev.timestamp.toLong() < cutoff) continue
            val msg = (ev.content as? TimelineItemContent.MsgLike) ?: continue
            val kind = msg.content.kind as? MsgLikeKind.Message ?: continue
            val eventId = (ev.eventOrTransactionId as? EventOrTransactionId.EventId)?.eventId
                ?: continue
            val storyId = "remote_$eventId"
            var content = kind.content.body
            var mediaUrl: String? = null
            when (val t = kind.content.msgType) {
                is org.matrix.rustcomponents.sdk.MessageType.Image -> {
                    val local = resolveMediaFile(
                        try {
                            t.content.source.toJson()
                        } catch (_: Exception) {
                            t.content.source.url()
                        },
                        t.content.info?.mimetype ?: "image/*",
                        t.content.filename
                    )
                    mediaUrl = local
                    content = t.content.caption ?: t.content.filename
                }
                is org.matrix.rustcomponents.sdk.MessageType.Video -> {
                    val local = resolveMediaFile(
                        try {
                            t.content.source.toJson()
                        } catch (_: Exception) {
                            t.content.source.url()
                        },
                        t.content.info?.mimetype ?: "video/*",
                        t.content.filename
                    )
                    mediaUrl = local
                    content = t.content.caption ?: t.content.filename
                }
                is org.matrix.rustcomponents.sdk.MessageType.Audio -> continue
                is org.matrix.rustcomponents.sdk.MessageType.File -> continue
                else -> {}
            }
            if (mediaUrl == null && content.isBlank()) continue
            val member = try {
                room.member(ev.sender)
            } catch (_: Exception) {
                null
            }
            val isMine = ev.sender == myId
            val viewed = if (isMine) false else database.storyDao().isStoryViewed(storyId) ?: false
            database.storyDao().insertStory(
                StoryEntity(
                    id = storyId,
                    userId = ev.sender,
                    userName = member?.displayName
                        ?: ev.sender.removePrefix("@").substringBefore(":"),
                    userAvatar = member?.avatarUrl,
                    content = content,
                    mediaUrl = mediaUrl,
                    timestamp = ev.timestamp.toLong(),
                    expiresAt = ev.timestamp.toLong() + STORY_TTL_MS,
                    isViewed = viewed,
                    viewsCount = database.storyDao().storyViewsCount(storyId) ?: 0,
                    isMine = isMine
                )
            )
            storyIds.add(storyId)
        }
        return storyIds
    }

    /** Publishes a text story to my Matrix stories room (best effort). */
    private suspend fun publishTextStory(text: String) {
        val room = ensureStoriesRoom() ?: return
        var timeline: Timeline? = null
        try {
            inviteContactsToStoriesRoom(room)
            timeline = room.timeline()
            timeline.send(messageEventContentFromMarkdown(text))
        } catch (e: Exception) {
            Log.w(TAG, "publishTextStory failed: ${e.message}")
        } finally {
            try {
                timeline?.destroy()
            } catch (_: Exception) {
            }
        }
    }

    /** Publishes a media story to my Matrix stories room (best effort). */
    private suspend fun publishMediaStory(path: String, mimeType: String, caption: String = "") {
        val room = ensureStoriesRoom() ?: return
        try {
            inviteContactsToStoriesRoom(room)
            sendAttachment(
                room.id(),
                path,
                mimeType,
                if (mimeType.startsWith("video/")) "video" else "image",
                caption = caption.ifBlank { null }
            )
        } catch (e: Exception) {
            Log.w(TAG, "publishMediaStory failed: ${e.message}")
        }
    }

    suspend fun registerCall(
        contactName: String,
        callType: String,
        direction: String = "OUTGOING",
        duration: Int = 0,
        roomId: String? = null
    ) = withContext(Dispatchers.IO) {
        database.callDao().insertCall(
            CallEntity(
                contactName = contactName,
                callType = callType,
                direction = direction,
                timestamp = System.currentTimeMillis(),
                durationSeconds = duration,
                roomId = roomId
            )
        )
    }

    suspend fun addContact(userId: String, displayName: String) {
        _contactsFlow.value = (_contactsFlow.value + ContactEntity(userId = userId.trim(), displayName = displayName.trim()))
            .distinctBy { it.userId }
    }

    private fun seedDemoRooms() {
        val now = System.currentTimeMillis()
        _roomsFlow.value = listOf(
            RoomEntity(
                roomId = "!demo_direct:matrix.org",
                name = "Carlos Méndez",
                roomType = "DIRECT",
                lastMessage = "¡Hola! Bienvenido a TqApp",
                lastTimestamp = now - 3600000,
                unreadCount = 1,
                directUserId = "@carlos.matrix:matrix.org"
            ),
            RoomEntity(
                roomId = "!demo_group:matrix.org",
                name = "Desarrolladores Matrix",
                roomType = "GROUP",
                lastMessage = "Demo de sala federada",
                lastTimestamp = now - 7200000
            )
        )
        _contactsFlow.value = listOf(
            ContactEntity("@carlos.matrix:matrix.org", "Carlos Méndez"),
            ContactEntity("@sofia.val:kde.org", "Sofía Valenzuela")
        )
    }
}
