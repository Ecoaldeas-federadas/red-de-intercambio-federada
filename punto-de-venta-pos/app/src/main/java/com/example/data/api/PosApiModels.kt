package com.example.data.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "username") val username: String,
    @Json(name = "password") val password: String
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    @Json(name = "token") val token: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "node") val node: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class UserMeResponse(
    @Json(name = "id") val id: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "node_domain") val nodeDomain: String? = null,
    @Json(name = "account_type") val accountType: String? = "individual",
    @Json(name = "balance") val balance: Long? = 0L,
    @Json(name = "national_id") val nationalId: String? = null,
    @Json(name = "national_id_type") val nationalIdType: String? = null,
    @Json(name = "required_signatures") val requiredSignatures: Int? = 1,
    @Json(name = "permissions") val permissions: List<String>? = emptyList()
)

@JsonClass(generateAdapter = true)
data class CreateChargeRequest(
    @Json(name = "amount") val amount: Long,
    @Json(name = "description") val description: String? = null
)

@JsonClass(generateAdapter = true)
data class QrSignatureInfo(
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "signer_name") val signerName: String? = null,
    @Json(name = "signed_at") val signedAt: String? = null,
    @Json(name = "status") val status: String? = "signed"
)

@JsonClass(generateAdapter = true)
data class CreateChargeResponse(
    @Json(name = "charge_id") val chargeId: String? = null,
    @Json(name = "charge_token") val chargeToken: String? = null,
    @Json(name = "amount") val amount: Long? = 0L,
    @Json(name = "status") val status: String? = "pending",
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "expires_in") val expiresIn: Int? = 180,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class ChargeStatusResponse(
    @Json(name = "charge_id") val chargeId: String? = null,
    @Json(name = "amount") val amount: Long? = 0L,
    @Json(name = "status") val status: String? = "pending",
    @Json(name = "payment_method") val paymentMethod: String? = null,
    @Json(name = "paid_at") val paidAt: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "merchant_name") val merchantName: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "expires_in") val expiresIn: Int? = null,
    @Json(name = "remaining_seconds") val remainingSeconds: Long? = null,
    @Json(name = "payer_id") val payerId: String? = null,
    @Json(name = "payer_name") val payerName: String? = null,
    @Json(name = "required_signatures") val requiredSignatures: Int? = 1,
    @Json(name = "collected_signatures") val collectedSignatures: Int? = 0,
    @Json(name = "signatures_count") val signaturesCount: Int? = null,
    @Json(name = "signatures") val signatures: List<QrSignatureInfo>? = null
)

@JsonClass(generateAdapter = true)
data class GenericStatusResponse(
    @Json(name = "status") val status: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class HeartbeatResponse(
    @Json(name = "status") val status: String? = null,
    @Json(name = "active") val active: Boolean? = null,
    @Json(name = "registered") val registered: Boolean? = null,
    @Json(name = "not_found") val notFound: Boolean? = null,
    @Json(name = "signature") val signature: String? = null
)

@JsonClass(generateAdapter = true)
data class RegisterTerminalApiRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "label") val label: String,
    @Json(name = "terminal_type") val terminalType: String = "keypad",
    @Json(name = "location") val location: String = "POS Móvil",
    @Json(name = "wifi_ssid") val wifiSsid: String = "",
    @Json(name = "device_fingerprint") val deviceFingerprint: String
)

@JsonClass(generateAdapter = true)
data class RegisterTerminalApiResponse(
    @Json(name = "terminal") val terminal: TerminalItem? = null,
    @Json(name = "registration_token") val registrationToken: String? = null,
    @Json(name = "server_url") val serverUrl: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CompleteRegistrationRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "registration_token") val registrationToken: String,
    @Json(name = "terminal_public_key") val terminalPublicKey: String,
    @Json(name = "device_fingerprint") val deviceFingerprint: String
)

