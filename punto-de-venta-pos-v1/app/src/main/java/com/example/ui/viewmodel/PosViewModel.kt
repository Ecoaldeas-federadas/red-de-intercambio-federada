package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.api.*
import com.example.data.db.AppDatabase
import com.example.data.db.ShiftEntity
import com.example.data.db.TerminalConfigEntity
import com.example.data.db.TransactionEntity
import com.example.data.repository.PosRepository
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.util.FormatConfig
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

sealed class PosScreen {
    object RegisterTerminal : PosScreen()
    object Login : PosScreen()
    object Dashboard : PosScreen()
    object QrCharge : PosScreen()
    object NfcCharge : PosScreen()
    object MultiVendor : PosScreen()
    object Transactions : PosScreen()
    object Admin : PosScreen()
    object Settings : PosScreen()
    object ShiftManagement : PosScreen()
    object ProvisionCard : PosScreen()
}

data class PosUiState(
    val currentScreen: PosScreen = PosScreen.RegisterTerminal,
    val screenHistory: List<PosScreen> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,

    // Node & User
    val serverUrl: String = "https://feria.loanstly.com/main",
    val nodeDomain: String = "feria.loanstly.com/main",
    val currentUser: UserMeResponse? = null,
    val isLoggedIn: Boolean = false,
    val isRegistered: Boolean = false,
    val isDemoNode: Boolean = false,

    // Shift
    val activeShift: ShiftEntity? = null,

    // Common Amount Input
    val amountInput: String = "",
    val chargeDescription: String = "",

    // QR Charge Flow
    val qrChargeResponse: CreateChargeResponse? = null,
    val qrPayUrl: String? = null,
    val isQrPolling: Boolean = false,
    val qrStatus: String? = null, // "pending", "partially_signed", "paid", "expired", "cancelled"
    val qrRemainingSeconds: Int = 180,
    val qrInitialSeconds: Int = 180,
    val qrRequiredSignatures: Int = 1,
    val qrCollectedSignatures: Int = 0,
    val qrSignaturesList: List<QrSignatureInfo> = emptyList(),

    // NFC Hardware & Status
    val hasNfcHardware: Boolean = true,
    val isNfcEnabled: Boolean = true,

    // NFC Charge Flow
    val nfcStep: Int = 1, // 1: Amount, 2: Document, 3: Secret PIN, 4: Tap NFC Card
    val isNfcWaitingCard: Boolean = false,
    val detectedCardUid: String? = null,
    val detectedCardType: String = "uid_only", // "uid_only" or "desfire"
    val customerPin: String = "",
    val requireIdVerification: Boolean = false,
    val selectedDocType: String = "cedula",
    val idDocNumber: String = "",
    // Username-based NFC flow
    val customerUsername: String = "",
    val userLookupResult: UserLookupResponse? = null,
    val requiresDocument: Boolean = false, // true si el servidor dice que la tarjeta es Classic
    val nfcPaymentResult: PaymentResultDecrypted? = null,

    // MIFARE Classic Dynamic Certificates
    val isClassicFlow: Boolean = false, // true cuando se detecta tarjeta Classic con certificados
    val classicPreAuth: ClassicPreAuthResponse? = null,
    val classicStep: String = "idle", // "idle", "auth", "tap_card", "writing", "done"
    val isWritingCard: Boolean = false,
    val writeProgress: String = "",
    val classicRemainingSeconds: Int = 30,

    // Multi-Vendor Flow
    val mvStep: Int = 1, // 1: Tap Seller, 2: Amount, 3: Tap Buyer, 4: Buyer PIN & ID, 5: Result
    val sellerCardUid: String? = null,
    val sellerName: String? = null,
    val sellerPin: String = "1234",
    val buyerCardUid: String? = null,
    val buyerPin: String = "",
    val buyerDocType: String = "cedula",
    val buyerDocNumber: String = "",
    val isSameCardError: Boolean = false,
    val isMultiVendorMultisig: Boolean = false,
    val mvMultisigRequired: Int = 1,
    val mvMultisigCollected: Int = 0,

    // Multi-Signature Flow
    val isMultisigActive: Boolean = false,
    val multisigPendingId: String? = null,
    val multisigRequiredSigs: Int = 1,
    val multisigCollectedSigs: Int = 0,
    val multisigRemainingSeconds: Long = 600L,
    val multisigMessage: String? = null,

    // Node config
    val cardTypeConfig: CardTypeConfigResponse? = null,

    // Admin
    val registeredTerminals: List<TerminalItem> = emptyList(),
    val userCards: List<CardItem> = emptyList(),

    // Terminal Pairing by Short Code
    val pairingCode: String? = null,
    val pairingRemainingSeconds: Int = 60,
    val pairingStatus: String? = null, // null, "pending", "approved", "expired", "rejected"
    val isPairingPolling: Boolean = false,
    val isInGracePeriod: Boolean = false // true cuando el tiempo visible expiro pero estamos en grace period
)

