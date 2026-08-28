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
}

data class PosUiState(
    val currentScreen: PosScreen = PosScreen.RegisterTerminal,
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

    // Multi-Vendor Flow
    val mvStep: Int = 1, // 1: Tap Seller, 2: Amount, 3: Tap Buyer, 4: Buyer PIN & ID, 5: Result
    val sellerCardUid: String? = null,
    val sellerName: String? = null,
    val sellerPin: String = "1234",
    val buyerCardUid: String? = null,
    val buyerPin: String = "",
    val buyerDocType: String = "cedula",
    val buyerDocNumber: String = "",

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

    fun navigateTo(screen: PosScreen) {
        // Reset transient states
        if (screen != PosScreen.QrCharge) stopQrPolling()
        if (screen != PosScreen.NfcCharge && screen != PosScreen.MultiVendor) stopMultisigPolling()
        if (screen != PosScreen.RegisterTerminal) stopPairingPolling()

        _uiState.update {
            it.copy(
                currentScreen = screen,
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

    fun resetNfcPaymentState() {
        _uiState.update {
            it.copy(
                detectedCardUid = null,
                customerPin = "",
                nfcPaymentResult = null,
                amountInput = "",
                idDocNumber = "",
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
        val microUnits = CurrencyHelper.parseInputToMicroUnits(_uiState.value.amountInput)
        if (microUnits <= 0) {
            _uiState.update { it.copy(errorMessage = "Ingrese un monto mayor a 0 TQ") }
            return
        }

        viewModelScope.launch {
            // Verificar estado del terminal antes de iniciar la transaccion
            if (!verifyTerminalStatus()) return@launch

            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val desc = _uiState.value.chargeDescription.ifBlank { "Cobro POS" }
            val res = repository.createQrCharge(microUnits, desc)

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
                isNfcWaitingCard = false
            )
        }
    }

    fun submitNfcPayment() {
        val state = _uiState.value
        val microUnits = CurrencyHelper.parseInputToMicroUnits(state.amountInput)
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
                amountMicroUnits = microUnits,
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
                            successMessage = "¡Cobro NFC aprobado exitosamente por ${CurrencyHelper.formatMicroUnits(microUnits)}!"
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

    // --- MULTI-SIG LIVE SIGNING & POLLING ---
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
                            it.copy(
                                multisigRemainingSeconds = status.remainingSeconds ?: (it.multisigRemainingSeconds - 2),
                                multisigCollectedSigs = status.collectedCount ?: it.multisigCollectedSigs,
                                multisigRequiredSigs = status.requiredSignatures ?: it.multisigRequiredSigs
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
                    FeedbackHelper.playSuccess(getApplication())
                    stopMultisigPolling()
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isMultisigActive = false,
                            successMessage = "¡Todas las firmas han sido recolectadas. Pago aprobado!",
                            nfcPaymentResult = r
                        )
                    }
                } else {
                    FeedbackHelper.playCardDetected(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            multisigCollectedSigs = it.multisigCollectedSigs + 1,
                            customerPin = "",
                            detectedCardUid = null,
                            successMessage = "Firma registrada. Faltan ${r.remainingSigs ?: 1} firma(s)."
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
        val microUnits = CurrencyHelper.parseInputToMicroUnits(_uiState.value.amountInput)
        if (microUnits <= 0) {
            _uiState.update { it.copy(errorMessage = "Ingrese un monto válido") }
            return
        }
        _uiState.update { it.copy(mvStep = 3, errorMessage = null) } // Move to Tap Buyer
    }

    fun onMultiVendorBuyerTapped(cardUid: String) {
        if (cardUid == _uiState.value.sellerCardUid) {
            FeedbackHelper.playError(getApplication())
            _uiState.update { it.copy(errorMessage = "El vendedor y el comprador no pueden ser la misma tarjeta") }
            return
        }
        FeedbackHelper.playCardDetected(getApplication())
        val requireId = _uiState.value.cardTypeConfig?.requireIdDocumentForUidOnly ?: false
        _uiState.update {
            it.copy(
                buyerCardUid = cardUid,
                requireIdVerification = requireId,
                buyerPin = "",
                mvStep = 4 // Move to Buyer PIN & ID
            )
        }
    }

    fun submitMultiVendorPayment() {
        val state = _uiState.value
        val microUnits = CurrencyHelper.parseInputToMicroUnits(state.amountInput)

        if (state.buyerPin.length < 4) {
            _uiState.update { it.copy(errorMessage = "El comprador debe ingresar su PIN de 4 dígitos") }
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
                amountMicroUnits = microUnits,
                buyerIdDocType = if (state.requireIdVerification) state.buyerDocType else null,
                buyerIdDocNumber = if (state.requireIdVerification) state.buyerDocNumber else null
            )

            res.onSuccess { r ->
                if (r.status == "approved") {
                    FeedbackHelper.playSuccess(getApplication())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            mvStep = 5, // Result
                            nfcPaymentResult = r,
                            successMessage = "¡Venta comunitaria aprobada!"
                        )
                    }
                } else {
                    FeedbackHelper.playError(getApplication())
                    _uiState.update { it.copy(isLoading = false, errorMessage = r.message ?: "Cobro rechazado") }
                }
            }.onFailure { err ->
                FeedbackHelper.playError(getApplication())
                _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
            }
        }
    }

    fun resetMultiVendorSale() {
        _uiState.update {
            it.copy(
                mvStep = 1,
                amountInput = "",
                sellerCardUid = null,
                buyerCardUid = null,
                buyerPin = "",
                nfcPaymentResult = null,
                errorMessage = null,
                successMessage = null
            )
        }
    }

    // --- SHIFTS ---
    fun openShift(initialAmountMicroUnits: Long, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.openShift(initialAmountMicroUnits, notes)
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

    fun closeShift(closingAmountMicroUnits: Long?, notes: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val res = repository.closeShift(closingAmountMicroUnits, notes)
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