@JsonClass(generateAdapter = true)
data class CompleteRegistrationResponse(
    @Json(name = "server_public_key") val serverPublicKey: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class TerminalAuthRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "signature") val signature: String,
    @Json(name = "nonce") val nonce: String,
    @Json(name = "device_fingerprint") val deviceFingerprint: String
)

@JsonClass(generateAdapter = true)
data class FormatSettings(
    @Json(name = "locale") val locale: String? = null,
    @Json(name = "number_locale") val numberLocale: String? = null,
    @Json(name = "date_format") val dateFormat: String? = null,
    @Json(name = "time_format") val timeFormat: String? = null,
    @Json(name = "first_day_of_week") val firstDayOfWeek: Int? = null,
    @Json(name = "timezone") val timezone: String? = null
)

@JsonClass(generateAdapter = true)
data class TerminalAuthResponse(
    @Json(name = "session_token") val sessionToken: String? = null,
    @Json(name = "signature") val signature: String? = null,
    @Json(name = "format_settings") val formatSettings: FormatSettings? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateTerminalSessionRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "merchant_user_id") val merchantUserId: String? = null
)

@JsonClass(generateAdapter = true)
data class TerminalSessionResponse(
    @Json(name = "id") val id: String? = null,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "session_token") val sessionToken: String? = null,
    @Json(name = "merchant_user_id") val merchantUserId: String? = null,
    @Json(name = "current_amount") val currentAmount: Long? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null
)

@JsonClass(generateAdapter = true)
data class SetSessionAmountRequest(
    @Json(name = "session_token") val sessionToken: String,
    @Json(name = "amount") val amount: Long
)

@JsonClass(generateAdapter = true)
data class EphemeralHandshakeModel(
    @Json(name = "ephemeral_public_key") val ephemeralPublicKey: String,
    @Json(name = "identity_signature") val identitySignature: String,
    @Json(name = "nonce") val nonce: String
)

@JsonClass(generateAdapter = true)
data class EphemeralMessageModel(
    @Json(name = "handshake") val handshake: EphemeralHandshakeModel,
    @Json(name = "nonce") val nonce: String,
    @Json(name = "ciphertext") val ciphertext: String,
    @Json(name = "signature") val signature: String
)

@JsonClass(generateAdapter = true)
data class EncryptedPayloadModel(
    @Json(name = "nonce") val nonce: String,
    @Json(name = "ciphertext") val ciphertext: String,
    @Json(name = "signature") val signature: String
)

@JsonClass(generateAdapter = true)
data class EncryptedPaymentRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "encrypted_payload") val encryptedPayload: EphemeralMessageModel
)

@JsonClass(generateAdapter = true)
data class EncryptedPaymentResponse(
    @Json(name = "nonce") val nonce: String? = null,
    @Json(name = "ciphertext") val ciphertext: String? = null,
    @Json(name = "signature") val signature: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null
)

// Decrypted Payloads (internal to cryptography layer)
@JsonClass(generateAdapter = true)
data class SinglePaymentDecryptedPayload(
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "crypto_token") val cryptoToken: String,
    @Json(name = "pin") val pin: String,
    @Json(name = "amount") val amount: Long,
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "nonce") val nonce: String,
    @Json(name = "id_document_type") val idDocumentType: String? = null,
    @Json(name = "id_document_number") val idDocumentNumber: String? = null
)

@JsonClass(generateAdapter = true)
data class CommunityPaymentDecryptedPayload(
    @Json(name = "seller_card_uid") val sellerCardUid: String,
    @Json(name = "seller_crypto_token") val sellerCryptoToken: String,
    @Json(name = "seller_pin") val sellerPin: String,
    @Json(name = "buyer_card_uid") val buyerCardUid: String,
    @Json(name = "buyer_crypto_token") val buyerCryptoToken: String,
    @Json(name = "buyer_pin") val buyerPin: String,
    @Json(name = "amount") val amount: Long,
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "nonce") val nonce: String,
    @Json(name = "buyer_id_document_type") val buyerIdDocumentType: String? = null,
    @Json(name = "buyer_id_document_number") val buyerIdDocumentNumber: String? = null
)

