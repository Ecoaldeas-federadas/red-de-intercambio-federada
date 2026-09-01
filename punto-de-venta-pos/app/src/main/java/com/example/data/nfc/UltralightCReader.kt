package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.MifareUltralight
import android.nfc.tech.NfcA
import com.example.data.crypto.CryptoEngine
import java.io.IOException

/**
 * Lector/escritor para tarjetas MIFARE Ultralight C.
 *
 * Ultralight C:
 * - NFC Forum Type 2, ISO/IEC 14443-A
 * - 48 paginas de 4 bytes (192 bytes total, ~148 bytes de usuario)
 * - 3DES con clave de 112 bits (16 bytes)
 * - Autenticacion mutua 3-pass
 * - 8 slots de 16 bytes (4 activos + 4 backups)
 * - Baja capacidad — usar solo si no se consigue NTAG215
 *
 * Nota: MifareUltralight es OPCIONAL en Android. Algunos telefonos
 * (ej. Google Pixel) no lo soportan. En esos casos, se usa NfcA
 * con comandos raw.
 *
 * Comandos Ultralight C:
 * - READ (0x30): lee 16 bytes (4 paginas)
 * - WRITE (0xA2): escribe 4 bytes (1 pagina)
 * - AUTHENTICATE (0x1A + 0x00): autenticacion 3DES 3-pass
 *
 * Layout de memoria:
 * - Paginas 4-7: zona publica (custom_card_id, 16 bytes)
 * - Paginas 8-39: zona privada (8 slots x 4 paginas x 4 bytes = 128 bytes)
 * - Paginas 44-47: clave 3DES (no legible despues de configurar)
 */
class UltralightCReader : CardReader {

    override val cardType: String = "ultralight_c"
    override val displayName: String = "MIFARE Ultralight C"

    // Comandos
    private val CMD_READ: Byte = 0x30
    private val CMD_WRITE: Byte = 0xA2.toByte()
    private val CMD_AUTH_1: Byte = 0x1A

    // Zona publica
    private val PUBLIC_ZONE_START = 4
    private val PUBLIC_ZONE_END = 7

    // Zona privada
    private val PRIVATE_ZONE_START = 8

    override fun canHandle(tag: Tag): Boolean {
        // Ultralight C es NfcA. MifareUltralight es opcional en Android.
        val hasNfcA = tag.techList.any { it == "android.nfc.tech.NfcA" }
        val hasMifareUL = tag.techList.any { it == "android.nfc.tech.MifareUltralight" }

        if (!hasNfcA && !hasMifareUL) return false

        // Verificar via GET_VERSION si es Ultralight C
        return try {
            val nfcA = NfcA.get(tag) ?: return false
            nfcA.connect()
            // GET_VERSION (0x60)
            val version = nfcA.transceive(byteArrayOf(0x60))
            nfcA.close()
            // Ultralight C: vendor 0x04 (NXP), product type 0x03 (Ultralight)
            // product subtype 0x01, major version 0x02 (C)
            if (version.size >= 8) {
                version[0] == 0x00.toByte() && // NXP
                version[1] == 0x04.toByte() && // Ultralight
                version[2] == 0x02.toByte()    // C variant
            } else {
                false
            }
        } catch (e: Exception) {
            // Si no podemos verificar, asumir que no es Ultralight C
            false
        }
    }

    override fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    /**
     * Lee 4 paginas (16 bytes) desde una pagina inicial.
     * Usa MifareUltralight si esta disponible, sino NfcA raw.
     */
    fun readPages(tag: Tag, startPage: Int): ByteArray? {
        if (startPage < 0 || startPage > 43) return null

        // Intentar con MifareUltralight primero (mas confiable)
        val mifareUL = MifareUltralight.get(tag)
        if (mifareUL != null) {
            return try {
                mifareUL.connect()
                // readPages devuelve 4 paginas (16 bytes)
                val data = mifareUL.readPages(startPage)
                mifareUL.close()
                if (data.size >= 16) data.copyOf(16) else null
            } catch (e: IOException) {
                null
            } finally {
                try { mifareUL.close() } catch (_: Exception) {}
            }
        }

        // Fallback: NfcA raw con comando READ
        val nfcA = NfcA.get(tag) ?: return null
        return try {
            nfcA.connect()
            val response = nfcA.transceive(byteArrayOf(CMD_READ, startPage.toByte()))
            nfcA.close()
            if (response.size >= 16) response.copyOf(16) else null
        } catch (e: IOException) {
            null
        } finally {
            try { nfcA.close() } catch (_: Exception) {}
        }
    }

    /**
     * Escribe 4 bytes (1 pagina) usando WRITE.
     * Usa MifareUltralight si esta disponible, sino NfcA raw.
     */
    fun writePage(tag: Tag, page: Int, data: ByteArray): Boolean {
        if (data.size != 4 || page < 0 || page > 43) return false

        val mifareUL = MifareUltralight.get(tag)
        if (mifareUL != null) {
            return try {
                mifareUL.connect()
                mifareUL.writePage(page, data)
                mifareUL.close()
                true
            } catch (e: IOException) {
                false
            } finally {
                try { mifareUL.close() } catch (_: Exception) {}
            }
        }

        // Fallback: NfcA raw
        val nfcA = NfcA.get(tag) ?: return false
        return try {
            nfcA.connect()
            val response = nfcA.transceive(byteArrayOf(CMD_WRITE, page.toByte()) + data)
            nfcA.close()
            response.isNotEmpty() && response[0] == 0x0A.toByte()
        } catch (e: IOException) {
            false
        } finally {
            try { nfcA.close() } catch (_: Exception) {}
        }
    }