class PosViewModel(
    application: Application,
    database: AppDatabase
) : AndroidViewModel(application) {

    val repository = PosRepository(
        context = application.applicationContext,
        database = database,
        apiClient = PosApiClient("https://feria.loanstly.com/main")
    )

    private val _uiState = MutableStateFlow(PosUiState())
    val uiState: StateFlow<PosUiState> = _uiState.asStateFlow()

    val transactions: StateFlow<List<TransactionEntity>> = repository.allTransactions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val latestShift: StateFlow<ShiftEntity?> = repository.latestShift
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val terminalConfig: StateFlow<TerminalConfigEntity?> = repository.terminalConfig
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private var qrPollJob: Job? = null
    private var qrTimerJob: Job? = null
    private var multisigPollJob: Job? = null
    private var pairingPollJob: Job? = null
    private var heartbeatJob: Job? = null

    init {
        viewModelScope.launch {
            val config = repository.getOrInitTerminalConfig()
            // Apply saved format settings to the in-memory FormatConfig so that
            // all formatters (currency, date, time) use the server-provided locale.
            FormatConfig.updateFromEntity(config)
            val hasActiveSession = !config.sessionToken.isNullOrBlank()
            
            _uiState.update {
                it.copy(
                    serverUrl = config.serverUrl,
                    nodeDomain = repository.apiClient.nodeDomain,
                    isRegistered = config.isRegistered,
                    isDemoNode = repository.apiClient.isDemoNode,
                    isLoggedIn = hasActiveSession,
                    currentScreen = when {
                        !config.isRegistered -> PosScreen.RegisterTerminal
                        hasActiveSession -> PosScreen.Dashboard
                        else -> PosScreen.Login
                    }
                )
            }
            loadCardTypeConfig()

            // Verificar con el servidor que el terminal sigue registrado y activo
            if (config.isRegistered) {
                val hbResult = repository.heartbeat()
                hbResult.onSuccess { hb ->
                    if (hb.notFound == true) {
                        _uiState.update {
                            it.copy(
                                isRegistered = false,
                                currentScreen = PosScreen.RegisterTerminal,
                                errorMessage = "El terminal no fue encontrado en el servidor. Empareje nuevamente si fue eliminado."
                            )
                        }
                    } else if (hb.keyMatches == false) {
                        // Las claves no coinciden — intentar auto-renovar
                        handleKeyMismatch()
                    }
                }
                // Si el heartbeat falla por error 500 o red, NO cambiar estado (mantiene registro)
            } else {
                // No esta registrado localmente — pero podria haber sido aprobado
                // en el servidor sin que el POS se entero (polling expiro antes de
                // recibir el "approved"). Consultar al servidor por public_key.
                val lookupResult = repository.checkRegistrationByKey()
                lookupResult.onSuccess { isRegistered ->
                    if (isRegistered) {
                        // El servidor confirma que este terminal ya fue registrado.
                        // Actualizar estado local.
                        _uiState.update {
                            it.copy(
                                isRegistered = true,
                                currentScreen = if (hasActiveSession) PosScreen.Dashboard else PosScreen.Login,
                                successMessage = "Terminal verificado y registrado con el servidor."
                            )
                        }
                    }
                }
                // Si el lookup falla por red o no esta registrado, mantener estado actual
            }

            if (config.isRegistered && hasActiveSession) {
                refreshCurrentUser()
            }
        }

        // Heartbeat periodico: cada 60 segundos verifica que el terminal
        // sigue registrado, activo y que las claves coinciden.
        // Si las claves no coinciden, cierra la sesion y envia a re-pairing.
        startPeriodicHeartbeat()
    }

    private fun startPeriodicHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (true) {
                delay(60_000) // 60 segundos
                val state = _uiState.value
                if (!state.isRegistered) continue

                // 1. Verificar sesion JWT si hay usuario logueado
                if (state.isLoggedIn) {
                    val meResult = repository.fetchCurrentUser()
                    if (meResult.isFailure) {
                        // Sesión expirada o invalida — enviar a login
                        _uiState.update {
                            it.copy(
                                isLoggedIn = false,
                                currentUser = null,
                                currentScreen = PosScreen.Login,
                                errorMessage = "Sesión expirada. Por favor inicie sesión nuevamente."
                            )
                        }
                        continue
                    }
                }

                // 2. Heartbeat del terminal
                val hbRes = repository.heartbeat()
                hbRes.onSuccess { hb ->
                    if (hb.notFound == true) {
                        repository.resetTerminalRegistration()
                        _uiState.update {
                            it.copy(
                                isRegistered = false,
                                isLoggedIn = false,
                                currentUser = null,
                                currentScreen = PosScreen.RegisterTerminal,
                                errorMessage = "El terminal fue eliminado del servidor. Debe emparejar nuevamente."
                            )
                        }
                    } else if (hb.keyMatches == false) {
                        // Las claves no coinciden — intentar auto-renovar
                        handleKeyMismatch()
                    } else if (hb.active == false) {
                        _uiState.update {
                            it.copy(
                                errorMessage = "Este terminal está desactivado. Contacte al administrador."
                            )
                        }
                    }
                }
                // Si el heartbeat falla por red, no hacer nada (puede ser temporal)
            }
        }
    }

    // Reintentar verificacion con el servidor sin resetear las claves
    /**
     * Intenta auto-renovar las claves del terminal cuando se detecta un mismatch.
     * SOLO funciona si hay un usuario logueado con sesion JWT activa — el
     * servidor verifica que el usuario logueado es el merchant_user_id asignado
     * al terminal. Esto previene que alguien falsifique un terminal y renueve
     * claves sin autorizacion.
     *
     * Si hay sesion activa y la renovacion tiene exito, el terminal sigue
     * funcionando sin necesidad de re-parear.
     * Si NO hay sesion activa, envia a Login (no a RegisterTerminal) — el terminal
     * sigue registrado, solo perdio la sesion. Al iniciar sesion, el backend
     * auto-renueva las claves si el usuario es el merchant asignado.
     * Si la renovacion falla con sesion activa, envia a re-parear manual.
     * Retorna true si la renovacion fue exitosa.
     */
    private suspend fun handleKeyMismatch(): Boolean {
        // 1. Verificar que hay un usuario logueado con JWT activo
        val state = _uiState.value
        if (!state.isLoggedIn || state.currentUser == null) {
            // No hay sesion activa — NO resetear claves ni enviar a registro.
            // El terminal sigue registrado, solo perdio la sesion.
            // Al iniciar sesion, el backend auto-renueva las claves si el usuario
            // es el merchant asignado o esta autorizado.
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isRegistered = true,  // sigue registrado
                    isLoggedIn = false,
                    currentUser = null,
                    currentScreen = PosScreen.Login,
                    errorMessage = "La sesión expiró. Inicie sesión para renovar las claves del terminal automáticamente."
                )
            }
            return false
        }

        _uiState.update {
            it.copy(
                isLoading = true,
                errorMessage = "Renovando claves del terminal automáticamente..."
            )
        }

        val renewResult = repository.autoRenewKeys()
        return if (renewResult.isSuccess && renewResult.getOrNull() == true) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isRegistered = true,
                    errorMessage = null,
                    successMessage = "Claves del terminal renovadas automáticamente."
                )
            }
            true
        } else {
            // Auto-renovacion fallo — enviar a re-parear manual
            repository.resetTerminalRegistration()
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isRegistered = false,
                    isLoggedIn = false,
                    currentUser = null,
                    currentScreen = PosScreen.RegisterTerminal,
                    errorMessage = "No se pudieron renovar las claves automáticamente. ${(renewResult.exceptionOrNull()?.message ?: "")}. Debe emparejar nuevamente."
                )
            }
            false
        }
    }

    // Usa las claves existentes para verificar si el servidor ya reconoce este terminal
    fun retryVerification() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, successMessage = null) }

            // Primero intentar heartbeat (si el terminal ya esta registrado en el servidor)
            val hbResult = repository.heartbeat()
            hbResult.onSuccess { hb ->
                if (hb.keyMatches == false) {
                    // Las claves no coinciden — intentar auto-renovar
                    if (!handleKeyMismatch()) {
                        return@launch
                    }
                    // Si la auto-renovacion tuvo exito, continuar
                }
                if (hb.notFound != true && hb.registered != false && hb.active != false) {
                    // El servidor confirma que el terminal esta registrado y activo
                    val config = repository.getOrInitTerminalConfig()
                    if (!config.isRegistered) {
                        // Actualizar estado local - el servidor lo reconoce
                        repository.markTerminalRegistered()
                    }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRegistered = true,
                            currentScreen = PosScreen.Login,
                            successMessage = "Terminal verificado con el servidor."
                        )
                    }
                    return@launch
                }
            }

            // Si heartbeat falla, intentar lookup por clave publica
            // (el terminal podria estar registrado pero con otro terminal_id)
            val lookupResult = repository.checkRegistrationByKey()
            lookupResult.onSuccess { isRegistered ->
                if (isRegistered) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRegistered = true,
                            currentScreen = PosScreen.Login,
                            successMessage = "Terminal verificado y registrado con el servidor."
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "El servidor no reconoce este terminal. " +
                                "Si fue eliminado, use \"Resetear Terminal\" en ajustes."
                        )
                    }
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Error de conexion: ${err.message}. Reintente mas tarde."
                    )
                }
            }
        }
    }

    fun updateNfcHardwareStatus(hasHardware: Boolean, isEnabled: Boolean) {
        _uiState.update {
            it.copy(
                hasNfcHardware = hasHardware,
                isNfcEnabled = isEnabled
            )
        }
    }

    fun navigateTo(screen: PosScreen, addToHistory: Boolean = true) {
        val current = _uiState.value.currentScreen
        if (current == screen) return

        // Reset transient states
        if (screen != PosScreen.QrCharge) stopQrPolling()
        if (screen != PosScreen.NfcCharge && screen != PosScreen.MultiVendor) stopMultisigPolling()
        if (screen != PosScreen.RegisterTerminal) stopPairingPolling()

        val newHistory = if (addToHistory) {
            _uiState.value.screenHistory + current
        } else {
            _uiState.value.screenHistory
        }

        _uiState.update {
            it.copy(
                currentScreen = screen,
                screenHistory = newHistory,
                errorMessage = null,
                successMessage = null,
                amountInput = "",
                customerPin = "",
                detectedCardUid = null,
                nfcStep = 1,
                classicStep = "idle",
                classicPreAuth = null,
                isNfcWaitingCard = false,
                nfcPaymentResult = null,
                qrChargeResponse = null,
                qrPayUrl = null,
                qrStatus = null,
                isQrPolling = false,
                isMultisigActive = false,
                multisigPendingId = null,
                idDocNumber = "",
                mvStep = 1,
                sellerCardUid = null,
                sellerName = null,
                buyerCardUid = null,
                buyerPin = "",
                buyerDocNumber = ""
            )
        }
    }

    fun setNfcStep(step: Int) {
        _uiState.update { it.copy(nfcStep = step, errorMessage = null) }
    }

    fun goBackNfcStep(): Boolean {
        val state = _uiState.value
        if (state.nfcPaymentResult != null || state.classicStep == "done") {
            resetNfcPaymentState()
            _uiState.update { it.copy(nfcStep = 1, classicStep = "idle") }
            return true
        }
        if (state.isMultisigActive) {
            resetNfcPaymentState()
            _uiState.update { it.copy(nfcStep = 1, classicStep = "idle") }
            return true
        }
        return when (state.nfcStep) {
            5 -> {
                // Return from Tap Card to PIN step (Classic: step 4)
                _uiState.update {
                    it.copy(
                        nfcStep = 4,
                        classicStep = "idle",
                        isNfcWaitingCard = false,
                        detectedCardUid = null,
                        classicPreAuth = null,
                        errorMessage = null
                    )
                }
                true
            }
            4 -> {
                if (state.requiresDocument) {
                    // Return from PIN to Document step
                    _uiState.update {
                        it.copy(
                            nfcStep = 3,
                            customerPin = "",
                            errorMessage = null
                        )
                    }
                } else {
                    // Return from Tap Card to PIN step (UID/DESFire)
                    _uiState.update {
                        it.copy(
                            nfcStep = 3,
                            classicStep = "idle",
                            isNfcWaitingCard = false,
                            detectedCardUid = null,
                            classicPreAuth = null,
                            errorMessage = null
                        )
                    }
                }
                true
            }
            3 -> {
                if (state.requiresDocument) {
                    // Return from Document to Username step
                    _uiState.update {
                        it.copy(
                            nfcStep = 2,
                            errorMessage = null
                        )
                    }
                } else {
                    // Return from PIN to Username step (UID/DESFire)
                    _uiState.update {
                        it.copy(
                            nfcStep = 2,
                            customerPin = "",
                            errorMessage = null
                        )
                    }
                }
                true
            }
            2 -> {
                // Return from Username to Amount step
                _uiState.update {
                    it.copy(
                        nfcStep = 1,
                        errorMessage = null
                    )
                }
                true
            }
            1 -> {
                // On step 1 (Amount), return to Dashboard
                resetNfcPaymentState()
                navigateTo(PosScreen.Dashboard)
                true
            }
            else -> false
        }
    }

    fun goBackMultiVendorStep(): Boolean {
        val state = _uiState.value
        if (state.isMultisigActive) {
            resetMultiVendorSale()
            return true
        }
        return if (state.mvStep > 1) {
            _uiState.update {
                it.copy(
                    mvStep = it.mvStep - 1,
                    errorMessage = null,
                    buyerPin = "",
                    isSameCardError = false
                )
            }
            true
        } else {
            resetMultiVendorSale()
            navigateTo(PosScreen.Dashboard)
            true
        }
    }

    fun handleBackPress(): Boolean {
        val state = _uiState.value

        // Step backwards inside NFC Charge flow
        if (state.currentScreen == PosScreen.NfcCharge) {
            return goBackNfcStep()
        }

        // Step backwards inside MultiVendor flow
        if (state.currentScreen == PosScreen.MultiVendor) {
            return goBackMultiVendorStep()
        }

        // If root screen, do not navigate back; let root handler prompt to exit
        val isRootScreen = when (state.currentScreen) {
            PosScreen.Dashboard -> true
            PosScreen.Login -> !state.isRegistered || state.currentUser == null
            PosScreen.RegisterTerminal -> !state.isRegistered
            else -> false
        }

        if (isRootScreen) {
            return false
        }

        // Pop last screen from navigation history
        val history = state.screenHistory
        if (history.isNotEmpty()) {
            val previousScreen = history.last()
            val remainingHistory = history.dropLast(1)

            if (previousScreen != PosScreen.QrCharge) stopQrPolling()
            if (previousScreen != PosScreen.NfcCharge && previousScreen != PosScreen.MultiVendor) stopMultisigPolling()
            if (previousScreen != PosScreen.RegisterTerminal) stopPairingPolling()

            _uiState.update {
                it.copy(
                    currentScreen = previousScreen,
                    screenHistory = remainingHistory,
                    errorMessage = null,
                    successMessage = null,
                    amountInput = "",
                    customerPin = "",
                    detectedCardUid = null,
                    nfcStep = 1,
                    classicStep = "idle",
                    classicPreAuth = null,
                    isNfcWaitingCard = false,
                    nfcPaymentResult = null,
                    qrChargeResponse = null,
                    qrPayUrl = null,
                    qrStatus = null,
                    isQrPolling = false,
                    isMultisigActive = false,
                    multisigPendingId = null,
                    idDocNumber = "",
                    mvStep = 1,
                    sellerCardUid = null,
                    sellerName = null,
                    buyerCardUid = null,
                    buyerPin = "",
                    buyerDocNumber = ""
                )
            }
            return true
        } else {
            // Default fallback: return to Dashboard if logged in
            if (state.isRegistered && state.isLoggedIn) {
                navigateTo(PosScreen.Dashboard, addToHistory = false)
                return true
            }
            return false
        }
    }

    fun resetNfcPaymentState() {
        stopMultisigPolling()
        _uiState.update {
            it.copy(
                detectedCardUid = null,
                customerPin = "",
                customerUsername = "",
                userLookupResult = null,
                requiresDocument = false,
                nfcPaymentResult = null,
                amountInput = "",
                idDocNumber = "",
                nfcStep = 1,
                classicStep = "idle",
                classicPreAuth = null,
                isMultisigActive = false,
                multisigPendingId = null,
                multisigCollectedSigs = 0,
                multisigRequiredSigs = 1,
                errorMessage = null,
                successMessage = null,
                isNfcWaitingCard = false
            )
        }
    }

    fun setAmountInput(input: String) {
        _uiState.update { it.copy(amountInput = input) }
    }

    fun setChargeDescription(desc: String) {
        _uiState.update { it.copy(chargeDescription = desc) }
    }

    fun setCustomerPin(pin: String) {
        _uiState.update { it.copy(customerPin = pin) }
    }

    fun setCustomerUsername(username: String) {
        _uiState.update { it.copy(customerUsername = username) }
    }

    fun setBuyerPin(pin: String) {
        _uiState.update { it.copy(buyerPin = pin) }
    }

    fun setBuyerDocInfo(docType: String, docNumber: String) {
        _uiState.update {
            it.copy(buyerDocType = docType, buyerDocNumber = docNumber)
        }
    }

    fun dismissSameCardError() {
        _uiState.update { it.copy(isSameCardError = false, errorMessage = null) }
    }

    fun setIdDocInfo(docType: String, docNumber: String) {
        _uiState.update {
            it.copy(selectedDocType = docType, idDocNumber = docNumber)
        }
    }

    fun loginMerchant(username: String, pass: String) {
        if (username.isBlank() || pass.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese su nombre de usuario y contraseña") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = repository.login(username, pass)
            result.onSuccess {
                val user = repository.getCurrentUser()
                _uiState.update { state ->
                    state.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        currentUser = user,
                        currentScreen = PosScreen.Dashboard,
                        successMessage = "Sesión iniciada con éxito como @${user?.username ?: username}"
                    )
                }
            }.onFailure { err ->
                val msg = err.message ?: ""
                // Si el servidor rechazo por terminal no registrado, enviar a registro
                val isTerminalNotRegistered = msg.contains("no esta registrado") ||
                    msg.contains("terminal_not_registered")
                // Si el servidor rechazo por no autorizado, mostrar mensaje claro
                val isNotAuthorized = msg.contains("not_authorized_for_terminal") ||
                    msg.contains("No tiene permiso")
                _uiState.update { state ->
                    state.copy(
                        isLoading = false,
                        isLoggedIn = false,
                        currentUser = null,
                        isRegistered = if (isTerminalNotRegistered) false else state.isRegistered,
                        currentScreen = when {
                            isTerminalNotRegistered -> PosScreen.RegisterTerminal
                            isNotAuthorized -> state.currentScreen
                            else -> state.currentScreen
                        },
                        errorMessage = when {
                            isNotAuthorized -> "No tiene permiso para usar este terminal. Contacte al administrador de la organización."
                            isTerminalNotRegistered -> "Este terminal no está registrado en el servidor. Debe emparejar nuevamente."
                            else -> msg.ifEmpty { "Error al autenticar con el nodo" }
                        }
                    )
                }
            }
        }
    }

    fun refreshCurrentUser() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = repository.fetchCurrentUser()
            result.onSuccess { user ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        currentUser = user
                    )
                }
            }.onFailure { err ->
                val hasToken = !repository.apiClient.authToken.isNullOrBlank()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isLoggedIn = hasToken,
                        currentUser = if (hasToken) it.currentUser else null,
                        currentScreen = if (hasToken) it.currentScreen else PosScreen.Login,
                        errorMessage = if (!hasToken) "Sesión expirada. Por favor inicie sesión nuevamente." else null
                    )
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.update {
                it.copy(
                    isLoggedIn = false,
                    currentUser = null,
                    currentScreen = PosScreen.Login,
                    successMessage = "Sesión cerrada correctamente"
                )
            }
        }
    }

    fun updateTerminalId(newId: String) {
        viewModelScope.launch {
            repository.updateTerminalId(newId)
            _uiState.update {
                it.copy(successMessage = "ID de Terminal actualizado a $newId")
            }
        }
    }

    fun completeRegistrationWithToken(token: String) {
        if (token.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el token de registro (UUID) proporcionado por el nodo") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val res = repository.registerTerminalWithToken(token)
            res.onSuccess { resp ->
                val config = repository.getOrInitTerminalConfig()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRegistered = true,
                        currentScreen = PosScreen.Login,
                        successMessage = "¡Terminal registrado con éxito! Ahora inicie sesión con su cuenta de comercio."
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = err.message ?: "Error al registrar terminal con el nodo"
                    )
                }
            }
        }
    }

    fun registerTerminalWithAdmin(adminUser: String, adminPass: String, label: String) {
        if (adminUser.isBlank() || adminPass.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el usuario y contraseña del administrador") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val res = repository.registerTerminalWithAdminCredentials(adminUser, adminPass, label)
            res.onSuccess {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRegistered = true,
                        currentScreen = PosScreen.Login,
                        successMessage = "¡Terminal creado y registrado exitosamente en el nodo! Inicie sesión con la cuenta de comercio."
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = err.message ?: "Error al auto-registrar con cuenta administrativa"
                    )
                }
            }
        }
    }

    // ============================================
    // Terminal Pairing by Short Code
    // ============================================

    fun startPairing() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    successMessage = null,
                    pairingCode = null,
                    pairingStatus = null,
                    pairingRemainingSeconds = 60
                )
            }
            val res = repository.initiatePairing()
            res.onSuccess { resp ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        pairingCode = resp.pairingCode,
                        pairingStatus = "pending",
                        pairingRemainingSeconds = resp.expiresIn ?: 60,
                        successMessage = "Código generado. Pida al administrador que apruebe: ${resp.pairingCode}"
                    )
                }
                startPairingPolling(resp.pairingCode ?: "")
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = err.message ?: "Error al iniciar emparejamiento"
                    )
                }
            }
        }
    }

    private fun startPairingPolling(code: String) {
        stopPairingPolling()
        pairingPollJob = viewModelScope.launch {
            // Cuenta regresiva local (tiempo visible: 60 segundos)
            val countdownJob = launch {
                while (isActive) {
                    delay(1000L)
                    val current = _uiState.value.pairingRemainingSeconds
                    if (current <= 0) break
                    _uiState.update { it.copy(pairingRemainingSeconds = current - 1) }
                }
                // Tiempo visible agotado: entrar en grace period (30 segundos mas)
                _uiState.update { it.copy(isInGracePeriod = true) }
            }

            // Polling al servidor cada 2 segundos
            // Durante el grace period, seguimos haciendo polling por si una
            // aprobacion estaba en vuelo cuando el tiempo expiro.
            var gracePeriodSeconds = 0
            while (isActive) {
                delay(2000L)
                val state = _uiState.value
                if (state.pairingStatus != "pending") break

                // Si estamos en grace period, contar segundos
                if (state.isInGracePeriod) {
                    gracePeriodSeconds += 2
                    if (gracePeriodSeconds >= 30) {
                        // Grace period agotado: expirar de verdad
                        _uiState.update {
                            it.copy(
                                pairingStatus = "expired",
                                isInGracePeriod = false,
                                errorMessage = "Tiempo agotado. El código ha expirado. Intente nuevamente."
                            )
                        }
                        break
                    }
                }

                val res = repository.pollPairingStatus(code)
                res.onSuccess { status ->
                    when (status.status) {
                        "approved" -> {
                            // Guardar la server_public_key
                            val completeRes = repository.completePairing(status)
                            completeRes.onSuccess {
                                _uiState.update {
                                    it.copy(
                                        pairingStatus = "approved",
                                        isRegistered = true,
                                        isInGracePeriod = false,
                                        currentScreen = PosScreen.Login,
                                        successMessage = "¡Terminal emparejado y registrado exitosamente! Inicie sesión con su cuenta de comercio.",
                                        errorMessage = null
                                    )
                                }
                            }.onFailure { e ->
                                _uiState.update {
                                    it.copy(
                                        pairingStatus = null,
                                        isInGracePeriod = false,
                                        errorMessage = "Error al guardar configuración: ${e.message}"
                                    )
                                }
                            }
                            break
                        }
                        "expired" -> {
                            _uiState.update {
                                it.copy(
                                    pairingStatus = "expired",
                                    isInGracePeriod = false,
                                    errorMessage = "Tiempo agotado. El código ha expirado. Intente nuevamente."
                                )
                            }
                            break
                        }
                        "rejected" -> {
                            _uiState.update {
                                it.copy(
                                    pairingStatus = "rejected",
                                    isInGracePeriod = false,
                                    errorMessage = "Solicitud rechazada por el administrador."
                                )
                            }
                            break
                        }
                        "pending" -> {
                            // Actualizar tiempo restante del servidor si difiere
                            val serverRemaining = status.remainingSeconds ?: 60
                            val localRemaining = _uiState.value.pairingRemainingSeconds
                            if (serverRemaining > 0 && kotlin.math.abs(serverRemaining - localRemaining) > 3) {
                                _uiState.update { it.copy(pairingRemainingSeconds = serverRemaining) }
                            }
                            // Si el servidor dice remaining=0 pero sigue pending,
                            // estamos en grace period del servidor. No hacer nada especial.
                        }
                    }
                }
            }
            countdownJob.cancel()
        }
    }

    fun stopPairingPolling() {
        pairingPollJob?.cancel()
        pairingPollJob = null
    }

    fun cancelPairing() {
        stopPairingPolling()
        _uiState.update {
            it.copy(
                pairingCode = null,
                pairingStatus = null,
                pairingRemainingSeconds = 60,
                isInGracePeriod = false,
                errorMessage = null,
                successMessage = null
            )
        }
    }

    fun resetTerminalRegistration() {
        viewModelScope.launch {
            repository.resetTerminalRegistration()
            val config = repository.getOrInitTerminalConfig()
            _uiState.update {
                it.copy(
                    isRegistered = false,
                    isLoggedIn = false,
                    currentUser = null,
                    currentScreen = PosScreen.RegisterTerminal,
                    successMessage = "Identidad criptográfica reiniciada. Ingrese los datos de registro del nuevo nodo."
                )
            }
        }
    }

    fun updateServerUrl(url: String) {
        val sanitized = PosApiClient.sanitizeUrl(url)
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, successMessage = null) }
            repository.updateServerUrl(sanitized)
            val isDemo = repository.apiClient.isDemoNode
            _uiState.update {
                it.copy(
                    isLoading = false,
                    serverUrl = sanitized,
                    isDemoNode = isDemo,
                    nodeDomain = repository.apiClient.nodeDomain,
                    successMessage = if (isDemo) {
                        "Modo Demostración activado (/demo). Cobros y pagos simulados para pruebas."
                    } else {
                        "Conectado exitosamente al nodo: $sanitized"
                    }
                )
            }
            loadCardTypeConfig()
        }
    }

    fun loadCardTypeConfig() {
        viewModelScope.launch {
            val cfg = repository.getCardTypeConfig()
            _uiState.update {
                it.copy(
                    cardTypeConfig = cfg,
                    requireIdVerification = cfg.requireIdDocumentForUidOnly ?: false
                )
            }
        }
    }

    // ============================================
    // Verificacion de estado antes de transacciones
    // ============================================

    /**
     * Verifica con el servidor que el terminal sigue registrado, activo y que
     * las claves criptograficas coinciden antes de iniciar una transaccion.
     * Si el terminal fue desactivado, borrado, o las claves no coinciden,
     * resetea el registro y vuelve a la pantalla de emparejamiento.
     * Retorna false si no se puede continuar con la transaccion.
     */
    private suspend fun verifyTerminalStatus(): Boolean {
        val hbRes = repository.heartbeat()
        var canProceed = true
        hbRes.onSuccess { hb ->
            if (hb.notFound == true) {
                // Solo si el servidor confirmó 404 (not found)
                repository.resetTerminalRegistration()
                _uiState.update {
                    it.copy(
                        isRegistered = false,
                        currentScreen = PosScreen.RegisterTerminal,
                        isLoading = false,
                        errorMessage = "Este terminal fue eliminado del servidor. Vuelva a emparejar."
                    )
                }
                canProceed = false
            } else if (hb.keyMatches == false) {
                // Las claves no coinciden — intentar auto-renovar
                if (!handleKeyMismatch()) {
                    canProceed = false
                }
                // Si la auto-renovacion tuvo exito, canProceed sigue true
            } else if (hb.active == false) {
                // Terminal desactivado pero no borrado
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Este terminal está desactivado. Contacte al administrador."
                    )
                }
                canProceed = false
            }
        }
        // Si el heartbeat falla por 500 o red, permitir continuar la transaccion
        return canProceed
    }

    // --- QR CHARGE WORKFLOW ---
    fun startQrCharge() {
        val centavos = CurrencyHelper.parseInputToCentavos(_uiState.value.amountInput)
        if (centavos <= 0) {
            _uiState.update { it.copy(errorMessage = "Ingrese un monto mayor a 0 TQ") }
            return
        }

        viewModelScope.launch {
            // Verificar estado del terminal antes de iniciar la transaccion
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val desc = _uiState.value.chargeDescription.ifBlank { "Cobro POS" }
            val res = repository.createQrCharge(centavos, desc)

            res.onSuccess { charge ->
                val payUrl = repository.apiClient.getPayQrUrl(charge.chargeToken ?: "")
                val initialSeconds = charge.expiresIn ?: 180
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        qrChargeResponse = charge,
                        qrPayUrl = payUrl,
                        qrStatus = "pending",
                        isQrPolling = true,
                        qrRemainingSeconds = initialSeconds,
                        qrInitialSeconds = initialSeconds,
                        qrRequiredSignatures = 1,
                        qrCollectedSignatures = 0,
                        qrSignaturesList = emptyList()
                    )
                }
                startQrTimer(initialSeconds)
                startQrPolling(charge.chargeId ?: "")
            }.onFailure { err ->
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    private fun startQrTimer(seconds: Int = 180) {
        qrTimerJob?.cancel()
        _uiState.update {
            it.copy(
                qrRemainingSeconds = seconds,
                qrInitialSeconds = seconds
            )
        }
        qrTimerJob = viewModelScope.launch {
            while (isActive && _uiState.value.qrRemainingSeconds > 0) {
                delay(1000)
                val current = _uiState.value.qrRemainingSeconds
                if (current <= 1) {
                    _uiState.update {
                        it.copy(
                            qrRemainingSeconds = 0,
                            qrStatus = "expired",
                            isQrPolling = false,
                            errorMessage = "Código QR vencido (Tiempo límite de 3 minutos agotado)"
                        )
                    }
                    stopQrPolling()
                    FeedbackHelper.playError(getApplication())
                    break
                } else {
                    _uiState.update { it.copy(qrRemainingSeconds = current - 1) }
                }
            }
        }
    }

    private fun stopQrTimer() {
        qrTimerJob?.cancel()
        qrTimerJob = null
    }

    private fun startQrPolling(chargeId: String) {
        qrPollJob?.cancel()
        qrPollJob = viewModelScope.launch {
            while (isActive) {
                delay(2000)
                val res = repository.pollQrChargeStatus(chargeId)
                res.onSuccess { status ->
                    val required = status.requiredSignatures ?: 1
                    val collected = status.collectedSignatures ?: status.signaturesCount ?: (if (status.status == "paid") 1 else 0)
                    val signatures = status.signatures ?: emptyList()

                    if (status.status == "paid" || (required > 0 && collected >= required && status.status != "pending")) {
                        stopQrTimer()
                        FeedbackHelper.playSuccess(getApplication())
                        _uiState.update {
                            it.copy(
                                qrStatus = "paid",
                                isQrPolling = false,
                                qrRequiredSignatures = required,
                                qrCollectedSignatures = required,
                                qrSignaturesList = signatures,
                                successMessage = "¡Cobro QR aprobado exitosamente!"
                            )
                        }
                        return@launch
                    } else if (status.status == "expired" || status.status == "cancelled") {
                        stopQrTimer()
                        FeedbackHelper.playError(getApplication())
                        _uiState.update {
                            it.copy(
                                qrStatus = status.status,
                                isQrPolling = false,
                                errorMessage = if (status.status == "expired") "El cobro QR ha vencido" else "El cobro QR fue cancelado"
                            )
                        }
                        return@launch
                    } else if (collected > _uiState.value.qrCollectedSignatures || (required > 1 && status.status == "partially_signed")) {
                        // NUEVA FIRMA DETECTADA EN CUENTA MULTIFIRMA
                        // Cada vez que se procesa una firma, se resetea la cuenta regresiva a 3 minutos para la siguiente
                        FeedbackHelper.playCardDetected(getApplication())
                        startQrTimer(180)
                        _uiState.update {
                            it.copy(
                                qrStatus = "partially_signed",
                                qrRequiredSignatures = required,
                                qrCollectedSignatures = collected,
                                qrSignaturesList = signatures,
                                successMessage = "Firma $collected de $required completada. Esperando siguiente firmante..."
                            )
                        }
                    }
                }
            }
        }
    }

    fun cancelQrCharge() {
        val chargeId = _uiState.value.qrChargeResponse?.chargeId
        stopQrPolling()
        stopQrTimer()
        if (chargeId != null) {
            viewModelScope.launch {
                try {
                    repository.cancelQrCharge(chargeId)
                } catch (e: Exception) {
                    // ignore
                }
            }
        }
        _uiState.update {
            it.copy(
                qrChargeResponse = null,
                qrPayUrl = null,
                qrStatus = null,
                isQrPolling = false,
                qrRemainingSeconds = 180,
                qrRequiredSignatures = 1,
                qrCollectedSignatures = 0,
                qrSignaturesList = emptyList(),
                errorMessage = null,
                successMessage = "Cobro QR cancelado"
            )
        }
    }

    fun resetQrCharge() {
        cancelQrCharge()
    }

    private fun stopQrPolling() {
        qrPollJob?.cancel()
        qrPollJob = null
        _uiState.update { it.copy(isQrPolling = false) }
    }

    // --- NFC SINGLE PAYMENT WORKFLOW (unificado: doc+PIN primero, tarjeta despues) ---

    /**
     * Pre-autenticacion unificada para TODOS los pagos NFC.
     * El usuario ingresa documento + PIN PRIMERO (sin tarjeta).
     * El servidor valida y responde con el tipo de tarjeta que tiene el usuario.
     * Luego el POS sabe como procesar la tarjeta cuando se acerque.
     */
    /**
     * Lookup de usuario por username.
     * Determina el tipo de tarjeta y si requiere documento de identidad.
     */
    fun submitUserLookup() {
        val state = _uiState.value

        if (state.customerUsername.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el nombre de usuario del cliente") }
            return
        }

        viewModelScope.launch {
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            // Modo demo: simular lookup
            if (state.isDemoNode) {
                simulateUserLookup(state.customerUsername)
                return@launch
            }

            // Modo real: llamar al servidor
            val result = repository.userLookup(state.customerUsername)

            result.onSuccess { resp ->
                if (resp.found) {
                    // Step numbering:
                    // Classic (requiresDocument=true):  1=Monto, 2=Username, 3=Doc, 4=PIN, 5=Tap
                    // UID/DESFire (requiresDocument=false): 1=Monto, 2=Username, 3=PIN, 4=Tap
                    val pinStep = if (resp.requiresDocument) 4 else 3
                    // Si el servidor envia required_doc_type, pre-seleccionarlo
                    // Si no, usar el primer tipo de document_types, o mantener el default
                    val preSelectedDocType = when {
                        !resp.requiredDocType.isNullOrEmpty() -> resp.requiredDocType
                        !resp.documentTypes.isNullOrEmpty() -> resp.documentTypes.first()
                        else -> "cedula_v"
                    }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            userLookupResult = resp,
                            requiresDocument = resp.requiresDocument,
                            detectedCardType = resp.cardType ?: "uid_only",
                            isClassicFlow = resp.requiresDocument,
                            selectedDocType = preSelectedDocType,
                            nfcStep = pinStep
                        )
                    }
                    // Si requiere documento, cargar los tipos de documento del usuario
                    // Si no requiere documento, ir directo al PIN
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = resp.message ?: "Usuario no encontrado"
                        )
                    }
                }
            }.onFailure { err ->
                val msg = err.message ?: ""
                // Si el error es de desencriptacion (claves no coinciden), intentar auto-renovar
                val isCryptoError = msg.contains("message authentication failed") ||
                    msg.contains("signature verification failed") ||
                    msg.contains("decrypting payload")
                if (isCryptoError) {
                    // Intentar auto-renovar; si falla, handleKeyMismatch envia a re-pairing
                    if (!handleKeyMismatch()) {
                        return@launch
                    }
                    // Si la auto-renovacion tuvo exito, reintentar el user-lookup
                    val retryResult = repository.userLookup(state.customerUsername)
                    retryResult.onSuccess { resp ->
                        if (resp.found) {
                            val pinStep = if (resp.requiresDocument) 4 else 3
                            val preSelectedDocType = when {
                                !resp.requiredDocType.isNullOrEmpty() -> resp.requiredDocType
                                !resp.documentTypes.isNullOrEmpty() -> resp.documentTypes.first()
                                else -> "cedula_v"
                            }
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    userLookupResult = resp,
                                    requiresDocument = resp.requiresDocument,
                                    detectedCardType = resp.cardType ?: "uid_only",
                                    isClassicFlow = resp.requiresDocument,
                                    selectedDocType = preSelectedDocType,
                                    nfcStep = pinStep
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    errorMessage = resp.message ?: "Usuario no encontrado"
                                )
                            }
                        }
                    }.onFailure { retryErr ->
                        _uiState.update {
                            it.copy(isLoading = false, errorMessage = retryErr.message)
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = msg)
                    }
                }
            }
        }
    }

    /**
     * Simula lookup de usuario en modo demo.
     */
    private fun simulateUserLookup(username: String) {
        val isClassic = username.contains("classic", ignoreCase = true) ||
                        username.contains("clasica", ignoreCase = true)
        val resp = UserLookupResponse(
            found = true,
            userId = "demo-user-$username",
            cardType = if (isClassic) "classic" else "uid_only",
            requiresDocument = isClassic,
            documentTypes = if (isClassic) listOf("cedula_v", "cedula_e", "dni") else null,
            displayName = "Usuario Demo $username"
        )
        val pinStep = if (resp.requiresDocument) 4 else 3
        _uiState.update {
            it.copy(
                isLoading = false,
                userLookupResult = resp,
                requiresDocument = resp.requiresDocument,
                detectedCardType = resp.cardType ?: "uid_only",
                isClassicFlow = resp.requiresDocument,
                selectedDocType = "cedula_v",
                nfcStep = pinStep
            )
        }
    }

    fun submitUnifiedPreAuth() {
        val state = _uiState.value
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        // Username siempre obligatorio
        if (state.customerUsername.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el nombre de usuario del cliente") }
            return
        }
        // Si requiere documento (Classic), validar documento
        if (state.requiresDocument && state.idDocNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el número de documento de identidad") }
            return
        }
        if (state.customerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "Ingrese el PIN de 4 dígitos") }
            return
        }

        viewModelScope.launch {
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null, classicStep = "auth") }

            // Modo demo: simular pre-auth
            if (state.isDemoNode) {
                simulatePreAuth(centavos)
                return@launch
            }

            // Modo real: llamar al servidor
            // Si requiere documento (Classic), usar classicPreAuthWithDocument
            // Si no (UID/DESFire), usar classicPreAuth con solo username + PIN
            val result = if (state.requiresDocument) {
                repository.classicPreAuthWithDocument(
                    username = state.customerUsername,
                    docType = state.selectedDocType,
                    docNumber = state.idDocNumber,
                    pin = state.customerPin,
                    amountCentavos = centavos
                )
            } else {
                repository.classicPreAuth(
                    username = state.customerUsername,
                    pin = state.customerPin,
                    amountCentavos = centavos
                )
            }

            result.onSuccess { resp ->
                if (resp.preApproved && resp.cardUid != null) {
                    FeedbackHelper.playCardDetected(getApplication())
                    val isClassic = (resp.cardType == "classic")
                    val tapStep = if (state.requiresDocument) 5 else 4
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            classicPreAuth = resp,
                            classicStep = "tap_card",
                            nfcStep = tapStep,
                            detectedCardUid = resp.cardUid,
                            detectedCardType = resp.cardType ?: "uid_only",
                            isClassicFlow = isClassic,
                            classicRemainingSeconds = 30,
                            isNfcWaitingCard = true
                        )
                    }
                    if (isClassic) startClassicTimeout()
                } else {
                    FeedbackHelper.playError(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            classicStep = "idle",
                            errorMessage = resp.message ?: "Pre-autenticación rechazada"
                        )
                    }
                }
            }.onFailure { err ->
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(isLoading = false, classicStep = "idle", errorMessage = err.message)
                }
            }
        }
    }

    // The tap card step depends on whether document was required:
    // Classic: 1=Monto, 2=Username, 3=Doc, 4=PIN, 5=Tap
    // UID/DESFire: 1=Monto, 2=Username, 3=PIN, 4=Tap

    /**
     * Simula pre-auth en modo demo.
     * Genera una respuesta falsa segun el documento ingresado.
     */
    private fun simulatePreAuth(centavos: Long) {
        val state = _uiState.value
        val docNum = state.idDocNumber

        // Determinar tipo de tarjeta segun el documento
        val isMultisig = docNum.contains("MULTISIG", ignoreCase = true) ||
                         docNum.contains("2SIG", ignoreCase = true) ||
                         docNum.contains("3SIG", ignoreCase = true) ||
                         docNum.contains("FIRM", ignoreCase = true)

        val cardType = if (isMultisig) "desfire" else "classic"
        val cardUid = if (isMultisig) "DEMO-DESFire-${docNum.take(6)}" else "DEMO-CLASSIC-${docNum.take(6)}"

        val fakePreAuth = if (cardType == "classic") {
            ClassicPreAuthResponse(
                preApproved = true,
                cardUid = cardUid,
                cardType = cardType,
                readSector = 5,
                readKeyA = "aabbccddeeff",
                expectedCertificate = "11223344556677889900aabbccddeeff",
                writeSector = 10,
                writeKeyB = "112233445566",
                newCertificate = "ffeeddccbbaa99887766554433221100"
            )
        } else {
            ClassicPreAuthResponse(
                preApproved = true,
                cardUid = cardUid,
                cardType = cardType
            )
        }

        FeedbackHelper.playCardDetected(getApplication())
        _uiState.update {
            it.copy(
                isLoading = false,
                classicPreAuth = fakePreAuth,
                classicStep = "tap_card",
                nfcStep = 4,
                detectedCardUid = cardUid,
                detectedCardType = cardType,
                isClassicFlow = (cardType == "classic"),
                classicRemainingSeconds = 30,
                isNfcWaitingCard = true
            )
        }
    }

    /**
     * Procesa la tarjeta cuando se acerca al lector.
     * Usa el card_type del pre-auth para saber como procesar.
     */
    fun onCardTapped(cardUid: String, isDesfire: Boolean = false) {
        val state = _uiState.value
        val preAuth = state.classicPreAuth

        // Si no hay pre-auth, no procesar (el flujo nuevo requiere pre-auth primero)
        if (preAuth == null || state.classicStep != "tap_card") {
            return
        }

        // Verificar que el UID coincide con el del pre-auth
        if (cardUid != preAuth.cardUid) {
            _uiState.update {
                it.copy(errorMessage = "La tarjeta no coincide con el usuario autenticado")
            }
            return
        }

        val cardType = preAuth.cardType ?: "uid_only"

        if (cardType == "classic") {
            // Flujo Classic: requiere lectura/escritura de sectores
            // El POS Android usa MifareClassicReader (ver onClassicCardTapped)
            // Por ahora, en modo demo o sin reader fisico, simular exito
            if (state.isDemoNode) {
                simulateClassicCardWrite()
            }
            // Si no es demo, onClassicCardTapped() se llama desde MainActivity con el Tag real
        } else {
            // Flujo UID-only o DESFire: procesar pago normal
            FeedbackHelper.playCardDetected(getApplication())
            _uiState.update {
                it.copy(
                    detectedCardUid = cardUid,
                    detectedCardType = if (isDesfire) "desfire" else cardType,
                    isNfcWaitingCard = false
                )
            }
            // Procesar pago inmediatamente
            processNfcAfterPreAuth()
        }
    }

    /**
     * Procesa el pago NFC despues del pre-auth (para uid_only/desfire).
     * Usa los datos del pre-auth en vez de detectar la tarjeta.
     */
    private fun processNfcAfterPreAuth() {
        val state = _uiState.value
        val preAuth = state.classicPreAuth ?: return
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val isDesfire = (state.detectedCardType == "desfire")
            val result = repository.processNfcPayment(
                cardUid = preAuth.cardUid!!,
                isDesfire = isDesfire,
                pin = state.customerPin,
                amountCentavos = centavos,
                idDocType = state.selectedDocType,
                idDocNumber = state.idDocNumber
            )

            result.onSuccess { res ->
                if (res.status == "pending_multisig") {
                    FeedbackHelper.playCardDetected(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isMultisigActive = true,
                            multisigPendingId = res.transactionId ?: res.pendingId ?: UUID.randomUUID().toString(),
                            multisigRequiredSigs = res.requiredSigs ?: 2,
                            multisigCollectedSigs = res.collectedSigs ?: 1,
                            multisigRemainingSeconds = 600L,
                            multisigMessage = res.message ?: "Cuenta multi-firma. Acerque las tarjetas de los siguientes firmantes.",
                            customerPin = "",
                            isNfcWaitingCard = true
                        )
                    }
                    startMultisigPolling(_uiState.value.multisigPendingId!!)
                } else if (res.status == "approved") {
                    FeedbackHelper.playSuccess(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            nfcPaymentResult = res,
                            classicStep = "done",
                            successMessage = "¡Cobro NFC aprobado exitosamente por ${CurrencyHelper.formatCentavos(centavos)}!"
                        )
                    }
                } else {
                    FeedbackHelper.playError(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = res.message ?: "Transacción rechazada"
                        )
                    }
                }
            }.onFailure { err ->
                FeedbackHelper.playError(getApplication())
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    /**
     * Simula la escritura de la tarjeta Classic en modo demo.
     */
    private fun simulateClassicCardWrite() {
        val state = _uiState.value
        val preAuth = state.classicPreAuth ?: return
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        viewModelScope.launch {
            _uiState.update {
                it.copy(isWritingCard = true, classicStep = "writing", writeProgress = "Leyendo sector...")
            }
            delay(500)
            _uiState.update { it.copy(writeProgress = "Verificando certificado...") }
            delay(500)
            _uiState.update { it.copy(writeProgress = "Escribiendo nuevo certificado...") }
            delay(500)
            _uiState.update { it.copy(writeProgress = "Confirmando transacción...") }

            // Simular confirmacion
            val result = repository.confirmClassicTransaction(
                cardUid = preAuth.cardUid!!,
                readOk = true,
                writeOk = true,
                writtenBlocks = 3
            )

            result.onSuccess { res ->
                if (res.status == "approved") {
                    FeedbackHelper.playSuccess(getApplication())
                    _uiState.update {
                        it.copy(
                            isWritingCard = false,
                            classicStep = "done",
                            writeProgress = "",
                            nfcPaymentResult = res,
                            isNfcWaitingCard = false,
                            successMessage = "¡Cobro NFC aprobado exitosamente por ${CurrencyHelper.formatCentavos(centavos)}!"
                        )
                    }
                } else {
                    FeedbackHelper.playError(getApplication())
                    _uiState.update {
                        it.copy(
                            isWritingCard = false,
                            classicStep = "idle",
                            writeProgress = "",
                            isNfcWaitingCard = false,
                            errorMessage = res.message ?: "Transacción rechazada"
                        )
                    }
                }
            }.onFailure { err ->
                // En demo mode, si el servidor no responde, simular exito
                FeedbackHelper.playSuccess(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "done",
                        writeProgress = "",
                        nfcPaymentResult = PaymentResultDecrypted(
                            status = "approved",
                            transactionId = "DEMO-${UUID.randomUUID().toString().take(8)}",
                            message = "Pago demo aprobado"
                        ),
                        isNfcWaitingCard = false,
                        successMessage = "¡Cobro NFC demo aprobado por ${CurrencyHelper.formatCentavos(centavos)}!"
                    )
                }
            }
        }
    }

    // --- QR SIMULATION CONTROLS (DEMO MODE) ---
    fun simulateQrApproval(requiredSignatures: Int = 1) {
        val chargeId = _uiState.value.qrChargeResponse?.chargeId ?: "DEMO-CHG-SIM"
        val centavos = CurrencyHelper.parseInputToCentavos(_uiState.value.amountInput)
        stopQrPolling()
        stopQrTimer()
        FeedbackHelper.playSuccess(getApplication())

        viewModelScope.launch {
            repository.transactionDao.insertTransaction(
                TransactionEntity(
                    id = chargeId,
                    amount = centavos,
                    paymentMethod = "qr",
                    status = "approved",
                    receiptNumber = "QR-${chargeId.take(8).uppercase()}"
                )
            )
        }

        _uiState.update {
            it.copy(
                qrStatus = "paid",
                qrCollectedSignatures = requiredSignatures,
                qrRequiredSignatures = requiredSignatures,
                isQrPolling = false,
                successMessage = "¡Pago QR simulado aprobado exitosamente!"
            )
        }
    }

    fun simulateQrMultisigSignature() {
        val currentCollected = _uiState.value.qrCollectedSignatures
        val required = 2
        val nextCollected = currentCollected + 1

        if (nextCollected >= required) {
            simulateQrApproval(requiredSignatures = required)
        } else {
            FeedbackHelper.playCardDetected(getApplication())
            startQrTimer(180)
            _uiState.update {
                it.copy(
                    qrStatus = "partially_signed",
                    qrRequiredSignatures = required,
                    qrCollectedSignatures = nextCollected,
                    qrSignaturesList = listOf(
                        QrSignatureInfo(signerName = "Firma 1 / Comprador", signedAt = "Confirmado", status = "signed")
                    ),
                    successMessage = "Firma $nextCollected de $required completada. Esperando siguiente firmante (3 minutos)..."
                )
            }
        }
    }

    fun simulateQrRejection() {
        stopQrPolling()
        stopQrTimer()
        FeedbackHelper.playError(getApplication())
        _uiState.update {
            it.copy(
                qrStatus = "expired",
                isQrPolling = false,
                errorMessage = "El pago QR fue rechazado o anulado por el usuario."
            )
        }
    }

    // NOTA: submitNfcPayment() y submitClassicPayment() fueron reemplazados
    // por submitUnifiedPreAuth() que maneja todos los tipos de tarjeta.
    // El flujo ahora es: doc+PIN → pre-auth → tap card → procesar segun card_type.

    private var classicTimeoutJob: Job? = null

    private fun startClassicTimeout() {
        classicTimeoutJob?.cancel()
        classicTimeoutJob = viewModelScope.launch {
            while (isActive && _uiState.value.classicRemainingSeconds > 0) {
                delay(1000)
                _uiState.update {
                    it.copy(classicRemainingSeconds = it.classicRemainingSeconds - 1)
                }
            }
            if (_uiState.value.classicStep == "tap_card") {
                cancelClassicPayment("Tiempo agotado. Acerque la tarjeta más rápido la próxima vez.")
            }
        }
    }

    fun cancelClassicPayment(reason: String) {
        classicTimeoutJob?.cancel()
        _uiState.update {
            it.copy(
                classicStep = "idle",
                classicPreAuth = null,
                isNfcWaitingCard = false,
                isWritingCard = false,
                errorMessage = reason,
                detectedCardUid = null
            )
        }
    }

    /**
     * Procesa la tarjeta Classic cuando se acerca al lector.
     * Lee el sector activo, verifica el certificado, escribe el nuevo certificado,
     * y confirma al servidor.
     *
     * @param tag el Tag NFC de Android
     * @param reader el lector MIFARE Classic
     */
    fun onClassicCardTapped(tag: android.nfc.Tag, reader: com.example.data.nfc.MifareClassicReader) {
        val state = _uiState.value
        val preAuth = state.classicPreAuth ?: return
        if (state.classicStep != "tap_card") return

        classicTimeoutJob?.cancel()

        viewModelScope.launch {
            _uiState.update {
                it.copy(isWritingCard = true, classicStep = "writing", writeProgress = "Leyendo tarjeta...")
            }

            // 1. Verificar UID
            val uid = reader.readUid(tag)
            if (uid != preAuth.cardUid) {
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        errorMessage = "La tarjeta no coincide con el usuario autenticado"
                    )
                }
                return@launch
            }

            // 2. Leer sector activo
            val keyA = hexToBytes(preAuth.readKeyA ?: "")
            val expectedCert = hexToBytes(preAuth.expectedCertificate ?: "")
            val blocks = reader.readSectorBlocks(tag, preAuth.readSector, keyA)

            if (blocks == null || !reader.verifyCertificate(blocks, expectedCert)) {
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        errorMessage = "No se pudo leer el certificado de la tarjeta"
                    )
                }
                // Confirmar fallo al servidor
                repository.confirmClassicTransaction(preAuth.cardUid!!, false, false, 0)
                return@launch
            }

            // 3. Escribir nuevo certificado
            _uiState.update { it.copy(writeProgress = "Escribiendo nueva clave en tarjeta...") }
            val keyB = hexToBytes(preAuth.writeKeyB ?: "")
            val newCert = hexToBytes(preAuth.newCertificate ?: "")
            val writeOk = reader.writeSectorBlocks(tag, preAuth.writeSector, newCert, keyB)

            // 4. Verificar escritura
            var writtenBlocks = 0
            if (writeOk) {
                _uiState.update { it.copy(writeProgress = "Verificando escritura...") }
                writtenBlocks = reader.verifyWrite(tag, preAuth.writeSector, keyA, newCert)
            }

            // 5. Confirmar al servidor
            _uiState.update { it.copy(writeProgress = "Confirmando transacción...") }
            val confirmResult = repository.confirmClassicTransaction(
                cardUid = preAuth.cardUid!!,
                readOk = true,
                writeOk = writeOk && writtenBlocks > 0,
                writtenBlocks = writtenBlocks
            )

            confirmResult.onSuccess { res ->
                if (res.status == "approved") {
                    FeedbackHelper.playSuccess(getApplication())
                    val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)
                    _uiState.update {
                        it.copy(
                            isWritingCard = false,
                            classicStep = "done",
                            writeProgress = "",
                            nfcPaymentResult = res,
                            isNfcWaitingCard = false,
                            successMessage = "¡Cobro NFC aprobado exitosamente por ${CurrencyHelper.formatCentavos(centavos)}!"
                        )
                    }
                } else {
                    FeedbackHelper.playError(getApplication())
                    _uiState.update {
                        it.copy(
                            isWritingCard = false,
                            classicStep = "idle",
                            writeProgress = "",
                            isNfcWaitingCard = false,
                            errorMessage = res.message ?: "Transacción rechazada"
                        )
                    }
                }
            }.onFailure { err ->
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        writeProgress = "",
                        isNfcWaitingCard = false,
                        errorMessage = err.message
                    )
                }
            }
        }
    }

    /**
     * Flujo generico de tarjeta con certificados dinamicos usando CardReaderRegistry.
     * Soporta MIFARE Classic, NTAG215, Ultralight C y DESFire.
     *
     * Se llama desde MainActivity cuando se detecta un tag NFC y estamos en
     * el paso "tap_card" de un flujo con certificados dinamicos.
     *
     * @param tag el Tag NFC de Android
     * @param cardReader el reader detectado por CardReaderRegistry
     * @param readSlot slot a leer
     * @param writeSlot slot a escribir
     * @param authData datos de autenticacion (Key A, PWD, clave 3DES, etc.)
     * @param expectedCert certificado esperado en el slot de lectura
     * @param newCert nuevo certificado a escribir
     * @param confirmCallback funcion que confirma al servidor (readOk, writeOk, writtenPages)
     */
    fun onDynamicCardTapped(
        tag: android.nfc.Tag,
        cardReader: com.example.data.nfc.CardReader,
        readSlot: Int,
        writeSlot: Int,
        authData: ByteArray,
        expectedCert: ByteArray,
        newCert: ByteArray,
        confirmCallback: suspend (Boolean, Boolean, Int) -> com.example.data.api.PaymentResultDecrypted
    ) {
        val state = _uiState.value
        if (state.classicStep != "tap_card") return

        classicTimeoutJob?.cancel()

        viewModelScope.launch {
            _uiState.update {
                it.copy(isWritingCard = true, classicStep = "writing", writeProgress = "Leyendo tarjeta...")
            }

            // 1. Verificar UID
            val uid = cardReader.readUid(tag)
            if (uid != state.detectedCardUid) {
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        errorMessage = "La tarjeta no coincide con el usuario autenticado"
                    )
                }
                return@launch
            }

            // 2. Leer certificado del slot activo
            val readCert = cardReader.readCertificate(tag, readSlot, authData)

            if (readCert == null || !readCert.contentEquals(expectedCert)) {
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        errorMessage = "No se pudo leer el certificado de la tarjeta"
                    )
                }
                // Confirmar fallo al servidor
                confirmCallback(false, false, 0)
                return@launch
            }

            // 3. Escribir nuevo certificado
            _uiState.update { it.copy(writeProgress = "Escribiendo nueva clave en tarjeta...") }
            val writeOk = cardReader.writeCertificate(tag, writeSlot, newCert, authData)

            // 4. Verificar escritura
            var writtenPages = 0
            if (writeOk) {
                _uiState.update { it.copy(writeProgress = "Verificando escritura...") }
                writtenPages = cardReader.verifyWrite(tag, writeSlot, newCert, authData)
            }

            // 5. Confirmar al servidor
            _uiState.update { it.copy(writeProgress = "Confirmando transacción...") }
            val confirmResult = confirmCallback(true, writeOk && writtenPages > 0, writtenPages)

            if (confirmResult.status == "approved") {
                FeedbackHelper.playSuccess(getApplication())
                val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "done",
                        writeProgress = "",
                        nfcPaymentResult = confirmResult,
                        isNfcWaitingCard = false,
                        successMessage = "¡Cobro NFC aprobado exitosamente por ${CurrencyHelper.formatCentavos(centavos)}!"
                    )
                }
            } else {
                FeedbackHelper.playError(getApplication())
                _uiState.update {
                    it.copy(
                        isWritingCard = false,
                        classicStep = "idle",
                        writeProgress = "",
                        isNfcWaitingCard = false,
                        errorMessage = confirmResult.message ?: "Transacción rechazada"
                    )
                }
            }
        }
    }

    private fun hexToBytes(hex: String): ByteArray {
        return hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }

    fun resetClassicFlow() {
        classicTimeoutJob?.cancel()
        _uiState.update {
            it.copy(
                classicStep = "idle",
                classicPreAuth = null,
                isWritingCard = false,
                writeProgress = "",
                isNfcWaitingCard = false,
                classicRemainingSeconds = 30,
                customerPin = "",
                idDocNumber = "",
                detectedCardUid = null,
                nfcPaymentResult = null
            )
        }
    }

    /**
     * Establece el UID de la tarjeta leida durante el provisionamiento.
     */
    fun setProvisionCardUid(uid: String) {
        // Guardar en estado para que ProvisionCardScreen lo use
        _uiState.update { it.copy(detectedCardUid = uid) }
    }
    private fun startMultisigPolling(pendingId: String) {
        multisigPollJob?.cancel()
        multisigPollJob = viewModelScope.launch {
            while (isActive) {
                delay(2500)
                val res = repository.getMultisigStatus(pendingId)
                res.onSuccess { status ->
                    if (status.status == "executed" || status.status == "approved" || (status.remainingSigs != null && status.remainingSigs == 0)) {
                        FeedbackHelper.playSuccess(getApplication())
                        _uiState.update {
                            it.copy(
                                isMultisigActive = false,
                                mvStep = 6, // Factura / Comprobante de venta
                                classicStep = "done",
                                customerPin = "",
                                buyerPin = "",
                                idDocNumber = "",
                                buyerDocNumber = "",
                                detectedCardUid = null,
                                successMessage = "¡Pago multi-firma completado y ejecutado!",
                                nfcPaymentResult = PaymentResultDecrypted(
                                    status = "approved",
                                    message = "Pago multi-firma ejecutado"
                                )
                            )
                        }
                        return@launch
                    } else if (status.status == "expired" || status.status == "cancelled") {
                        FeedbackHelper.playError(getApplication())
                        _uiState.update {
                            it.copy(
                                isMultisigActive = false,
                                errorMessage = "Tiempo agotado. El pago multi-firma ha sido anulado."
                            )
                        }
                        return@launch
                    } else {
                        _uiState.update {
                            val sCount = status.collectedCount
                            val sReq = status.requiredSignatures
                            it.copy(
                                multisigRemainingSeconds = status.remainingSeconds ?: (it.multisigRemainingSeconds - 2),
                                multisigCollectedSigs = if (sCount != null && sCount > it.multisigCollectedSigs) sCount else it.multisigCollectedSigs,
                                multisigRequiredSigs = if (sReq != null && sReq > it.multisigRequiredSigs) sReq else it.multisigRequiredSigs
                            )
                        }
                    }
                }
            }
        }
    }

    fun submitMultisigSigner(cardUid: String, pin: String, docType: String?, docNum: String?) {
        val pendingId = _uiState.value.multisigPendingId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val res = repository.signMultisigNfc(pendingId, cardUid, pin, docType, docNum)
            res.onSuccess { r ->
                if (r.status == "approved" || r.remainingSigs == 0) {
                    FeedbackHelper.playPaymentApprovedCoins(getApplication())
                    stopMultisigPolling()
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isMultisigActive = false,
                            mvStep = 6, // Paso 6: Pantalla de Factura/Comprobante final
                            classicStep = "done",
                            customerPin = "",
                            buyerPin = "",
                            idDocNumber = "",
                            buyerDocNumber = "",
                            detectedCardUid = null,
                            successMessage = "¡Todas las firmas requeridas han sido validadas! Pago multi-firma aprobado con éxito.",
                            nfcPaymentResult = r
                        )
                    }
                } else {
                    FeedbackHelper.playCardDetected(getApplication())
                    val newCollected = r.collectedSigs ?: (_uiState.value.multisigCollectedSigs + 1)
                    val newRequired = r.requiredSigs ?: _uiState.value.multisigRequiredSigs
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            multisigCollectedSigs = newCollected,
                            multisigRequiredSigs = newRequired,
                            customerPin = "",
                            buyerPin = "",
                            idDocNumber = "",       // Limpiar campo de documento para el siguiente firmante
                            buyerDocNumber = "",    // Limpiar campo de documento para el siguiente firmante
                            detectedCardUid = null,
                            isNfcWaitingCard = true,
                            successMessage = "Firma $newCollected de $newRequired registrada exitosamente. Ingrese los datos del siguiente firmante."
                        )
                    }
                }
            }.onFailure { err ->
                FeedbackHelper.playError(getApplication())
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    private fun stopMultisigPolling() {
        multisigPollJob?.cancel()
        multisigPollJob = null
        _uiState.update { it.copy(isMultisigActive = false) }
    }

    // --- MULTI-VENDOR WORKFLOW ---
    fun setMvStep(step: Int) {
        _uiState.update { it.copy(mvStep = step, errorMessage = null) }
    }

    fun onMultiVendorSellerTapped(cardUid: String) {
        FeedbackHelper.playCardDetected(getApplication())
        _uiState.update {
            it.copy(
                sellerCardUid = cardUid,
                sellerName = "Vendedor @${cardUid.take(6).uppercase()}",
                mvStep = 2 // Move to Amount Entry
            )
        }
    }

    fun onMultiVendorAmountSet() {
        val centavos = CurrencyHelper.parseInputToCentavos(_uiState.value.amountInput)
        if (centavos <= 0) {
            _uiState.update { it.copy(errorMessage = "Ingrese un monto válido") }
            return
        }
        _uiState.update { it.copy(mvStep = 3, errorMessage = null) } // Move to Buyer Document ID
    }

    fun onMultiVendorDocSet() {
        val state = _uiState.value
        if (state.buyerDocNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el documento de identidad del cliente") }
            return
        }
        _uiState.update { it.copy(mvStep = 4, errorMessage = null) } // Move to Buyer Secret PIN
    }

    fun onMultiVendorPinSet() {
        val state = _uiState.value
        if (state.buyerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "El comprador debe ingresar su clave secreta (PIN de 4 dígitos)") }
            return
        }
        _uiState.update { it.copy(mvStep = 5, errorMessage = null) } // Move to Scan / Tap Buyer Card
    }

    fun onMultiVendorBuyerTapped(cardUid: String, isMultisig: Boolean = false, requiredSigs: Int = 2, isDesfire: Boolean = false) {
        if (cardUid == _uiState.value.sellerCardUid) {
            FeedbackHelper.playCardScanError(getApplication())
            _uiState.update {
                it.copy(
                    isSameCardError = true,
                    errorMessage = "Error de Validación: El vendedor y el comprador no pueden ser la misma persona ni la misma tarjeta (${cardUid}). Utilice una tarjeta diferente para el cliente."
                )
            }
            return
        }
        FeedbackHelper.playCardDetected(getApplication())
        val mustAskId = !isDesfire
        val isMulti = isMultisig || cardUid.contains("MULTISIG") || cardUid.contains("3F") || cardUid.contains("2F") || cardUid.contains("3SIG") || cardUid.contains("2SIG") || cardUid.contains("FIRM")
        val req = if (cardUid.contains("3F") || cardUid.contains("3SIG") || requiredSigs == 3) 3 else if (isMulti) maxOf(2, requiredSigs) else 1

        _uiState.update {
            it.copy(
                isSameCardError = false,
                buyerCardUid = cardUid,
                requireIdVerification = mustAskId,
                isMultiVendorMultisig = isMulti,
                mvMultisigRequired = req,
                mvMultisigCollected = 0
            )
        }

        // Proceder directamente con el cobro ya que doc y pin fueron ingresados en pasos 3 y 4
        submitMultiVendorPayment()
    }

    fun submitMultiVendorPayment() {
        val state = _uiState.value
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        if (state.buyerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "El comprador debe ingresar su PIN de 4 dígitos") }
            return
        }
        if (state.buyerDocNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el documento de identidad del comprador") }
            return
        }

        viewModelScope.launch {
            // Verificar estado del terminal antes de iniciar la transaccion
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val res = repository.processCommunityPayment(
                sellerCardUid = state.sellerCardUid ?: "SELLER001",
                sellerPin = state.sellerPin,
                buyerCardUid = state.buyerCardUid ?: "BUYER001",
                buyerPin = state.buyerPin,
                amountCentavos = centavos,
                buyerIdDocType = state.buyerDocType,
                buyerIdDocNumber = state.buyerDocNumber
            )

            res.onSuccess { r ->
                if (r.status == "approved") {
                    FeedbackHelper.playPaymentApprovedCoins(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mvStep = 6, // Receipt Screen
                            nfcPaymentResult = r,
                            successMessage = "¡Venta comunitaria aprobada exitosamente!"
                        )
                    }
                } else if (r.status == "pending_multisig") {
                    // El servidor detecto que la cuenta del comprador requiere multifirma.
                    FeedbackHelper.playCardDetected(getApplication())
                    val reqSigs = r.requiredSigs ?: if (state.buyerCardUid?.contains("3F") == true || state.buyerCardUid?.contains("3SIG") == true) 3 else 2
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isMultisigActive = true,
                            multisigPendingId = r.pendingId ?: r.transactionId ?: UUID.randomUUID().toString(),
                            multisigRequiredSigs = reqSigs,
                            multisigCollectedSigs = r.collectedSigs ?: 1,
                            multisigRemainingSeconds = 600L,
                            multisigMessage = r.message ?: "Cuenta multi-firma ($reqSigs firmas). Acerque la tarjeta del 2do firmante.",
                            buyerPin = "",
                            customerPin = "",
                            idDocNumber = "",
                            buyerDocNumber = "",
                            detectedCardUid = null,
                            isNfcWaitingCard = true
                        )
                    }
                    startMultisigPolling(_uiState.value.multisigPendingId!!)
                } else {
                    FeedbackHelper.playPaymentError(getApplication())
                    _uiState.update { it.copy(isLoading = false, errorMessage = r.message ?: "Cobro rechazado") }
                }
            }.onFailure { err ->
                // Fallback en demo node para asegurar flujo fluido
                if (state.isDemoNode) {
                    FeedbackHelper.playPaymentApprovedCoins(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mvStep = 6,
                            nfcPaymentResult = PaymentResultDecrypted(
                                status = "approved",
                                transactionId = "DEMO-MV-${UUID.randomUUID().toString().take(8)}",
                                message = "Venta multi-vendedor demo aprobada"
                            ),
                            successMessage = "¡Venta comunitaria demo aprobada!"
                        )
                    }
                } else {
                    FeedbackHelper.playPaymentError(getApplication())
                    _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
                }
            }
        }
    }

    fun resetMultiVendorSale() {
        stopMultisigPolling()
        _uiState.update {
            it.copy(
                mvStep = 1,
                amountInput = "",
                sellerCardUid = null,
                buyerCardUid = null,
                buyerPin = "",
                customerPin = "",
                buyerDocNumber = "",
                idDocNumber = "",
                detectedCardUid = null,
                isSameCardError = false,
                isMultiVendorMultisig = false,
                mvMultisigRequired = 1,
                mvMultisigCollected = 0,
                isMultisigActive = false,
                multisigPendingId = null,
                multisigCollectedSigs = 0,
                multisigRequiredSigs = 1,
                nfcPaymentResult = null,
                errorMessage = null,
                successMessage = null
            )
        }
    }

    // --- SHIFTS ---
    fun openShift(initialamountCentavos: Long, pin: String, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.openShift(initialamountCentavos, pin, notes)
            res.onSuccess { shift ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        activeShift = shift,
                        successMessage = "Turno abierto correctamente"
                    )
                }
            }.onFailure { err ->
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    fun closeShift(pin: String, closingamountCentavos: Long?, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.closeShift(pin, closingamountCentavos, notes)
            res.onSuccess {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        activeShift = null,
                        successMessage = "Turno cerrado exitosamente"
                    )
                }
            }.onFailure { err ->
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    // --- SHIFT PIN (verifica contra el backend) ---
    fun hasShiftPin(callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            callback(repository.hasShiftPin())
        }
    }

    fun verifyShiftPin(pin: String, callback: (Boolean, String?, Boolean) -> Unit) {
        viewModelScope.launch {
            val res = repository.verifyShiftPin(pin)
            res.onSuccess { (valid, offline) ->
                callback(valid, null, offline)
            }.onFailure { err ->
                callback(false, err.message, false)
            }
        }
    }

    // --- SYNC OFFLINE CLOSE ---
    fun syncPendingClose(callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val synced = repository.syncPendingShiftClose()
            if (synced) {
                _uiState.update { it.copy(successMessage = "Cierre de turno sincronizado con el servidor") }
            }
            callback(synced)
        }
    }

    fun hasPendingSyncShift(callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            callback(repository.hasPendingSyncShift())
        }
    }

    // --- CHECK BACKEND SHIFT STATUS ---
    // Verifica si el backend ya cerró el turno que el POS tiene abierto localmente.
    // Si es así, descarga los datos de cierre del backend y actualiza el estado local.
    fun checkBackendShiftStatus(callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val updated = repository.checkBackendShiftStatus()
            if (updated) {
                _uiState.update { it.copy(activeShift = null, successMessage = "Turno cerrado por el backend — datos sincronizados") }
            }
            callback(updated)
        }
    }

    // --- SHIFT HISTORY (consulta al backend) ---
    fun loadShiftHistory(from: String? = null, to: String? = null, callback: (List<ShiftHistoryItem>) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = repository.listShiftsForCurrentTerminal(from, to)
            result.onSuccess { shifts ->
                _uiState.update { it.copy(isLoading = false) }
                callback(shifts)
            }.onFailure { err ->
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
                callback(emptyList())
            }
        }
    }

    // --- TERMINAL REGISTRATION ---
    fun registerTerminal(token: String) {
        completeRegistrationWithToken(token)
    }
}