@JsonClass(generateAdapter = true)
data class MultisigSignDecryptedPayload(
    @Json(name = "pending_payment_id") val pendingPaymentId: String,
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "pin") val pin: String,
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "nonce") val nonce: String,
    @Json(name = "id_document_type") val idDocumentType: String? = null,
    @Json(name = "id_document_number") val idDocumentNumber: String? = null
)

@JsonClass(generateAdapter = true)
data class PaymentResultDecrypted(
    @Json(name = "status") val status: String? = null, // "approved", "rejected", "pending_multisig"
    @Json(name = "transaction_id") val transactionId: String? = null,
    @Json(name = "pending_id") val pendingId: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "user_balance") val userBalance: Long? = null,
    @Json(name = "required_sigs") val requiredSigs: Int? = null,
    @Json(name = "collected_sigs") val collectedSigs: Int? = null,
    @Json(name = "remaining_sigs") val remainingSigs: Int? = null
)

@JsonClass(generateAdapter = true)
data class MultisigStatusResponse(
    @Json(name = "id") val id: String? = null,
    @Json(name = "status") val status: String? = null, // "pending", "executed", "expired", "cancelled"
    @Json(name = "amount") val amount: Long? = null,
    @Json(name = "payment_type") val paymentType: String? = null,
    @Json(name = "from_account") val fromAccount: String? = null,
    @Json(name = "to_account") val toAccount: String? = null,
    @Json(name = "required_signatures") val requiredSignatures: Int? = null,
    @Json(name = "collected_count") val collectedCount: Int? = null,
    @Json(name = "remaining_sigs") val remainingSigs: Int? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "remaining_seconds") val remainingSeconds: Long? = null,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class CardTypeConfigResponse(
    @Json(name = "node_domain") val nodeDomain: String? = null,
    @Json(name = "card_type_mode") val cardTypeMode: String? = "dual", // "uid_only", "desfire", "dual"
    @Json(name = "require_crypto") val requireCrypto: Boolean? = false,
    @Json(name = "auto_rotate_key") val autoRotateKey: Boolean? = false,
    @Json(name = "max_write_fails") val maxWriteFails: Int? = 3,
    @Json(name = "require_id_document_for_uid_only") val requireIdDocumentForUidOnly: Boolean? = false,
    @Json(name = "uid_only_message") val uidOnlyMessage: String? = null
)

@JsonClass(generateAdapter = true)
data class TerminalItem(
    @Json(name = "id") val id: String? = null,
    @Json(name = "node_domain") val nodeDomain: String? = null,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "label") val label: String? = null,
    @Json(name = "terminal_type") val terminalType: String? = "keypad",
    @Json(name = "location") val location: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = true,
    @Json(name = "is_registered") val isRegistered: Boolean? = false,
    @Json(name = "last_seen") val lastSeen: String? = null
)

@JsonClass(generateAdapter = true)
data class ShiftResponse(
    @Json(name = "id") val id: String? = null,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "status") val status: String? = "open",
    @Json(name = "opened_at") val openedAt: String? = null,
    @Json(name = "closed_at") val closedAt: String? = null,
    @Json(name = "opening_amount") val openingAmount: Long? = 0L,
    @Json(name = "closing_amount") val closingAmount: Long? = 0L,
    @Json(name = "total_sales") val totalSales: Long? = 0L,
    @Json(name = "transactions_count") val transactionsCount: Int? = 0,
    @Json(name = "notes") val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class OpenShiftRequest(
    @Json(name = "opening_amount") val openingAmount: Long = 0L,
    @Json(name = "notes") val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class CloseShiftRequest(
    @Json(name = "closing_amount") val closingAmount: Long? = null,
    @Json(name = "notes") val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class CardItem(
    @Json(name = "id") val id: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "card_uid") val cardUid: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = true,
    @Json(name = "card_type") val cardType: String? = "uid_only",
    @Json(name = "crypto_enabled") val cryptoEnabled: Boolean? = false,
    @Json(name = "issued_at") val issuedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class IssueCardRequest(
    @Json(name = "user_id") val userId: String,
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "card_type") val cardType: String = "uid_only",
    @Json(name = "initial_pin") val initialPin: String = "1234"
)

@JsonClass(generateAdapter = true)
data class ChangePinRequest(
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "old_pin") val oldPin: String,
    @Json(name = "new_pin") val newPin: String
)