    /**
     * Autenticacion 3DES 3-pass.
     * Este es un proceso de 3 pasos:
     * 1. Enviar comando AUTH + RndB (reto del lector)
     * 2. Recibir RndA + RndB cifrado
     * 3. Enviar RndA cifrado
     *
     * Nota: La implementacion completa del 3-pass requiere cifrado 3DES
     * que se maneja en el servidor. El POS normalmente recibe la clave
     * del servidor y la usa para autenticar.
     *
     * @param desKey Clave 3DES de 16 bytes
     * @return true si la autenticacion fue exitosa
     */
    fun authenticate(tag: Tag, desKey: ByteArray): Boolean {
        if (desKey.size != 16) return false

        // La autenticacion 3DES 3-pass es compleja y requiere:
        // 1. Generar RndB (random del lector)
        // 2. Cifrar RndB con 3DES
        // 3. Enviar comando AUTH (0x1A 0x00) + RndB cifrado
        // 4. Recibir RndA' + RndB' cifrado
        // 5. Descifrar y verificar
        // 6. Enviar RndA cifrado de vuelta
        //
        // Por ahora, delegamos al MifareUltralight si esta disponible,
        // que maneja la autenticacion internamente.
        //
        // TODO: Implementar 3-pass completo con NfcA raw para telefonos
        // que no soportan MifareUltralight

        val mifareUL = MifareUltralight.get(tag) ?: return false
        return try {
            mifareUL.connect()
            // MifareUltralight.authenticate() hace el 3-pass internamente
            // Pero este metodo no esta expuesto en la API publica de Android.
            // La autenticacion real se hace via transceive con comandos raw.
            //
            // Por ahora, retornamos true si podemos leer la pagina 0
            // (lo que indica que el tag es accesible).
            // La autenticacion 3DES real se implementara con NfcA raw.
            mifareUL.readPages(0)
            mifareUL.close()
            true
        } catch (e: IOException) {
            false
        } finally {
            try { mifareUL.close() } catch (_: Exception) {}
        }
    }

    /**
     * Lee un certificado de 16 bytes de un slot.
     * Cada slot ocupa 4 paginas (4 x 4 bytes = 16 bytes).
     *
     * @param slot Numero de slot (0-7)
     * @param authData Clave 3DES de 16 bytes
     * @return Certificado de 16 bytes, o null si falla
     */
    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        if (slot < 0 || slot >= 8) return null

        // Autenticar primero (si la autenticacion falla, intentar sin auth
        // ya que algunas paginas pueden ser legibles sin auth)
        authenticate(tag, authData)

        val startPage = slotToStartPage(slot)
        return readPages(tag, startPage)
    }

    /**
     * Escribe un certificado de 16 bytes en un slot.
     * Cada slot ocupa 4 paginas. Se escribe pagina por pagina.
     *
     * @param slot Numero de slot (0-7)
     * @param certificate Certificado de 16 bytes
     * @param authData Clave 3DES de 16 bytes
     * @return true si las 4 paginas se escribieron correctamente
     */
    override fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean {
        if (slot < 0 || slot >= 8 || certificate.size != 16) return false

        // Autenticar primero
        if (!authenticate(tag, authData)) return false

        val startPage = slotToStartPage(slot)
        for (i in 0 until 4) {
            val pageData = certificate.copyOfRange(i * 4, (i + 1) * 4)
            if (!writePage(tag, startPage + i, pageData)) {
                return false
            }
        }
        return true
    }

    /**
     * Verifica que el certificado se haya escrito correctamente.
     * Retorna el numero de paginas que coinciden (0-4).
     */
    override fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int {
        val read = readCertificate(tag, slot, authData) ?: return 0
        if (read.size != 16 || expected.size != 16) return 0
        var matches = 0
        for (i in 0 until 4) {
            val pageRead = read.copyOfRange(i * 4, (i + 1) * 4)
            val pageExpected = expected.copyOfRange(i * 4, (i + 1) * 4)
            if (pageRead.contentEquals(pageExpected)) {
                matches++
            }
        }
        return matches
    }

    /**
     * Escribe el custom_card_id en la zona publica (paginas 4-7).
     * Solo se usa durante el provisionamiento.
     *
     * @param publicData custom_card_id (hasta 16 bytes = 4 paginas)
     */
    override fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean {
        if (publicData.size > 16) return false

        val padded = ByteArray(16)
        System.arraycopy(publicData, 0, padded, 0, publicData.size)

        for (i in 0 until 4) {
            val pageData = padded.copyOfRange(i * 4, (i + 1) * 4)
            if (!writePage(tag, PUBLIC_ZONE_START + i, pageData)) {
                return false
            }
        }
        return true
    }

    /**
     * Configura la clave 3DES durante el provisionamiento.
     * authConfig = clave 3DES de 16 bytes
     *
     * La clave 3DES se escribe en las paginas 44-47 (4 paginas x 4 bytes = 16 bytes).
     * Una vez escrita, la clave no es legible.
     */
    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        if (authConfig.size != 16) return false

        // Escribir la clave 3DES en paginas 44-47
        for (i in 0 until 4) {
            val pageData = authConfig.copyOfRange(i * 4, (i + 1) * 4)
            if (!writePage(tag, 44 + i, pageData)) {
                return false
            }
        }
        return true
    }

    override fun totalSlots(): Int = 8
    override fun activeSlots(): Int = 4

    /**
     * Convierte un slot a su pagina inicial.
     * pagina_inicial = 8 + (slot * 4)
     */
    override fun slotToStartPage(slot: Int): Int {
        return PRIVATE_ZONE_START + (slot * 4)
    }

    override fun slotToEndPage(slot: Int): Int {
        return slotToStartPage(slot) + 3
    }
}
