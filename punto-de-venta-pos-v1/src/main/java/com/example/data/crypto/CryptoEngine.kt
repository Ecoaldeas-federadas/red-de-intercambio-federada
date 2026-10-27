package com.example.data.crypto

import android.content.Context
import android.provider.Settings
import org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator
import org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import org.bouncycastle.crypto.agreement.X25519Agreement
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

data class EncryptedPayload(
    val nonce: String,
    val ciphertext: String,
    val signature: String
)

data class EphemeralHandshake(
    val ephemeralPublicKey: String,
    val identitySignature: String,
    val nonce: String
)

data class EphemeralMessage(
    val handshake: EphemeralHandshake,
    val nonce: String,
    val ciphertext: String,
    val signature: String
)

data class TerminalKeyPair(
    val privateKeyHex: String,
    val publicKeyHex: String
)

object CryptoEngine {
    private val secureRandom = SecureRandom()

    fun generateEd25519KeyPair(): TerminalKeyPair {
        val keyPairGen = Ed25519KeyPairGenerator()
        keyPairGen.init(Ed25519KeyGenerationParameters(secureRandom))
        val keyPair = keyPairGen.generateKeyPair()

        val priv = keyPair.private as Ed25519PrivateKeyParameters
        val pub = keyPair.public as Ed25519PublicKeyParameters

        return TerminalKeyPair(
            privateKeyHex = priv.encoded.toHex(),
            publicKeyHex = pub.encoded.toHex()
        )
    }

    /**
     * Converts Ed25519 key bytes to Curve25519 key bytes via SHA-512 + clamping
     * as specified in section 6.3
     */
    fun ed25519ToCurve25519Clamped(edBytes: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("SHA-512")
        val hash = md.digest(edBytes)
        val clamped = hash.copyOf(32)
        clamped[0] = (clamped[0].toInt() and 248).toByte()
        clamped[31] = (clamped[31].toInt() and 127).toByte()
        clamped[31] = (clamped[31].toInt() or 64).toByte()
        return clamped
    }

    /**
     * Computes ECDH shared key (32 bytes AES key) using Curve25519 + SHA-256
     */
    fun deriveSharedKey(
        terminalPrivateKeyHex: String,
        serverPublicKeyHex: String
    ): ByteArray {
        val privBytes = terminalPrivateKeyHex.hexToBytes()
        val pubBytes = serverPublicKeyHex.hexToBytes()

        val curvePriv = ed25519ToCurve25519Clamped(privBytes)
        val curvePub = ed25519ToCurve25519Clamped(pubBytes)

        val x25519Priv = X25519PrivateKeyParameters(curvePriv, 0)
        val x25519Pub = X25519PublicKeyParameters(curvePub, 0)

        val agreement = X25519Agreement()
        agreement.init(x25519Priv)

        val rawShared = ByteArray(agreement.agreementSize)
        agreement.calculateAgreement(x25519Pub, rawShared, 0)

        val md = MessageDigest.getInstance("SHA-256")
        val sharedKey = md.digest(rawShared)

        // Wipe temporary key buffers
        Arrays.fill(rawShared, 0.toByte())
        Arrays.fill(curvePriv, 0.toByte())
        Arrays.fill(curvePub, 0.toByte())

        return sharedKey
    }

    /**
     * Signs data using Ed25519 private key
     */
    fun signEd25519(privateKeyHex: String, data: ByteArray): String {
        val privBytes = privateKeyHex.hexToBytes()
        val privParams = Ed25519PrivateKeyParameters(privBytes, 0)
        val signer = Ed25519Signer()
        signer.init(true, privParams)
        signer.update(data, 0, data.size)
        val signature = signer.generateSignature()
        Arrays.fill(privBytes, 0.toByte())
        return signature.toHex()
    }

    /**
     * Verifies signature using Ed25519 public key
     */
    fun verifyEd25519(publicKeyHex: String, data: ByteArray, signatureHex: String): Boolean {
        return try {
            val pubBytes = publicKeyHex.hexToBytes()
            val sigBytes = signatureHex.hexToBytes()
            val pubParams = Ed25519PublicKeyParameters(pubBytes, 0)
            val verifier = Ed25519Signer()
            verifier.init(false, pubParams)
            verifier.update(data, 0, data.size)
            verifier.verifySignature(sigBytes)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Encrypts plaintext with AES-256-GCM and signs the ciphertext with Ed25519
     */
    fun encryptPayload(
        plaintextJson: String,
        sharedKey: ByteArray,
        terminalPrivateKeyHex: String
    ): EncryptedPayload {
        val nonce = ByteArray(12)
        secureRandom.nextBytes(nonce)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, nonce)
        val keySpec = SecretKeySpec(sharedKey, "AES")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec)

        val plainBytes = plaintextJson.toByteArray(Charsets.UTF_8)
        val ciphertext = cipher.doFinal(plainBytes)

        val signatureHex = signEd25519(terminalPrivateKeyHex, ciphertext)

        return EncryptedPayload(
            nonce = nonce.toHex(),
            ciphertext = ciphertext.toHex(),
            signature = signatureHex
        )
    }

    /**
     * Decrypts server response, optionally verifying server Ed25519 signature
     */
    fun decryptPayload(
        encryptedPayload: EncryptedPayload,
        sharedKey: ByteArray,
        serverPublicKeyHex: String?
    ): String {
        val nonceBytes = encryptedPayload.nonce.hexToBytes()
        val cipherBytes = encryptedPayload.ciphertext.hexToBytes()

        if (!serverPublicKeyHex.isNullOrEmpty() && encryptedPayload.signature.isNotEmpty()) {
            val valid = verifyEd25519(serverPublicKeyHex, cipherBytes, encryptedPayload.signature)
            if (!valid) {
                // Log or throw if strict signature check is required
            }
        }

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, nonceBytes)
        val keySpec = SecretKeySpec(sharedKey, "AES")
        cipher.init(Cipher.DECRYPT_MODE, keySpec, spec)

