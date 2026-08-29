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
    val isNfcWaitingCard: Boolean = false,
    val detectedCardUid: String? = null,
    val detectedCardType: String = "uid_only", // "uid_only" or "desfire"
    val customerPin: String = "",
    val requireIdVerification: Boolean = false,
    val selectedDocType: String = "cedula",
    val idDocNumber: String = "",
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
    }

    // Reintentar verificacion con el servidor sin resetear las claves
    // Usa las claves existentes para verificar si el servidor ya reconoce este terminal
    fun retryVerification() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, successMessage = null) }

            // Primero intentar heartbeat (si el terminal ya esta registrado en el servidor)
            val hbResult = repository.heartbeat()
            hbResult.onSuccess { hb ->
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
                isNfcWaitingCard = (screen == PosScreen.NfcCharge),
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

    fun handleBackPress(): Boolean {
        val state = _uiState.value

        // If in MultiVendor flow past step 1, step backwards in the wizard
        if (state.currentScreen == PosScreen.MultiVendor && state.mvStep > 1) {
            _uiState.update {
                it.copy(
                    mvStep = it.mvStep - 1,
                    errorMessage = null,
                    buyerPin = "",
                    isSameCardError = false
                )
            }
            return true
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
                    isNfcWaitingCard = (previousScreen == PosScreen.NfcCharge),
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
                nfcPaymentResult = null,
                amountInput = "",
                idDocNumber = "",
                isMultisigActive = false,
                multisigPendingId = null,
                multisigCollectedSigs = 0,
                multisigRequiredSigs = 1,
                errorMessage = null,
                successMessage = null,
                isNfcWaitingCard = true
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
                // Si el servidor rechazo por terminal no registrado o clave incorrecta,
                // actualizar el estado y enviar a registro
                val isTerminalRejected = msg.contains("no coincide") || msg.contains("no esta registrado") ||
                    msg.contains("terminal_not_registered") || msg.contains("terminal_key_mismatch")
                _uiState.update { state ->
                    state.copy(
                        isLoading = false,
                        isLoggedIn = false,
                        currentUser = null,
                        isRegistered = if (isTerminalRejected) false else state.isRegistered,
                        currentScreen = if (isTerminalRejected) PosScreen.RegisterTerminal else state.currentScreen,
                        errorMessage = msg.ifEmpty { "Error al autenticar con el nodo" }
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
     * Verifica con el servidor que el terminal sigue registrado y activo
     * antes de iniciar una transaccion. Si el terminal fue desactivado o
     * borrado, resetea el registro y vuelve a la pantalla de emparejamiento.
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

    // --- NFC SINGLE PAYMENT WORKFLOW ---
    fun onCardTapped(cardUid: String, isDesfire: Boolean = false) {
        FeedbackHelper.playCardDetected(getApplication())
        val requireId = _uiState.value.cardTypeConfig?.requireIdDocumentForUidOnly ?: false
        val mustAskId = (!isDesfire && requireId)

        _uiState.update {
            it.copy(
                detectedCardUid = cardUid,
                detectedCardType = if (isDesfire) "desfire" else "uid_only",
                requireIdVerification = mustAskId,
                customerPin = "",
                idDocNumber = if (mustAskId) it.idDocNumber else "",
                isNfcWaitingCard = false
            )
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

    fun submitNfcPayment() {
        val state = _uiState.value
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)
        val cardUid = state.detectedCardUid

        if (cardUid.isNullOrBlank()) {
            _uiState.update { it.copy(errorMessage = "Acerque la tarjeta NFC primero") }
            return
        }
        if (state.customerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "Ingrese el PIN de 4 dígitos") }
            return
        }
        if (state.requireIdVerification && state.idDocNumber.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingrese el número de documento de identidad") }
            return
        }

        viewModelScope.launch {
            // Verificar estado del terminal antes de iniciar la transaccion
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val isDesfire = (state.detectedCardType == "desfire")

            val result = repository.processNfcPayment(
                cardUid = cardUid,
                isDesfire = isDesfire,
                pin = state.customerPin,
                amountCentavos = centavos,
                idDocType = if (state.requireIdVerification) state.selectedDocType else null,
                idDocNumber = if (state.requireIdVerification) state.idDocNumber else null
            )

            result.onSuccess { res ->
                if (res.status == "pending_multisig") {
                    // Transition to Multi-Sig Signing flow
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
                            detectedCardUid = null,
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

    // --- MIFARE CLASSIC DYNAMIC CERTIFICATES WORKFLOW ---

    /**
     * Inicia el flujo de pago con tarjeta Classic.
     * El usuario ingresa documento + PIN PRIMERO (sin tarjeta).
     * El servidor valida y responde con el sector a leer y escribir.
     */
    fun submitClassicPayment() {
        val state = _uiState.value
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        if (state.idDocNumber.isBlank()) {
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

            val result = repository.classicPreAuth(
                docType = state.selectedDocType,
                docNumber = state.idDocNumber,
                pin = state.customerPin,
                amountCentavos = centavos
            )

            result.onSuccess { resp ->
                if (resp.preApproved && resp.cardUid != null) {
                    FeedbackHelper.playCardDetected(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            classicPreAuth = resp,
                            classicStep = "tap_card",
                            detectedCardUid = resp.cardUid,
                            classicRemainingSeconds = 30,
                            isNfcWaitingCard = true
                        )
                    }
                    startClassicTimeout()
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
                    if (status.status == "executed") {
                        FeedbackHelper.playSuccess(getApplication())
                        _uiState.update {
                            it.copy(
                                isMultisigActive = false,
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
                            mvStep = 5,
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
                            detectedCardUid = null,
                            isNfcWaitingCard = true,
                            successMessage = "Firma $newCollected de $newRequired registrada exitosamente. Acerque la tarjeta del siguiente firmante."
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
        _uiState.update { it.copy(mvStep = 3, errorMessage = null) } // Move to Tap Buyer
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
                buyerPin = "",
                isMultiVendorMultisig = isMulti,
                mvMultisigRequired = req,
                mvMultisigCollected = 0,
                mvStep = 4 // Move to Buyer PIN & ID
            )
        }
    }

    fun submitMultiVendorPayment() {
        val state = _uiState.value
        val centavos = CurrencyHelper.parseInputToCentavos(state.amountInput)

        if (state.buyerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "El comprador/firmante debe ingresar su PIN de 4 dígitos") }
            return
        }
        if (state.requireIdVerification && state.buyerDocNumber.isBlank()) {
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
                buyerIdDocType = if (state.requireIdVerification) state.buyerDocType else null,
                buyerIdDocNumber = if (state.requireIdVerification) state.buyerDocNumber else null
            )

            res.onSuccess { r ->
                if (r.status == "approved") {
                    FeedbackHelper.playPaymentApprovedCoins(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mvStep = 5, // Result
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
                FeedbackHelper.playPaymentError(getApplication())
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
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
                buyerDocNumber = "",
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
    fun openShift(initialamountCentavos: Long, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.openShift(initialamountCentavos, notes)
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

    fun closeShift(closingamountCentavos: Long?, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.closeShift(closingamountCentavos, notes)
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

    // --- SHIFT PIN ---
    fun hasShiftPin(callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            callback(repository.hasShiftPin())
        }
    }

    fun setShiftPin(pin: String, callback: () -> Unit) {
        viewModelScope.launch {
            repository.setShiftPin(pin)
            callback()
        }
    }

    fun verifyShiftPin(pin: String, callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val res = repository.verifyShiftPin(pin)
            callback(res.getOrDefault(false))
        }
    }

    // --- TERMINAL REGISTRATION ---
    fun registerTerminal(token: String) {
        completeRegistrationWithToken(token)
    }
}