@JsonClass(generateAdapter = true)
data class ResetPinRequest(
    @Json(name = "new_pin") val newPin: String
)

@JsonClass(generateAdapter = true)
data class TransactionApiItem(
    @Json(name = "id") val id: String? = null,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "card_uid") val cardUid: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "amount") val amount: Long? = 0L,
    @Json(name = "status") val status: String? = "approved",
    @Json(name = "transaction_type") val transactionType: String? = "single",
    @Json(name = "error_message") val errorMessage: String? = null,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class DocumentTypeItem(
    val code: String,
    val spanishName: String
)

val DEFAULT_DOCUMENT_TYPES = listOf(
    DocumentTypeItem("cedula", "Cédula de identidad"),
    DocumentTypeItem("dni", "Documento Nacional de Identidad (DNI)"),
    DocumentTypeItem("pasaporte", "Pasaporte"),
    DocumentTypeItem("rut", "Registro Único Tributario (RUT)"),
    DocumentTypeItem("curp", "CURP"),
    DocumentTypeItem("carnet_conducir", "Carnet de Conducir"),
    DocumentTypeItem("cedula_juridica", "Cédula Jurídica"),
    DocumentTypeItem("residencia", "Permiso de Residencia"),
    DocumentTypeItem("otro", "Otro Documento")
)

// ============================================
// Terminal Pairing by Short Code
// ============================================

@JsonClass(generateAdapter = true)
data class PairingInitiateRequest(
    @Json(name = "terminal_public_key") val terminalPublicKey: String,
    @Json(name = "device_fingerprint") val deviceFingerprint: String,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "terminal_label") val terminalLabel: String? = null,
    @Json(name = "chip_id") val chipId: String? = null,
    @Json(name = "device_model") val deviceModel: String? = null,
    @Json(name = "device_manufacturer") val deviceManufacturer: String? = null,
    @Json(name = "android_version") val androidVersion: String? = null,
    @Json(name = "terminal_type") val terminalType: String = "android_pos"
)

@JsonClass(generateAdapter = true)
data class PairingInitiateResponse(
    @Json(name = "pairing_code") val pairingCode: String? = null,
    @Json(name = "expires_in") val expiresIn: Int? = 60,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class PairingStatusResponse(
    @Json(name = "status") val status: String? = null, // "pending", "approved", "expired", "rejected"
    @Json(name = "remaining_seconds") val remainingSeconds: Int? = 0,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "server_public_key") val serverPublicKey: String? = null,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class PairingOptionsResponse(
    @Json(name = "options") val options: List<String> = emptyList(),
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class PairingApproveRequest(
    @Json(name = "selected_code") val selectedCode: String
)

@JsonClass(generateAdapter = true)
data class TerminalLookupRequest(
    @Json(name = "terminal_public_key") val terminalPublicKey: String
)

@JsonClass(generateAdapter = true)
data class TerminalLookupResponse(
    @Json(name = "registered") val registered: Boolean = false,
    @Json(name = "active") val active: Boolean? = null,
    @Json(name = "terminal_id") val terminalId: String? = null,
    @Json(name = "server_public_key") val serverPublicKey: String? = null,
    @Json(name = "message") val message: String? = null
)
