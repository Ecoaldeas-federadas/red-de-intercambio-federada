package com.example.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface PosApiService {

    // --- Authentication ---
    @POST("auth/login/password")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @GET("auth/me")
    suspend fun getMe(): Response<UserMeResponse>

    // --- POS QR Charges ---
    @POST("pos/charge")
    suspend fun createCharge(@Body request: CreateChargeRequest): Response<CreateChargeResponse>

    @GET("pos/charge/{id}/status")
    suspend fun getChargeStatus(@Path("id") chargeId: String): Response<ChargeStatusResponse>

    @GET("pos/charge/{token}/info")
    suspend fun getChargeInfo(@Path("token") chargeToken: String): Response<ChargeStatusResponse>

    @POST("pos/charge/{id}/cancel")
    suspend fun cancelCharge(@Path("id") chargeId: String): Response<GenericStatusResponse>

    // --- Terminal Registration & Auth (Ed25519) ---
    @POST("nfc/terminal/register")
    suspend fun registerTerminal(@Body request: RegisterTerminalApiRequest): Response<RegisterTerminalApiResponse>

    @POST("nfc/terminal/complete-registration")
    suspend fun completeRegistration(@Body request: CompleteRegistrationRequest): Response<CompleteRegistrationResponse>

    // --- Terminal Pairing by Short Code (no auth required) ---
    @POST("nfc/terminal/pair/initiate")
    suspend fun initiatePairing(@Body request: PairingInitiateRequest): Response<PairingInitiateResponse>

    @GET("nfc/terminal/pair/{code}/status")
    suspend fun getPairingStatus(@Path("code") code: String): Response<PairingStatusResponse>

    @GET("nfc/terminal/pair/{code}/options")
    suspend fun getPairingOptions(@Path("code") code: String): Response<PairingOptionsResponse>

    @POST("nfc/terminal/pair/{code}/approve")
    suspend fun approvePairing(
        @Path("code") code: String,
        @Body request: PairingApproveRequest
    ): Response<GenericStatusResponse>

    @POST("nfc/terminal/auth")
    suspend fun terminalAuth(@Body request: TerminalAuthRequest): Response<TerminalAuthResponse>

    @POST("nfc/terminal/heartbeat")
    suspend fun terminalHeartbeat(@Body body: Map<String, String>): Response<HeartbeatResponse>

    @GET("nfc/terminal/server-pubkey")
    suspend fun getServerPubKey(): Response<ServerPubKeyResponse>

    @POST("nfc/terminal/lookup")
    suspend fun lookupTerminal(@Body request: TerminalLookupRequest): Response<TerminalLookupResponse>

    @POST("nfc/terminal/session")
    suspend fun createTerminalSession(@Body request: CreateTerminalSessionRequest): Response<TerminalSessionResponse>

    @PUT("nfc/terminal/session/amount")
    suspend fun setSessionAmount(@Body request: SetSessionAmountRequest): Response<TerminalSessionResponse>

    // --- NFC Payments (Encrypted) ---
    @POST("nfc/terminal/payment")
    suspend fun processNfcPayment(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/payment/community")
    suspend fun processCommunityPayment(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/payment/multisig-sign")
    suspend fun signMultisigNfcPayment(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @GET("nfc/terminal/payment/multisig/{pendingId}/status")
    suspend fun getMultisigPaymentStatus(@Path("pendingId") pendingId: String): Response<MultisigStatusResponse>

    // --- MIFARE Classic Dynamic Certificates (Encrypted) ---
    @POST("nfc/terminal/classic/pre-auth")
    suspend fun classicPreAuth(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/classic/pre-auth-document")
    suspend fun classicPreAuthWithDocument(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/classic/confirm")
    suspend fun classicConfirm(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/user-lookup")
    suspend fun userLookup(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/auto-renew")
    suspend fun autoRenewKeys(@Body request: AutoRenewRequest): Response<AutoRenewResponse>

    // --- Multi-Sig Web/App (JWT) ---
    @GET("multisig/payments")
    suspend fun listPendingMultisigPayments(): Response<List<MultisigStatusResponse>>

    // --- Shifts & My Terminals ---
    @GET("nfc/my-terminals")
    suspend fun listMyTerminals(): Response<List<TerminalItem>>

    @GET("nfc/my-terminals/{id}/shift")
    suspend fun getActiveShift(@Path("id") terminalId: String): Response<ActiveShiftResponse>

    @POST("nfc/my-terminals/{id}/shift")
    suspend fun openShift(
        @Path("id") terminalId: String,
        @Body request: OpenShiftRequest
    ): Response<ShiftResponse>

    @POST("nfc/my-terminals/{id}/shift/close")
    suspend fun closeShift(
        @Path("id") terminalId: String,
        @Body request: CloseShiftRequest
    ): Response<ShiftResponse>

    @POST("nfc/my-terminals/{id}/shift/sync-close")
    suspend fun syncOfflineShiftClose(
        @Path("id") terminalId: String,
        @Body request: Map<String, Any?>
    ): Response<ShiftResponse>

    @POST("nfc/my-terminals/{id}/shift-pin/verify")
    suspend fun verifyShiftPin(
        @Path("id") terminalId: String,
        @Body request: VerifyShiftPinRequest
    ): Response<VerifyShiftPinResponse>

    @GET("nfc/my-terminals/{id}/shift-pin/configured")
    suspend fun getShiftPinConfigured(@Path("id") terminalId: String): Response<ShiftPinConfiguredResponse>

    @GET("nfc/my-terminals/{id}/shifts")
    suspend fun listShifts(
        @Path("id") terminalId: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null
    ): Response<List<ShiftHistoryItem>>

    // --- Card Type Config ---
    @GET("nfc/card-type/config")
    suspend fun getCardTypeConfig(): Response<CardTypeConfigResponse>

    // --- Card Management ---
    @GET("nfc/cards")
    suspend fun listCards(@Query("user_id") userId: String? = null): Response<List<CardItem>>

    @POST("nfc/cards/issue")
    suspend fun issueCard(@Body request: IssueCardRequest): Response<CardItem>

    @POST("nfc/cards/provision-classic")
    suspend fun provisionClassicCard(@Body request: ProvisionClassicRequest): Response<ProvisionClassicResponse>

    @POST("nfc/cards/provision-ntag215")
    suspend fun provisionNTAG215Card(@Body request: ProvisionNTAG215Request): Response<ProvisionNTAG215Response>

    @POST("nfc/cards/provision-ultralight-c")
    suspend fun provisionUltralightCCard(@Body request: ProvisionUltralightCRequest): Response<ProvisionUltralightCResponse>

    // --- NTAG215 Dynamic Certificates (Encrypted) ---
    @POST("nfc/terminal/ntag215/pre-auth")
    suspend fun ntag215PreAuth(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/ntag215/pre-auth-document")
    suspend fun ntag215PreAuthWithDocument(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/ntag215/confirm")
    suspend fun ntag215Confirm(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    // --- Ultralight C Dynamic Certificates (Encrypted) ---
    @POST("nfc/terminal/ultralight-c/pre-auth")
    suspend fun ultralightCPreAuth(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/ultralight-c/pre-auth-document")
    suspend fun ultralightCPreAuthWithDocument(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    @POST("nfc/terminal/ultralight-c/confirm")
    suspend fun ultralightCConfirm(@Body request: EncryptedPaymentRequest): Response<EncryptedPaymentResponse>

    // --- Card Types Registry (sistema modular) ---
    @GET("nfc/card-types")
    suspend fun listCardTypes(): Response<List<CardTypeManifest>>

    @GET("nfc/cards/pending-initialization")
    suspend fun getPendingInitializationCards(): Response<PendingCardResponse>

    @POST("nfc/cards/{uid}/confirm-initialization")
    suspend fun confirmCardInitialization(@Path("uid") cardUid: String): Response<ConfirmInitResponse>

    @PUT("nfc/cards/pin")
    suspend fun changePin(@Body request: ChangePinRequest): Response<GenericStatusResponse>

    @PUT("nfc/cards/{uid}/pin/reset")
    suspend fun resetPin(
        @Path("uid") cardUid: String,
        @Body request: ResetPinRequest
    ): Response<GenericStatusResponse>

    @DELETE("nfc/cards/{uid}")
    suspend fun deactivateCard(@Path("uid") cardUid: String): Response<GenericStatusResponse>

    // --- Transactions List ---
    @GET("nfc/transactions")
    suspend fun listNfcTransactions(@Query("limit") limit: Int = 50): Response<List<TransactionApiItem>>
}