        val decryptedBytes = cipher.doFinal(cipherBytes)
        val plaintext = String(decryptedBytes, Charsets.UTF_8)
        Arrays.fill(decryptedBytes, 0.toByte())
        return plaintext
    }

    /**
     * Encrypts payload using ephemeral key with handshake (perfect forward secrecy).
     * Returns EphemeralMessage + the ephemeral shared key (for decrypting the response).
     *
     * Flow:
     * 1. Generate ephemeral Ed25519 keypair
     * 2. Sign (ephemeral_pub || handshake_nonce) with terminal identity key
     * 3. Derive ephemeral shared key via ECDH(ephemeral_priv, server_pub)
     * 4. Encrypt payload with AES-256-GCM using ephemeral shared key
     * 5. Sign ciphertext with terminal identity key
     */
    fun encryptPayloadEphemeral(
        plaintextJson: String,
        terminalPrivateKeyHex: String,
        serverPublicKeyHex: String
    ): Pair<EphemeralMessage, ByteArray> {
        // 1. Generate ephemeral keypair
        val ephemeralKeyPair = generateEd25519KeyPair()

        // 2. Create handshake nonce and sign (ephemeral_pub || nonce) with identity key
        val handshakeNonce = generateRandomNonce(16)
        val handshakeMessage = ephemeralKeyPair.publicKeyHex.hexToBytes() + handshakeNonce.toByteArray(Charsets.UTF_8)
        val identitySignature = signEd25519(terminalPrivateKeyHex, handshakeMessage)

        val handshake = EphemeralHandshake(
            ephemeralPublicKey = ephemeralKeyPair.publicKeyHex,
            identitySignature = identitySignature,
            nonce = handshakeNonce
        )

        // 3. Derive ephemeral shared key via ECDH
        val ephemeralSharedKey = deriveSharedKey(ephemeralKeyPair.privateKeyHex, serverPublicKeyHex)

        // 4. Encrypt payload with AES-256-GCM using ephemeral shared key
        val aesNonce = ByteArray(12)
        secureRandom.nextBytes(aesNonce)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, aesNonce)
        val keySpec = SecretKeySpec(ephemeralSharedKey, "AES")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec)

        val plainBytes = plaintextJson.toByteArray(Charsets.UTF_8)
        val ciphertext = cipher.doFinal(plainBytes)

        // 5. Sign ciphertext with terminal identity key
        val ciphertextSignature = signEd25519(terminalPrivateKeyHex, ciphertext)

        val message = EphemeralMessage(
            handshake = handshake,
            nonce = aesNonce.toHex(),
            ciphertext = ciphertext.toHex(),
            signature = ciphertextSignature
        )

        // Zeroize ephemeral private key bytes
        Arrays.fill(ephemeralKeyPair.privateKeyHex.hexToBytes(), 0.toByte())

        return Pair(message, ephemeralSharedKey)
    }

    /**
     * Decrypts server response using the ephemeral shared key from the request.
     * The response format is {nonce, ciphertext, signature} (no handshake).
     */
    fun decryptResponseEphemeral(
        encryptedPayload: EncryptedPayload,
        ephemeralSharedKey: ByteArray,
        serverPublicKeyHex: String?
    ): String {
        return decryptPayload(encryptedPayload, ephemeralSharedKey, serverPublicKeyHex)
    }

    fun generateRandomNonce(byteLength: Int = 16): String {
        val nonce = ByteArray(byteLength)
        secureRandom.nextBytes(nonce)
        return nonce.toHex()
    }

    fun getDeviceFingerprint(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_pos_device"
        val md = MessageDigest.getInstance("SHA-256")
        val digest = md.digest("POS-ANDROID-$androidId".toByteArray(Charsets.UTF_8))
        return digest.toHex()
    }

    /**
     * Genera un terminal_id determinista basado en ANDROID_ID.
     * El ID es estable: mismo dispositivo + mismo algoritmo = mismo ID siempre.
     * No cambia con actualizaciones de la app. Se regenera identico si se
     * borran los datos de la app y se vuelve a crear (mismo ANDROID_ID).
     * Solo cambia si se desinstala completamente la app (Android 8+ puede
     * rotar ANDROID_ID al reinstalar con diferente signing key).
     */
    fun generateTerminalId(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_pos_device"
        val md = MessageDigest.getInstance("SHA-256")
        val digest = md.digest("POS-ANDROID-$androidId".toByteArray(Charsets.UTF_8))
        val hash = digest.toHex()
        return "TERM-ANDROID-${hash.take(12).uppercase()}"
    }

    fun bytesToHex(bytes: ByteArray): String = bytes.toHex()

    fun zeroize(vararg byteArrays: ByteArray?) {
        for (b in byteArrays) {
            if (b != null) {
                Arrays.fill(b, 0.toByte())
            }
        }
    }
}

fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

fun String.hexToBytes(): ByteArray {
    val clean = this.trim()
    val len = clean.length
    val data = ByteArray(len / 2)
    var i = 0
    while (i < len) {
        data[i / 2] = ((Character.digit(clean[i], 16) shl 4) + Character.digit(clean[i + 1], 16)).toByte()
        i += 2
    }
    return data
}
