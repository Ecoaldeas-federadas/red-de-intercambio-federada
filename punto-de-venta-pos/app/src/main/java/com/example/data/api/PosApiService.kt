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

    @POST("nfc/terminal/auth")
    suspend fun terminalAuth(@Body request: TerminalAuthRequest): Response<TerminalAuthResponse>

    @POST("nfc/terminal/heartbeat")
    suspend fun terminalHeartbeat(@Body body: Map<String, String>): Response<HeartbeatResponse>

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

    // --- Multi-Sig Web/App (JWT) ---
    @GET("multisig/payments")
    suspend fun listPendingMultisigPayments(): Response<List<MultisigStatusResponse>>

    // --- Shifts & My Terminals ---
    @GET("nfc/my-terminals")
    suspend fun listMyTerminals(): Response<List<TerminalItem>>

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

    // --- Card Type Config ---
    @GET("nfc/card-type/config")
    suspend fun getCardTypeConfig(): Response<CardTypeConfigResponse>

    // --- Card Management ---
    @GET("nfc/cards")
    suspend fun listCards(@Query("user_id") userId: String? = null): Response<List<CardItem>>

    @POST("nfc/cards/issue")
    suspend fun issueCard(@Body request: IssueCardRequest): Response<CardItem>

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
