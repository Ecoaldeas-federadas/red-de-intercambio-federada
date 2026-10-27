package com.example.data.crypto

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encripta y desencripta datos sensibles (como la clave privada del terminal)
 * usando Android Keystore. La clave maestra se genera y almacena en el Keystore
 * del dispositivo, por lo que solo esta app en este dispositivo puede desencriptar
 * los datos.
 *
 * Los datos encriptados se pueden guardar en Room o SharedPreferences.
 * Solo se pierden si se borran completamente los datos de la app (cache + datos).
 * Una actualizacion de la app NO borra el Keystore ni los datos encriptados.
 */
object KeystoreCrypto {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "pos_terminal_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 128

    // Cache de la clave secreta para evitar viajes al Keystore en cada operacion
    @Volatile
    private var cachedKey: SecretKey? = null

    /**
     * Obtiene o crea la clave maestra del Keystore.
     * La clave se crea la primera vez y persiste a traves de actualizaciones.
     */
    private fun getOrCreateMasterKey(): SecretKey {
        cachedKey?.let { return it }

        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        // Si la clave ya existe, usarla
        val existingKey = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existingKey != null) {
            cachedKey = existingKey
            return existingKey
        }

        // Crear nueva clave en el Keystore
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        )
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            // La clave no requiere autenticacion (no pedimos biometricos)
            // porque el POS puede usarse en dispositivos sin biometricos
            .build()

        keyGenerator.init(spec)
        val key = keyGenerator.generateKey()
        cachedKey = key
        return key
    }

    /**
     * Encripta un texto plano y devuelve un string Base64 con IV + ciphertext.
     * Formato: Base64(IV || ciphertext || GCM_TAG)
     */
    fun encrypt(plaintext: String): String {
        if (plaintext.isEmpty()) return ""

        val key = getOrCreateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)

        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        // Combinar IV + ciphertext + tag en un solo array
        val combined = ByteArray(iv.size + ciphertext.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)

        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Desencripta un string Base64 (IV + ciphertext + GCM_TAG) y devuelve el texto plano.
     * Si el string no esta encriptado (texto plano sin Base64 valido), devuelve el original.
     */
    fun decrypt(encrypted: String): String {
        if (encrypted.isEmpty()) return ""

        return try {
            val combined = Base64.decode(encrypted, Base64.NO_WRAP)

            // Extraer IV (primeros GCM_IV_LENGTH bytes)
            if (combined.size <= GCM_IV_LENGTH) return encrypted // No es valido, devolver original

            val iv = combined.copyOfRange(0, GCM_IV_LENGTH)
            val ciphertext = combined.copyOfRange(GCM_IV_LENGTH, combined.size)

            val key = getOrCreateMasterKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            val plaintext = cipher.doFinal(ciphertext)
            String(plaintext, Charsets.UTF_8)
        } catch (e: Exception) {
            // Si falla la desencriptacion, podria ser texto plano (datos viejos no encriptados)
            // Devolver el original para no romper la app
            encrypted
        }
    }

    /**
     * Verifica si un string esta encriptado (es Base64 valido con tamaño suficiente)
     */
    fun isEncrypted(value: String): Boolean {
        if (value.isEmpty()) return false
        return try {
            val decoded = Base64.decode(value, Base64.NO_WRAP)
            decoded.size > GCM_IV_LENGTH + 16 // IV + al menos un bloque AES
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Elimina la clave maestra del Keystore.
     * Se usa solo cuando el usuario resetea el terminal completamente.
     */
    fun deleteMasterKey() {
        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)
            keyStore.deleteEntry(KEY_ALIAS)
            cachedKey = null
        } catch (e: Exception) {
            // No es critico si falla
        }
    }
}
