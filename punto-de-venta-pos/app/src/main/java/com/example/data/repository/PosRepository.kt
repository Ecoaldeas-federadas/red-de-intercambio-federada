package com.example.data.repository

import android.content.Context
import com.example.data.api.*
import com.example.data.crypto.CryptoEngine
import com.example.data.crypto.EncryptedPayload
import com.example.data.crypto.KeystoreCrypto
import com.example.data.crypto.toHex
import com.example.data.db.*
import com.example.ui.util.FormatConfig
import com.squareup.moshi.Moshi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.UUID

class PosRepository(
    private val context: Context,
    private val database: AppDatabase,
    val apiClient: PosApiClient
) {
    val transactionDao: TransactionDao = database.transactionDao()
    val shiftDao: ShiftDao = database.shiftDao()
    val shiftPinDao: ShiftPinDao = database.shiftPinDao()
    val terminalConfigDao: TerminalConfigDao = database.terminalConfigDao()

    val allTransactions: Flow<List<TransactionEntity>> = transactionDao.getAllTransactions()
    val latestShift: Flow<ShiftEntity?> = shiftDao.getLatestShiftFlow()
    val terminalConfig: Flow<TerminalConfigEntity?> = terminalConfigDao.getConfigFlow()

    private var currentUser: UserMeResponse? = null
    private var cachedSharedKey: ByteArray? = null

    // Guardar config con la clave privada encriptada
    private suspend fun saveConfigSecure(config: TerminalConfigEntity) = withContext(Dispatchers.IO) {
        // Encriptar la clave privada antes de guardar en Room
        val encryptedPrivateKey = if (config.terminalPrivateKeyHex.isNotEmpty() && !KeystoreCrypto.isEncrypted(config.terminalPrivateKeyHex)) {
            KeystoreCrypto.encrypt(config.terminalPrivateKeyHex)
        } else {
            config.terminalPrivateKeyHex
        }
        val secureConfig = config.copy(terminalPrivateKeyHex = encryptedPrivateKey)
        terminalConfigDao.saveConfig(secureConfig)
    }

    // Leer config con la clave privada desencriptada
    private suspend fun getConfigSecure(): TerminalConfigEntity? = withContext(Dispatchers.IO) {
        val config = terminalConfigDao.getConfig() ?: return@withContext null
        // Desencriptar la clave privada al leer
        val decryptedPrivateKey = if (config.terminalPrivateKeyHex.isNotEmpty() && KeystoreCrypto.isEncrypted(config.terminalPrivateKeyHex)) {
            KeystoreCrypto.decrypt(config.terminalPrivateKeyHex)
        } else {
            config.terminalPrivateKeyHex
        }
        config.copy(terminalPrivateKeyHex = decryptedPrivateKey)
    }

    suspend fun getOrInitTerminalConfig(): TerminalConfigEntity = withContext(Dispatchers.IO) {
        var config = getConfigSecure()
        if (config == null) {
            val keyPair = CryptoEngine.generateEd25519KeyPair()
            config = TerminalConfigEntity(
                id = 1,
                serverUrl = apiClient.serverUrl,
                terminalId = CryptoEngine.generateTerminalId(context),
                label = "Terminal Móvil POS",
                isRegistered = false,
                terminalPrivateKeyHex = keyPair.privateKeyHex,
                terminalPublicKeyHex = keyPair.publicKeyHex,
                serverPublicKeyHex = null,
                sessionToken = null,
                isMultiVendorEnabled = false
            )
            saveConfigSecure(config)
            // Devolver la config con la clave desencriptada (no la version encriptada guardada)
            config
        } else {
            // Migrar terminal_id viejo aleatorio (TERM-POS-*) al nuevo determinista
            // Solo si NO esta registrado (si ya esta registrado, el servidor tiene
            // el ID viejo y no podemos cambiarlo sin re-registrar)
            if (!config.isRegistered && config.terminalId.startsWith("TERM-POS-")) {
                val newTerminalId = CryptoEngine.generateTerminalId(context)
                val migrated = config.copy(terminalId = newTerminalId)
                saveConfigSecure(migrated)
                apiClient.updateConfig(migrated.serverUrl, apiClient.authToken, migrated.terminalId)
                return@withContext migrated
            }
        }
        apiClient.updateConfig(
            url = config.serverUrl,
            token = config.sessionToken ?: apiClient.authToken,
            termId = config.terminalId,
            pubKey = config.terminalPublicKeyHex
        )
        config
    }

    suspend fun updateTerminalId(newTerminalId: String) = withContext(Dispatchers.IO) {
        val current = getOrInitTerminalConfig()
        val updated = current.copy(terminalId = newTerminalId.trim())
        saveConfigSecure(updated)
        apiClient.updateConfig(updated.serverUrl, apiClient.authToken, updated.terminalId, updated.terminalPublicKeyHex)
    }

    suspend fun updateServerUrl(newUrl: String) = withContext(Dispatchers.IO) {
        val current = getOrInitTerminalConfig()
        val updated = current.copy(serverUrl = PosApiClient.sanitizeUrl(newUrl))
        saveConfigSecure(updated)
        apiClient.updateConfig(updated.serverUrl, apiClient.authToken, updated.terminalId, updated.terminalPublicKeyHex)
        cachedSharedKey = null
    }

    suspend fun resetTerminalRegistration(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val current = getOrInitTerminalConfig()
            val keyPair = CryptoEngine.generateEd25519KeyPair()
            val reset = current.copy(
                isRegistered = false,
                terminalPrivateKeyHex = keyPair.privateKeyHex,
                terminalPublicKeyHex = keyPair.publicKeyHex,
                serverPublicKeyHex = null,
                sessionToken = null
            )
            saveConfigSecure(reset)
            cachedSharedKey = null
            apiClient.authToken = null
            currentUser = null
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Error al resetear registro: ${e.localizedMessage}"))
        }
    }

    // Marcar el terminal como registrado sin resetear las claves
    // Se usa cuando el servidor confirma que el terminal ya esta registrado
    // pero el estado local dice que no (por ejemplo, despues de un fallo temporal)
    suspend fun markTerminalRegistered() = withContext(Dispatchers.IO) {
        try {
            val current = getOrInitTerminalConfig()
            saveConfigSecure(current.copy(isRegistered = true))
        } catch (e: Exception) {
            // No es critico si falla
        }
    }

    suspend fun toggleMultiVendor(enabled: Boolean) = withContext(Dispatchers.IO) {
        val current = getOrInitTerminalConfig()
        saveConfigSecure(current.copy(isMultiVendorEnabled = enabled))
    }

    // ============================================
    // Terminal Authentication (POST /api/nfc/terminal/auth)
    // ============================================

    /**
     * Authenticates the terminal with the server using its Ed25519 key pair.
     * The server responds with a session token and, when available, format_settings
     * (locale, date/time format, timezone, etc.) which are persisted to the local
     * config and applied to the in-memory [FormatConfig].
     */
    suspend fun authenticateTerminal(): Result<TerminalAuthResponse> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val sharedKey = ensureSharedKey()
            val nonce = CryptoEngine.generateRandomNonce(16)
            val timestamp = System.currentTimeMillis() / 1000

            // Sign (terminal_id + nonce + timestamp) with the terminal private key
            val message = "${config.terminalId}|$nonce|$timestamp".toByteArray(Charsets.UTF_8)
            val signature = CryptoEngine.signEd25519(config.terminalPrivateKeyHex, message)

            val service = apiClient.getService()
            val request = TerminalAuthRequest(
                terminalId = config.terminalId,
                signature = signature,
                nonce = nonce,
                deviceFingerprint = CryptoEngine.getDeviceFingerprint(context)
            )

            val response = service.terminalAuth(request)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!

                // Persist session token if provided
                val sessionToken = body.sessionToken ?: config.sessionToken

                // Apply format_settings from the server if present
                val fs = body.formatSettings
                val updated = if (fs != null) {
                    config.copy(
                        sessionToken = sessionToken,
                        fmtLocale = fs.locale ?: config.fmtLocale,
                        fmtNumberLocale = fs.numberLocale ?: config.fmtNumberLocale,
                        fmtDateFormat = fs.dateFormat ?: config.fmtDateFormat,
                        fmtTimeFormat = fs.timeFormat ?: config.fmtTimeFormat,
                        fmtFirstDayOfWeek = fs.firstDayOfWeek ?: config.fmtFirstDayOfWeek,
                        fmtTimezone = fs.timezone ?: config.fmtTimezone
                    )
                } else {
                    config.copy(sessionToken = sessionToken)
                }
                saveConfigSecure(updated)

                // Update the in-memory format config so formatters reflect new settings
                FormatConfig.updateFromEntity(updated)

                if (!sessionToken.isNullOrBlank()) {
                    apiClient.authToken = sessionToken
                }

                Result.success(body)
            } else {
                val err = response.errorBody()?.string() ?: response.body()?.error ?: "Error de autenticación del terminal (Código ${response.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión al autenticar terminal: ${e.localizedMessage}"))
        }
    }

    suspend fun login(username: String, password: String): Result<LoginResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val response = service.login(LoginRequest(username.trim(), password))
            if (response.isSuccessful && response.body()?.token != null) {
                val body = response.body()!!
                apiClient.authToken = body.token
                
                // Persist session token in secure terminal config
                val currentConfig = getOrInitTerminalConfig()
                saveConfigSecure(currentConfig.copy(sessionToken = body.token))
                
                val meResult = fetchCurrentUser()
                
                // Also create/bind terminal session for this merchant if terminal is registered
                try {
                    val config = getOrInitTerminalConfig()
                    if (config.isRegistered) {
                        service.createTerminalSession(
                            CreateTerminalSessionRequest(
                                terminalId = config.terminalId,
                                merchantUserId = body.userId
                            )
                        )
                    }
                } catch (_: Exception) {}

                Result.success(body)
            } else {
                // Manejar 403: terminal no registrado o clave publica no coincide
                if (response.code() == 403) {
                    val errBody = response.errorBody()?.string() ?: ""
                    if (errBody.contains("terminal_not_registered") || errBody.contains("terminal_key_mismatch")) {
                        // Marcar terminal como no registrado - el servidor no reconoce este terminal
                        val currentConfig = getOrInitTerminalConfig()
                        saveConfigSecure(currentConfig.copy(isRegistered = false, sessionToken = null))
                        apiClient.authToken = null
                        currentUser = null
                        val msg = if (errBody.contains("terminal_key_mismatch")) {
                            "La clave publica de este terminal no coincide con la registrada en el servidor. Debe registrarse nuevamente."
                        } else {
                            "Este terminal no esta registrado en el servidor. Debe registrarse nuevamente."
                        }
                        return@withContext Result.failure(Exception(msg))
                    }
                }
                val errBody = response.errorBody()?.string()
                val errorMsg = response.body()?.error ?: errBody ?: "Credenciales inválidas (Código ${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión con el nodo (${apiClient.serverUrl}): ${e.localizedMessage}"))
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        val currentConfig = getOrInitTerminalConfig()
        saveConfigSecure(currentConfig.copy(sessionToken = null))
        apiClient.authToken = null
        currentUser = null
    }

    suspend fun fetchCurrentUser(): Result<UserMeResponse> = withContext(Dispatchers.IO) {
        try {
            if (apiClient.authToken.isNullOrBlank()) {
                currentUser = null
                return@withContext Result.failure(Exception("Sin sesión activa"))
            }
            val service = apiClient.getService()
            val response = service.getMe()
            if (response.isSuccessful && response.body() != null) {
                currentUser = response.body()
                Result.success(currentUser!!)
            } else {
                if (response.code() == 401) {
                    // Token expired or invalid on server
                    val currentConfig = getOrInitTerminalConfig()
                    saveConfigSecure(currentConfig.copy(sessionToken = null))
                    apiClient.authToken = null
                    currentUser = null
                }
                val err = response.errorBody()?.string() ?: "Error obteniendo datos del usuario (${response.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            // Keep existing currentUser if network temporarily fails
            if (currentUser != null) {
                Result.success(currentUser!!)
            } else {
                Result.failure(Exception("Error al contactar al nodo: ${e.localizedMessage}"))
            }
        }
    }

    fun getCurrentUser(): UserMeResponse? = currentUser

    suspend fun getCardTypeConfig(): CardTypeConfigResponse = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val res = service.getCardTypeConfig()
            if (res.isSuccessful && res.body() != null) {
                res.body()!!
            } else {
                CardTypeConfigResponse(
                    nodeDomain = apiClient.nodeDomain,
                    cardTypeMode = "dual",
                    requireCrypto = false,
                    requireIdDocumentForUidOnly = false
                )
            }
        } catch (e: Exception) {
            CardTypeConfigResponse(
                nodeDomain = apiClient.nodeDomain,
                cardTypeMode = "dual",
                requireCrypto = false,
                requireIdDocumentForUidOnly = false
            )
        }
    }

    // --- QR PAYMENT FLOW ---
    suspend fun createQrCharge(amountCentavos: Long, description: String?): Result<CreateChargeResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val response = service.createCharge(CreateChargeRequest(amountCentavos, description))
            if (response.isSuccessful && response.body()?.chargeToken != null) {
                Result.success(response.body()!!)
            } else if (apiClient.isDemoNode) {
                // Modo Demo: generar QR simulado si el backend demo responde con error
                val demoChargeId = "DEMO-CHG-${UUID.randomUUID().toString().take(8).uppercase()}"
                val demoToken = "DEMO-TOKEN-${UUID.randomUUID().toString().take(12)}"
                val simResp = CreateChargeResponse(
                    chargeId = demoChargeId,
                    chargeToken = demoToken,
                    amount = amountCentavos,
                    status = "pending",
                    expiresIn = 180
                )
                Result.success(simResp)
            } else {
                val err = response.errorBody()?.string() ?: "Error al generar cobro QR en el nodo (${response.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            if (apiClient.isDemoNode) {
                val demoChargeId = "DEMO-CHG-${UUID.randomUUID().toString().take(8).uppercase()}"
                val demoToken = "DEMO-TOKEN-${UUID.randomUUID().toString().take(12)}"
                val simResp = CreateChargeResponse(
                    chargeId = demoChargeId,
                    chargeToken = demoToken,
                    amount = amountCentavos,
                    status = "pending",
                    expiresIn = 180
                )
                Result.success(simResp)
            } else {
                Result.failure(Exception("Error de conexión al generar cobro QR: ${e.localizedMessage}"))
            }
        }
    }

    suspend fun pollQrChargeStatus(chargeId: String): Result<ChargeStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val response = service.getChargeStatus(chargeId)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.status == "paid") {
                    // Record in local database
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = body.chargeId ?: chargeId,
                            amount = body.amount ?: 0L,
                            paymentMethod = "qr",
                            status = "approved",
                            description = body.description ?: "Cobro con Código QR",
                            receiptNumber = "QR-${chargeId.take(8).uppercase()}"
                        )
                    )
                    // Refresh balance after payment
                    fetchCurrentUser()
                }
                Result.success(body)
            } else {
                Result.success(ChargeStatusResponse(chargeId = chargeId, status = "pending"))
            }
        } catch (e: Exception) {
            Result.success(ChargeStatusResponse(chargeId = chargeId, status = "pending"))
        }
    }

    suspend fun cancelQrCharge(chargeId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.cancelCharge(chargeId)
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- TERMINAL ED25519 REGISTRATION & AUTH ---
    suspend fun registerTerminalWithToken(registrationToken: String): Result<CompleteRegistrationResponse> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val fingerprint = CryptoEngine.getDeviceFingerprint(context)
            val service = apiClient.getService()

            val req = CompleteRegistrationRequest(
                terminalId = config.terminalId,
                registrationToken = registrationToken.trim(),
                terminalPublicKey = config.terminalPublicKeyHex,
                deviceFingerprint = fingerprint
            )
            val res = service.completeRegistration(req)
            if (res.isSuccessful && res.body()?.serverPublicKey != null) {
                val body = res.body()!!
                saveConfigSecure(
                    config.copy(
                        isRegistered = true,
                        serverPublicKeyHex = body.serverPublicKey
                    )
                )
                cachedSharedKey = null
                Result.success(body)
            } else {
                val err = res.errorBody()?.string() ?: res.body()?.error ?: "Error completando registro en el nodo (Código ${res.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión al registrar terminal: ${e.localizedMessage}"))
        }
    }

    suspend fun registerTerminalWithAdminCredentials(
        adminUser: String,
        adminPass: String,
        label: String
    ): Result<CompleteRegistrationResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            // 1. Admin Login
            val loginRes = service.login(LoginRequest(adminUser.trim(), adminPass))
            if (!loginRes.isSuccessful || loginRes.body()?.token == null) {
                val err = loginRes.errorBody()?.string() ?: "Credenciales de administrador incorrectas"
                return@withContext Result.failure(Exception(err))
            }

            val adminToken = loginRes.body()!!.token!!
            val prevAuth = apiClient.authToken
            apiClient.authToken = adminToken

            val config = getOrInitTerminalConfig()
            val fingerprint = CryptoEngine.getDeviceFingerprint(context)

            // 2. Register terminal on backend to obtain registration_token
            val regReq = RegisterTerminalApiRequest(
                terminalId = config.terminalId,
                label = label.ifBlank { "POS Android" },
                terminalType = "keypad",
                location = "Móvil",
                wifiSsid = "",
                deviceFingerprint = fingerprint
            )
            val regRes = service.registerTerminal(regReq)
            if (!regRes.isSuccessful || regRes.body()?.registrationToken == null) {
                apiClient.authToken = prevAuth
                val err = regRes.errorBody()?.string() ?: regRes.body()?.error ?: "No se pudo crear el terminal en el nodo (verifique permisos de administrador)"
                return@withContext Result.failure(Exception(err))
            }

            val token = regRes.body()!!.registrationToken!!

            // 3. Complete registration with Ed25519 public key
            val compReq = CompleteRegistrationRequest(
                terminalId = config.terminalId,
                registrationToken = token,
                terminalPublicKey = config.terminalPublicKeyHex,
                deviceFingerprint = fingerprint
            )
            val compRes = service.completeRegistration(compReq)
            apiClient.authToken = prevAuth

            if (compRes.isSuccessful && compRes.body()?.serverPublicKey != null) {
                val body = compRes.body()!!
                saveConfigSecure(
                    config.copy(
                        isRegistered = true,
                        serverPublicKeyHex = body.serverPublicKey
                    )
                )
                cachedSharedKey = null
                Result.success(body)
            } else {
                val err = compRes.errorBody()?.string() ?: "Error al finalizar el intercambio criptográfico"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error al auto-registrar con administrador: ${e.localizedMessage}"))
        }
    }

    // ============================================
    // Terminal Pairing by Short Code
    // ============================================

    suspend fun initiatePairing(): Result<PairingInitiateResponse> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val fingerprint = CryptoEngine.getDeviceFingerprint(context)
            val service = apiClient.getService()

            val req = PairingInitiateRequest(
                terminalPublicKey = config.terminalPublicKeyHex,
                deviceFingerprint = fingerprint,
                terminalId = config.terminalId,
                terminalLabel = "POS Android",
                deviceModel = android.os.Build.MODEL,
                deviceManufacturer = android.os.Build.MANUFACTURER,
                androidVersion = android.os.Build.VERSION.RELEASE,
                terminalType = "android_pos"
            )
            val res = service.initiatePairing(req)
            if (res.isSuccessful && res.body()?.pairingCode != null) {
                Result.success(res.body()!!)
            } else {
                val err = res.errorBody()?.string() ?: res.body()?.error ?: "Error al iniciar emparejamiento (Código ${res.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión al iniciar emparejamiento: ${e.localizedMessage}"))
        }
    }

    suspend fun pollPairingStatus(code: String): Result<PairingStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val res = service.getPairingStatus(code)
            if (res.isSuccessful && res.body()?.status != null) {
                Result.success(res.body()!!)
            } else {
                val err = res.errorBody()?.string() ?: "Error al consultar estado del emparejamiento"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión: ${e.localizedMessage}"))
        }
    }

    suspend fun getPairingOptions(code: String): Result<PairingOptionsResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val res = service.getPairingOptions(code)
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                val err = res.errorBody()?.string() ?: "Error al obtener opciones de emparejamiento"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error de conexión al obtener opciones: ${e.localizedMessage}"))
        }
    }

    suspend fun completePairing(status: PairingStatusResponse): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            if (status.serverPublicKey != null) {
                val assignedTerminalId = if (!status.terminalId.isNullOrBlank()) status.terminalId else config.terminalId
                val updated = config.copy(
                    isRegistered = true,
                    terminalId = assignedTerminalId,
                    serverPublicKeyHex = status.serverPublicKey
                )
                saveConfigSecure(updated)
                apiClient.updateConfig(updated.serverUrl, apiClient.authToken, updated.terminalId)
                cachedSharedKey = null
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Error al guardar configuración de emparejamiento: ${e.localizedMessage}"))
        }
    }

    private suspend fun ensureSharedKey(): ByteArray = withContext(Dispatchers.IO) {
        val cached = cachedSharedKey
        if (cached != null) return@withContext cached

        val config = getOrInitTerminalConfig()
        val serverPub = config.serverPublicKeyHex ?: CryptoEngine.generateEd25519KeyPair().publicKeyHex
        val derived = CryptoEngine.deriveSharedKey(config.terminalPrivateKeyHex, serverPub)
        cachedSharedKey = derived
        derived
    }

    // --- NFC SINGLE PAYMENT ---
    suspend fun processNfcPayment(
        cardUid: String,
        isDesfire: Boolean,
        pin: String,
        amountCentavos: Long,
        idDocType: String? = null,
        idDocNumber: String? = null
    ): Result<PaymentResultDecrypted> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val serverPubKey = config.serverPublicKeyHex ?: return@withContext Result.failure(Exception("Terminal no registrado: sin clave pública del servidor"))
            val timestamp = System.currentTimeMillis() / 1000
            val nonce = CryptoEngine.generateRandomNonce(16)
            val cryptoToken = if (isDesfire) "desfire_auth_ok" else cardUid

            val decryptedPayload = SinglePaymentDecryptedPayload(
                cardUid = cardUid,
                cryptoToken = cryptoToken,
                pin = pin,
                amount = amountCentavos,
                timestamp = timestamp,
                nonce = nonce,
                idDocumentType = idDocType,
                idDocumentNumber = idDocNumber
            )

            val adapter = apiClient.moshi.adapter(SinglePaymentDecryptedPayload::class.java)
            val jsonPlain = adapter.toJson(decryptedPayload)

            val (ephemeralMsg, ephemeralSharedKey) = CryptoEngine.encryptPayloadEphemeral(
                plaintextJson = jsonPlain,
                terminalPrivateKeyHex = config.terminalPrivateKeyHex,
                serverPublicKeyHex = serverPubKey
            )

            val service = apiClient.getService()
            val request = EncryptedPaymentRequest(
                terminalId = config.terminalId,
                encryptedPayload = EphemeralMessageModel(
                    handshake = EphemeralHandshakeModel(
                        ephemeralPublicKey = ephemeralMsg.handshake.ephemeralPublicKey,
                        identitySignature = ephemeralMsg.handshake.identitySignature,
                        nonce = ephemeralMsg.handshake.nonce
                    ),
                    nonce = ephemeralMsg.nonce,
                    ciphertext = ephemeralMsg.ciphertext,
                    signature = ephemeralMsg.signature
                )
            )

            val response = service.processNfcPayment(request)
            if (response.isSuccessful && response.body()?.ciphertext != null) {
                val encResp = response.body()!!
                val plainResp = CryptoEngine.decryptResponseEphemeral(
                    encryptedPayload = EncryptedPayload(
                        nonce = encResp.nonce.orEmpty(),
                        ciphertext = encResp.ciphertext.orEmpty(),
                        signature = encResp.signature.orEmpty()
                    ),
                    ephemeralSharedKey = ephemeralSharedKey,
                    serverPublicKeyHex = config.serverPublicKeyHex
                )

                val resAdapter = apiClient.moshi.adapter(PaymentResultDecrypted::class.java)
                val result = resAdapter.fromJson(plainResp) ?: PaymentResultDecrypted(
                    status = "error",
                    message = "Respuesta del servidor inválida"
                )

                if (result.status == "approved") {
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = result.transactionId ?: UUID.randomUUID().toString(),
                            amount = amountCentavos,
                            paymentMethod = "nfc_single",
                            status = "approved",
                            cardUid = cardUid,
                            receiptNumber = "NFC-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                }
                Result.success(result)
            } else {
                if (apiClient.isDemoNode) {
                    val isMultisig3 = cardUid.contains("3SIG") || cardUid.contains("3F")
                    val isMultisig2 = cardUid.contains("MULTISIG") || cardUid.contains("2SIG") || cardUid.contains("FIRM")
                    if (isMultisig3) {
                        val sim = PaymentResultDecrypted(
                            status = "pending_multisig",
                            transactionId = "TX-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                            pendingId = "PENDING-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                            requiredSigs = 3,
                            collectedSigs = 1,
                            remainingSigs = 2,
                            message = "Cuenta multi-firma (3 Firmas requeridas). Firma 1 de 3 registrada por el servidor. Acerque la tarjeta del 2do firmante.",
                            userBalance = 250000L
                        )
                        Result.success(sim)
                    } else if (isMultisig2) {
                        val sim = PaymentResultDecrypted(
                            status = "pending_multisig",
                            transactionId = "TX-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                            pendingId = "PENDING-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                            requiredSigs = 2,
                            collectedSigs = 1,
                            remainingSigs = 1,
                            message = "Cuenta multi-firma (2 Firmas requeridas). Firma 1 de 2 registrada por el servidor. Acerque la tarjeta del 2do firmante.",
                            userBalance = 250000L
                        )
                        Result.success(sim)
                    } else {
                        val simulatedResult = PaymentResultDecrypted(
                            status = "approved",
                            transactionId = UUID.randomUUID().toString(),
                            message = "Transacción simulada aprobada (Modo Demo)",
                            userBalance = 180000L
                        )
                        transactionDao.insertTransaction(
                            TransactionEntity(
                                id = simulatedResult.transactionId!!,
                                amount = amountCentavos,
                                paymentMethod = "nfc_single",
                                status = "approved",
                                cardUid = cardUid,
                                receiptNumber = "NFC-${UUID.randomUUID().toString().take(8).uppercase()}"
                            )
                        )
                        Result.success(simulatedResult)
                    }
                } else {
                    val errorBodyStr = response.errorBody()?.string().orEmpty()
                    val serverMsg = try {
                        val jsonObj = org.json.JSONObject(errorBodyStr)
                        jsonObj.optString("error", jsonObj.optString("message", jsonObj.optString("detail", "Error del servidor (HTTP ${response.code()})")))
                    } catch (e: Exception) {
                        if (errorBodyStr.isNotBlank()) errorBodyStr else "Error al procesar cobro en el nodo (HTTP ${response.code()})"
                    }
                    Result.failure(Exception(serverMsg))
                }
            }
        } catch (e: Exception) {
            if (apiClient.isDemoNode) {
                val isMultisig3 = cardUid.contains("3SIG") || cardUid.contains("3F")
                val isMultisig2 = cardUid.contains("MULTISIG") || cardUid.contains("2SIG") || cardUid.contains("FIRM")
                if (isMultisig3) {
                    val sim = PaymentResultDecrypted(
                        status = "pending_multisig",
                        transactionId = "TX-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                        pendingId = "PENDING-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                        requiredSigs = 3,
                        collectedSigs = 1,
                        remainingSigs = 2,
                        message = "Cuenta multi-firma (3 Firmas requeridas). Firma 1 de 3 registrada por el servidor. Acerque la tarjeta del 2do firmante.",
                        userBalance = 250000L
                    )
                    Result.success(sim)
                } else if (isMultisig2) {
                    val sim = PaymentResultDecrypted(
                        status = "pending_multisig",
                        transactionId = "TX-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                        pendingId = "PENDING-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                        requiredSigs = 2,
                        collectedSigs = 1,
                        remainingSigs = 1,
                        message = "Cuenta multi-firma (2 Firmas requeridas). Firma 1 de 2 registrada por el servidor. Acerque la tarjeta del 2do firmante.",
                        userBalance = 250000L
                    )
                    Result.success(sim)
                } else {
                    val simulatedResult = PaymentResultDecrypted(
                        status = "approved",
                        transactionId = UUID.randomUUID().toString(),
                        message = "Transacción simulada aprobada (Modo Demo)",
                        userBalance = 180000L
                    )
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = simulatedResult.transactionId!!,
                            amount = amountCentavos,
                            paymentMethod = "nfc_single",
                            status = "approved",
                            cardUid = cardUid,
                            receiptNumber = "NFC-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                    Result.success(simulatedResult)
                }
            } else {
                Result.failure(Exception("Error al procesar cobro NFC: ${e.localizedMessage}"))
            }
        } finally {
            // Memory hygiene
            CryptoEngine.zeroize()
        }
    }

    // --- NFC COMMUNITY (MULTI-VENDOR) PAYMENT ---
    suspend fun processCommunityPayment(
        sellerCardUid: String,
        sellerPin: String,
        buyerCardUid: String,
        buyerPin: String,
        amountCentavos: Long,
        buyerIdDocType: String? = null,
        buyerIdDocNumber: String? = null
    ): Result<PaymentResultDecrypted> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val serverPubKey = config.serverPublicKeyHex ?: return@withContext Result.failure(Exception("Terminal no registrado: sin clave pública del servidor"))
            val timestamp = System.currentTimeMillis() / 1000
            val nonce = CryptoEngine.generateRandomNonce(16)

            val decryptedPayload = CommunityPaymentDecryptedPayload(
                sellerCardUid = sellerCardUid,
                sellerCryptoToken = "desfire_auth_ok",
                sellerPin = sellerPin,
                buyerCardUid = buyerCardUid,
                buyerCryptoToken = "uid_only_token",
                buyerPin = buyerPin,
                amount = amountCentavos,
                timestamp = timestamp,
                nonce = nonce,
                buyerIdDocumentType = buyerIdDocType,
                buyerIdDocumentNumber = buyerIdDocNumber
            )

            val adapter = apiClient.moshi.adapter(CommunityPaymentDecryptedPayload::class.java)
            val jsonPlain = adapter.toJson(decryptedPayload)

            val (ephemeralMsg, ephemeralSharedKey) = CryptoEngine.encryptPayloadEphemeral(
                plaintextJson = jsonPlain,
                terminalPrivateKeyHex = config.terminalPrivateKeyHex,
                serverPublicKeyHex = serverPubKey
            )

            val service = apiClient.getService()
            val request = EncryptedPaymentRequest(
                terminalId = config.terminalId,
                encryptedPayload = EphemeralMessageModel(
                    handshake = EphemeralHandshakeModel(
                        ephemeralPublicKey = ephemeralMsg.handshake.ephemeralPublicKey,
                        identitySignature = ephemeralMsg.handshake.identitySignature,
                        nonce = ephemeralMsg.handshake.nonce
                    ),
                    nonce = ephemeralMsg.nonce,
                    ciphertext = ephemeralMsg.ciphertext,
                    signature = ephemeralMsg.signature
                )
            )

            val response = service.processCommunityPayment(request)
            if (response.isSuccessful && response.body()?.ciphertext != null) {
                val encResp = response.body()!!
                val plainResp = CryptoEngine.decryptResponseEphemeral(
                    encryptedPayload = EncryptedPayload(
                        nonce = encResp.nonce.orEmpty(),
                        ciphertext = encResp.ciphertext.orEmpty(),
                        signature = encResp.signature.orEmpty()
                    ),
                    ephemeralSharedKey = ephemeralSharedKey,
                    serverPublicKeyHex = config.serverPublicKeyHex
                )

                val resAdapter = apiClient.moshi.adapter(PaymentResultDecrypted::class.java)
                val result = resAdapter.fromJson(plainResp) ?: PaymentResultDecrypted(
                    status = "error",
                    message = "Respuesta inválida del servidor"
                )

                if (result.status == "approved") {
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = result.transactionId ?: UUID.randomUUID().toString(),
                            amount = amountCentavos,
                            paymentMethod = "nfc_community",
                            status = "approved",
                            cardUid = buyerCardUid,
                            vendorName = "Vendedor $sellerCardUid",
                            receiptNumber = "COM-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                }
                Result.success(result)
            } else {
                if (apiClient.isDemoNode) {
                    val isMultisig3 = buyerCardUid.contains("3SIG") || buyerCardUid.contains("3F")
                    val isMultisig2 = buyerCardUid.contains("MULTISIG") || buyerCardUid.contains("2SIG") || buyerCardUid.contains("2F") || buyerCardUid.contains("FIRM")
                    if (isMultisig3) {
                        val sim = PaymentResultDecrypted(
                            status = "pending_multisig",
                            transactionId = "TX-MV-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                            pendingId = "PENDING-MV-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                            requiredSigs = 3,
                            collectedSigs = 1,
                            remainingSigs = 2,
                            message = "Cuenta multi-firma (3 Firmas requeridas). Firma 1 de 3 validada para la venta multi-vendedor. Acerque la tarjeta del 2do firmante.",
                            userBalance = 250000L
                        )
                        Result.success(sim)
                    } else if (isMultisig2) {
                        val sim = PaymentResultDecrypted(
                            status = "pending_multisig",
                            transactionId = "TX-MV-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                            pendingId = "PENDING-MV-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                            requiredSigs = 2,
                            collectedSigs = 1,
                            remainingSigs = 1,
                            message = "Cuenta multi-firma (2 Firmas requeridas). Firma 1 de 2 validada para la venta multi-vendedor. Acerque la tarjeta del 2do firmante.",
                            userBalance = 250000L
                        )
                        Result.success(sim)
                    } else {
                        val simulated = PaymentResultDecrypted(
                            status = "approved",
                            transactionId = UUID.randomUUID().toString(),
                            message = "Transacción comunitaria simulada aprobada (Modo Demo)",
                            userBalance = 150000L
                        )
                        transactionDao.insertTransaction(
                            TransactionEntity(
                                id = simulated.transactionId!!,
                                amount = amountCentavos,
                                paymentMethod = "nfc_community",
                                status = "approved",
                                cardUid = buyerCardUid,
                                vendorName = "Vendedor $sellerCardUid",
                                receiptNumber = "COM-${UUID.randomUUID().toString().take(8).uppercase()}"
                            )
                        )
                        Result.success(simulated)
                    }
                } else {
                    val errorBodyStr = response.errorBody()?.string().orEmpty()
                    val serverMsg = try {
                        val jsonObj = org.json.JSONObject(errorBodyStr)
                        jsonObj.optString("error", jsonObj.optString("message", jsonObj.optString("detail", "Error del servidor (HTTP ${response.code()})")))
                    } catch (e: Exception) {
                        if (errorBodyStr.isNotBlank()) errorBodyStr else "Error en cobro multi-vendedor (HTTP ${response.code()})"
                    }
                    Result.failure(Exception(serverMsg))
                }
            }
        } catch (e: Exception) {
            if (apiClient.isDemoNode) {
                val isMultisig3 = buyerCardUid.contains("3SIG") || buyerCardUid.contains("3F")
                val isMultisig2 = buyerCardUid.contains("MULTISIG") || buyerCardUid.contains("2SIG") || buyerCardUid.contains("2F") || buyerCardUid.contains("FIRM")
                if (isMultisig3) {
                    val sim = PaymentResultDecrypted(
                        status = "pending_multisig",
                        transactionId = "TX-MV-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                        pendingId = "PENDING-MV-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
                        requiredSigs = 3,
                        collectedSigs = 1,
                        remainingSigs = 2,
                        message = "Cuenta multi-firma (3 Firmas requeridas). Firma 1 de 3 validada para la venta multi-vendedor. Acerque la tarjeta del 2do firmante.",
                        userBalance = 250000L
                    )
                    Result.success(sim)
                } else if (isMultisig2) {
                    val sim = PaymentResultDecrypted(
                        status = "pending_multisig",
                        transactionId = "TX-MV-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                        pendingId = "PENDING-MV-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
                        requiredSigs = 2,
                        collectedSigs = 1,
                        remainingSigs = 1,
                        message = "Cuenta multi-firma (2 Firmas requeridas). Firma 1 de 2 validada para la venta multi-vendedor. Acerque la tarjeta del 2do firmante.",
                        userBalance = 250000L
                    )
                    Result.success(sim)
                } else {
                    val simulated = PaymentResultDecrypted(
                        status = "approved",
                        transactionId = UUID.randomUUID().toString(),
                        message = "Transacción comunitaria simulada aprobada (Modo Demo)",
                        userBalance = 150000L
                    )
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = simulated.transactionId!!,
                            amount = amountCentavos,
                            paymentMethod = "nfc_community",
                            status = "approved",
                            cardUid = buyerCardUid,
                            vendorName = "Vendedor $sellerCardUid",
                            receiptNumber = "COM-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                    Result.success(simulated)
                }
            } else {
                Result.failure(Exception("Error en cobro multi-vendedor: ${e.localizedMessage}"))
            }
        }
    }

    // --- MULTI-SIG SIGNING VIA NFC TERMINAL ---
    suspend fun signMultisigNfc(
        pendingPaymentId: String,
        cardUid: String,
        pin: String,
        idDocType: String? = null,
        idDocNumber: String? = null
    ): Result<PaymentResultDecrypted> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val serverPubKey = config.serverPublicKeyHex ?: return@withContext Result.failure(Exception("Terminal no registrado: sin clave pública del servidor"))
            val timestamp = System.currentTimeMillis() / 1000
            val nonce = CryptoEngine.generateRandomNonce(16)

            val decrypted = MultisigSignDecryptedPayload(
                pendingPaymentId = pendingPaymentId,
                cardUid = cardUid,
                pin = pin,
                timestamp = timestamp,
                nonce = nonce,
                idDocumentType = idDocType,
                idDocumentNumber = idDocNumber
            )

            val adapter = apiClient.moshi.adapter(MultisigSignDecryptedPayload::class.java)
            val jsonPlain = adapter.toJson(decrypted)

            val (ephemeralMsg, ephemeralSharedKey) = CryptoEngine.encryptPayloadEphemeral(
                plaintextJson = jsonPlain,
                terminalPrivateKeyHex = config.terminalPrivateKeyHex,
                serverPublicKeyHex = serverPubKey
            )

            val service = apiClient.getService()
            val request = EncryptedPaymentRequest(
                terminalId = config.terminalId,
                encryptedPayload = EphemeralMessageModel(
                    handshake = EphemeralHandshakeModel(
                        ephemeralPublicKey = ephemeralMsg.handshake.ephemeralPublicKey,
                        identitySignature = ephemeralMsg.handshake.identitySignature,
                        nonce = ephemeralMsg.handshake.nonce
                    ),
                    nonce = ephemeralMsg.nonce,
                    ciphertext = ephemeralMsg.ciphertext,
                    signature = ephemeralMsg.signature
                )
            )

            val response = service.signMultisigNfcPayment(request)
            if (response.isSuccessful && response.body()?.ciphertext != null) {
                val encResp = response.body()!!
                val plainResp = CryptoEngine.decryptResponseEphemeral(
                    encryptedPayload = EncryptedPayload(
                        nonce = encResp.nonce.orEmpty(),
                        ciphertext = encResp.ciphertext.orEmpty(),
                        signature = encResp.signature.orEmpty()
                    ),
                    ephemeralSharedKey = ephemeralSharedKey,
                    serverPublicKeyHex = config.serverPublicKeyHex
                )
                val resAdapter = apiClient.moshi.adapter(PaymentResultDecrypted::class.java)
                val result = resAdapter.fromJson(plainResp) ?: PaymentResultDecrypted(
                    status = "approved",
                    message = "Firma registrada"
                )
                if (result.status == "approved" || result.remainingSigs == 0) {
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = result.transactionId ?: pendingPaymentId,
                            amount = 0L,
                            paymentMethod = "nfc_multisig",
                            status = "approved",
                            cardUid = cardUid,
                            receiptNumber = "MS-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                }
                Result.success(result)
            } else {
                if (apiClient.isDemoNode) {
                    // Modo Demo: simular respuesta de firma multisig
                    val is3SigsFlow = pendingPaymentId.contains("MS3") || cardUid.contains("3SIG") || cardUid.contains("3F")
                    val isFirm2Of3 = is3SigsFlow && (cardUid.contains("2") || cardUid.contains("FIRM2") || cardUid.contains("SIG2"))
                    if (isFirm2Of3) {
                        Result.success(
                            PaymentResultDecrypted(
                                status = "pending_multisig",
                                transactionId = pendingPaymentId,
                                pendingId = pendingPaymentId,
                                requiredSigs = 3,
                                collectedSigs = 2,
                                remainingSigs = 1,
                                message = "Firma 2 de 3 validada por el servidor. Acerque la tarjeta del 3er firmante."
                            )
                        )
                    } else {
                        val finalRes = PaymentResultDecrypted(
                            status = "approved",
                            transactionId = pendingPaymentId,
                            message = "¡Todas las firmas requeridas han sido validadas por el servidor! Pago multi-firma aprobado con éxito.",
                            remainingSigs = 0,
                            requiredSigs = if (is3SigsFlow) 3 else 2,
                            collectedSigs = if (is3SigsFlow) 3 else 2
                        )
                        transactionDao.insertTransaction(
                            TransactionEntity(
                                id = pendingPaymentId,
                                amount = 0L,
                                paymentMethod = "nfc_multisig",
                                status = "approved",
                                cardUid = cardUid,
                                receiptNumber = "MS-${UUID.randomUUID().toString().take(8).uppercase()}"
                            )
                        )
                        Result.success(finalRes)
                    }
                } else {
                    val err = response.errorBody()?.string() ?: "Error al firmar pago multi-firma (HTTP ${response.code()})"
                    Result.failure(Exception(err))
                }
            }
        } catch (e: Exception) {
            if (apiClient.isDemoNode) {
                // Modo Demo: simular respuesta de firma multisig en caso de error de red
                val is3SigsFlow = pendingPaymentId.contains("MS3") || cardUid.contains("3SIG") || cardUid.contains("3F")
                val isFirm2Of3 = is3SigsFlow && (cardUid.contains("2") || cardUid.contains("FIRM2") || cardUid.contains("SIG2"))
                if (isFirm2Of3) {
                    Result.success(
                        PaymentResultDecrypted(
                            status = "pending_multisig",
                            transactionId = pendingPaymentId,
                            pendingId = pendingPaymentId,
                            requiredSigs = 3,
                            collectedSigs = 2,
                            remainingSigs = 1,
                            message = "Firma 2 de 3 validada por el servidor. Acerque la tarjeta del 3er firmante."
                        )
                    )
                } else {
                    val finalRes = PaymentResultDecrypted(
                        status = "approved",
                        transactionId = pendingPaymentId,
                        message = "¡Todas las firmas requeridas han sido validadas por el servidor! Pago multi-firma aprobado con éxito.",
                        remainingSigs = 0,
                        requiredSigs = if (is3SigsFlow) 3 else 2,
                        collectedSigs = if (is3SigsFlow) 3 else 2
                    )
                    transactionDao.insertTransaction(
                        TransactionEntity(
                            id = pendingPaymentId,
                            amount = 0L,
                            paymentMethod = "nfc_multisig",
                            status = "approved",
                            cardUid = cardUid,
                            receiptNumber = "MS-${UUID.randomUUID().toString().take(8).uppercase()}"
                        )
                    )
                    Result.success(finalRes)
                }
            } else {
                Result.failure(Exception("Error de conexión al firmar pago multi-firma: ${e.localizedMessage}"))
            }
        }
    }

    suspend fun getMultisigStatus(pendingId: String): Result<MultisigStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val res = service.getMultisigPaymentStatus(pendingId)
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                if (apiClient.isDemoNode) {
                    // Modo Demo: simular estado pendiente sin degradar contadores locales
                    val is3Sigs = pendingId.contains("MS3")
                    Result.success(
                        MultisigStatusResponse(
                            id = pendingId,
                            status = "pending",
                            requiredSignatures = if (is3Sigs) 3 else 2,
                            collectedCount = null,
                            remainingSigs = null,
                            remainingSeconds = 480L
                        )
                    )
                } else {
                    Result.failure(Exception("Error al consultar estado multi-firma (HTTP ${res.code()})"))
                }
            }
        } catch (e: Exception) {
            if (apiClient.isDemoNode) {
                // Modo Demo: simular estado pendiente en caso de error de red
                val is3Sigs = pendingId.contains("MS3")
                Result.success(
                    MultisigStatusResponse(
                        id = pendingId,
                        status = "pending",
                        requiredSignatures = if (is3Sigs) 3 else 2,
                        collectedCount = null,
                        remainingSigs = null,
                        remainingSeconds = 480L
                    )
                )
            } else {
                Result.failure(Exception("Error de conexión al consultar estado multi-firma: ${e.localizedMessage}"))
            }
        }
    }

    // --- SHIFT MANAGEMENT ---
    suspend fun openShift(openingamountCentavos: Long, notes: String? = null): Result<ShiftEntity> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val shiftId = UUID.randomUUID().toString()
            val shift = ShiftEntity(
                id = shiftId,
                status = "open",
                openedAt = System.currentTimeMillis(),
                openingAmount = openingamountCentavos,
                totalSales = 0L,
                transactionsCount = 0,
                notes = notes
            )
            shiftDao.insertShift(shift)

            try {
                apiClient.getService().openShift(config.terminalId, OpenShiftRequest(openingamountCentavos, notes))
            } catch (e: Exception) {}

            Result.success(shift)
        } catch (e: Exception) {
            Result.failure(Exception("Error al abrir turno: ${e.localizedMessage}"))
        }
    }

    suspend fun closeShift(closingamountCentavos: Long? = null, notes: String? = null): Result<ShiftEntity> = withContext(Dispatchers.IO) {
        try {
            val current = shiftDao.getOpenShift()
            if (current == null) return@withContext Result.failure(Exception("No hay turno abierto"))

            val updated = current.copy(
                status = "closed",
                closedAt = System.currentTimeMillis(),
                closingAmount = closingamountCentavos,
                notes = notes
            )
            shiftDao.updateShift(updated)

            val config = getOrInitTerminalConfig()
            try {
                apiClient.getService().closeShift(config.terminalId, CloseShiftRequest(closingamountCentavos, notes))
            } catch (e: Exception) {}

            Result.success(updated)
        } catch (e: Exception) {
            Result.failure(Exception("Error al cerrar turno: ${e.localizedMessage}"))
        }
    }

    // ============================================
    // Heartbeat / Verificacion de estado
    // ============================================

    suspend fun heartbeat(): Result<HeartbeatResponse> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val service = apiClient.getService()
            val response = service.terminalHeartbeat(mapOf("terminal_id" to config.terminalId))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else if (response.code() == 404) {
                // Solo si el servidor responde 404 explicitamente, considerar no registrado
                Result.success(HeartbeatResponse(status = "not_found", active = false, registered = false, notFound = true))
            } else {
                // Errores 500 u otros codigos son problemas temporales del servidor, no desregistrar
                Result.failure(Exception("Error en heartbeat del servidor (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            // Error de red: no cambiar estado (puede ser temporal)
            Result.failure(Exception("Error de conexión en heartbeat: ${e.localizedMessage}"))
        }
    }

    /**
     * checkRegistrationByKey consulta al servidor si la clave publica de este
     * terminal ya esta registrada. Esto permite al POS descubrir que fue
     * aprobado incluso si el polling del emparejamiento expiro antes de
     * recibir la respuesta "approved".
     *
     * Si el servidor confirma que esta registrado, guarda el terminal_id y
     * server_public_key localmente y retorna true.
     */
    suspend fun checkRegistrationByKey(): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val config = getOrInitTerminalConfig()
            val service = apiClient.getService()
            val response = service.lookupTerminal(
                TerminalLookupRequest(terminalPublicKey = config.terminalPublicKeyHex)
            )
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.registered && body.serverPublicKey != null) {
                    // El servidor confirma que este terminal esta registrado.
                    // Guardar terminal_id y server_public_key localmente.
                    val assignedTerminalId = body.terminalId ?: config.terminalId
                    val updated = config.copy(
                        isRegistered = true,
                        terminalId = assignedTerminalId,
                        serverPublicKeyHex = body.serverPublicKey
                    )
                    saveConfigSecure(updated)
                    apiClient.updateConfig(updated.serverUrl, apiClient.authToken, updated.terminalId)
                    cachedSharedKey = null
                    Result.success(true)
                } else {
                    Result.success(false)
                }
            } else {
                Result.success(false)
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error al verificar registro: ${e.localizedMessage}"))
        }
    }

    // ============================================
    // Shift PIN management
    // ============================================

    suspend fun setShiftPin(pin: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val hash = hashPin(pin)
            shiftPinDao.savePin(ShiftPinEntity(id = 1, pinHash = hash))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Error al guardar PIN: ${e.localizedMessage}"))
        }
    }

    suspend fun verifyShiftPin(pin: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val stored = shiftPinDao.getPin()
            if (stored == null) {
                Result.success(false) // No PIN set
            } else {
                val hash = hashPin(pin)
                Result.success(hash == stored.pinHash)
            }
        } catch (e: Exception) {
            Result.failure(Exception("Error al verificar PIN: ${e.localizedMessage}"))
        }
    }

    suspend fun hasShiftPin(): Boolean = withContext(Dispatchers.IO) {
        shiftPinDao.getPin() != null
    }

    private fun hashPin(pin: String): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        val salt = "POS_SHIFT_PIN_SALT"
        val digest = md.digest("$salt$pin".toByteArray(Charsets.UTF_8))
        return digest.toHex()
    }
}
