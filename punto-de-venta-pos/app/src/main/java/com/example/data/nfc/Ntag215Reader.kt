package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.NfcA
import com.example.data.crypto.CryptoEngine
import java.io.IOException

/**
 * Lector/escritor para tarjetas NTAG215.
 *
 * NTAG215:
 * - NFC Forum Type 2, ISO/IEC 14443-A
 * - 135 paginas de 4 bytes (540 bytes total, 504 bytes de usuario)
 * - 1 PWD global de 32 bits + PACK de 16 bits
 * - AUTH0 protege desde una pagina configurable
 * - 30 slots de 16 bytes (15 activos + 15 backups)
 * - Compatible con TODOS los telefonos NFC (Android + iOS)
 *
 * Comandos NFC Type 2 usados:
 * - READ (0x30): lee 16 bytes (4 paginas) desde una pagina inicial
 * - WRITE (0xA2): escribe 4 bytes (1 pagina)
 * - PWD_AUTH (0x1B): autenticacion con PWD de 32 bits
 * - GET_VERSION (0x60): identifica el tipo de NTAG
 *
 * Layout de memoria:
 * - Paginas 4-9: zona publica (custom_card_id, 24 bytes)
 * - Paginas 10-129: zona privada (30 slots x 4 paginas x 4 bytes = 480 bytes)
 * - Paginas 130-134: configuracion (Capability Container, PWD, PACK, AUTH0, etc.)
 */
class Ntag215Reader : CardReader {

    override val cardType: String = "ntag215"
    override val displayName: String = "NTAG215"

    // Comandos NFC Type 2
    private val CMD_READ: Byte = 0x30
    private val CMD_WRITE: Byte = 0xA2.toByte()
    private val CMD_PWD_AUTH: Byte = 0x1B
    private val CMD_GET_VERSION: Byte = 0x60

    // Paginas de configuracion NTAG215
    private val PAGE_AUTH0 = 131.toByte()  // AUTH0: primera pagina protegida
    private val PAGE_ACCESS = 132.toByte() // ACCESS: configuracion de proteccion
    private val PAGE_PWD = 133.toByte()    // PWD (2 paginas: 133-134)
    private val PAGE_PACK = 135.toByte()   // PACK (parte de pagina 135)

    // Zona publica
    private val PUBLIC_ZONE_START = 4
    private val PUBLIC_ZONE_END = 9

    // Zona privada (donde estan los 30 slots)
    private val PRIVATE_ZONE_START = 10

    override fun canHandle(tag: Tag): Boolean {
        // NTAG215 es NFC Type 2 (NfcA) con 540 bytes
        val hasNfcA = tag.techList.any { it == "android.nfc.tech.NfcA" }
        if (!hasNfcA) return false

        // Verificar que es NTAG215 via GET_VERSION
        return try {
            val nfcA = NfcA.get(tag) ?: return false
            nfcA.connect()
            val version = nfcA.transceive(byteArrayOf(CMD_GET_VERSION))
            nfcA.close()
            // NTAG215: vendor 0x04 (NXP), product type 0x04 (NTAG), product subtype 0x05
            // size = 0x02 (135 pages = NTAG215)
            if (version.size >= 8) {
                version[0] == 0x00.toByte() && // NXP
                version[1] == 0x04.toByte() && // NTAG
                version[2] == 0x05.toByte() && // 215
                version[3] == 0x02.toByte()    // 135 pages
            } else {
                false
            }
        } catch (e: Exception) {
            // Si GET_VERSION falla, asumir que podria ser NTAG215 si es NfcA
            // El caller puede verificar con otros metodos
            false
        }
    }

    override fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    /**
     * Autentica con la PWD de 32 bits (4 bytes).
     * Retorna true si la autenticacion fue exitosa.
     */
    fun authenticate(tag: Tag, pwd: ByteArray): Boolean {
        if (pwd.size != 4) return false
        val nfcA = NfcA.get(tag) ?: return false
        return try {
            nfcA.connect()
            // PWD_AUTH: comando 0x1B + PWD (4 bytes)
            val response = nfcA.transceive(byteArrayOf(CMD_PWD_AUTH) + pwd)
            // La respuesta debe contener el PACK (2 bytes)
            nfcA.close()
            response.size >= 2
        } catch (e: IOException) {
            false
        } finally {
            try { nfcA.close() } catch (_: Exception) {}
        }
    }

    /**
     * Lee 4 paginas (16 bytes) desde una pagina inicial usando READ.
     * Comando READ: 0x30 + page_address (1 byte)
     * Retorna 16 bytes (4 paginas consecutivas) o null si falla.
     */
    fun readPages(tag: Tag, startPage: Int): ByteArray? {
        if (startPage < 0 || startPage > 134) return null
        val nfcA = NfcA.get(tag) ?: return null
        return try {
            nfcA.connect()
            val response = nfcA.transceive(byteArrayOf(CMD_READ, startPage.toByte()))
            nfcA.close()
            // READ retorna 16 bytes (4 paginas)
            if (response.size >= 16) response.copyOf(16) else null
        } catch (e: IOException) {
            null
        } finally {
            try { nfcA.close() } catch (_: Exception) {}
        }
    }

    /**
     * Escribe 4 bytes (1 pagina) usando WRITE.
     * Comando WRITE: 0xA2 + page_address (1 byte) + data (4 bytes)
     * Retorna true si se escribio correctamente.
     */
    fun writePage(tag: Tag, page: Int, data: ByteArray): Boolean {
        if (data.size != 4 || page < 0 || page > 134) return false
        val nfcA = NfcA.get(tag) ?: return false
        return try {
            nfcA.connect()
            val response = nfcA.transceive(byteArrayOf(CMD_WRITE, page.toByte()) + data)
            nfcA.close()
            // WRITE exitosa retorna ACK (0x0A)
            response.isNotEmpty() && response[0] == 0x0A.toByte()
        } catch (e: IOException) {
            false
        } finally {
            try { nfcA.close() } catch (_: Exception) {}
        }
    }

    /**
     * Lee un certificado de 16 bytes de un slot.
     * Cada slot ocupa 4 paginas (4 x 4 bytes = 16 bytes).
     *
     * @param slot Numero de slot (0-29)
     * @param authData PWD de 4 bytes
     * @return Certificado de 16 bytes, o null si falla
     */
    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        if (slot < 0 || slot >= 30) return null

        // Autenticar primero
        if (!authenticate(tag, authData)) return null

        // Leer las 4 paginas del slot
        val startPage = slotToStartPage(slot)
        return readPages(tag, startPage)
    }

    /**
     * Escribe un certificado de 16 bytes en un slot.
     * Cada slot ocupa 4 paginas. Se escribe pagina por pagina.
     *
     * @param slot Numero de slot (0-29)
     * @param certificate Certificado de 16 bytes
     * @param authData PWD de 4 bytes
     * @return true si las 4 paginas se escribieron correctamente
     */
    override fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean {
        if (slot < 0 || slot >= 30 || certificate.size != 16) return false

        // Autenticar primero
        if (!authenticate(tag, authData)) return false

        val startPage = slotToStartPage(slot)
        // Escribir las 4 paginas del slot (4 bytes cada una)
        for (i in 0 until 4) {
            val pageData = certificate.copyOfRange(i * 4, (i + 1) * 4)
            if (!writePage(tag, startPage + i, pageData)) {
                return false
            }
        }
        return true
    }

    /**
     * Verifica que el certificado se haya escrito correctamente re-leyendo el slot.
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
     * Escribe el custom_card_id en la zona publica (paginas 4-9).
     * Solo se usa durante el provisionamiento.
     *
     * @param publicData custom_card_id (hasta 24 bytes = 6 paginas)
     * @param authData PWD de 4 bytes (no necesaria para zona publica, pero se pasa por consistencia)
     */
    override fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean {
        if (publicData.size > 24) return false

        // Rellenar a 24 bytes (6 paginas)
        val padded = ByteArray(24)
        System.arraycopy(publicData, 0, padded, 0, publicData.size)

        // Escribir paginas 4-9 (6 paginas)
        for (i in 0 until 6) {
            val pageData = padded.copyOfRange(i * 4, (i + 1) * 4)
            if (!writePage(tag, PUBLIC_ZONE_START + i, pageData)) {
                return false
            }
        }
        return true
    }

    /**
     * Configura la PWD, PACK y AUTH0 durante el provisionamiento.
     * authConfig = PWD (4 bytes) + PACK (2 bytes) + AUTH0 (1 byte) = 7 bytes
     */
    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        if (authConfig.size != 7) return false

        val pwd = authConfig.copyOfRange(0, 4)
        val pack = authConfig.copyOfRange(4, 6)
        val auth0 = authConfig[6]

        // Escribir PWD en paginas 133-134 (PWD es 4 bytes, ocupa 1 pagina + parte de otra)
        // Pagina 133: PWD bytes 0-3
        if (!writePage(tag, 133, pwd)) return false

        // Pagina 134: PWD bytes 4-7 (si PWD es de 4 bytes, pagina 134 tiene bytes 4-7)
        // En NTAG215, PWD es de 4 bytes en pagina 133, PACK es 2 bytes en pagina 135
        // Corregir: PWD esta en paginas 133-134 (8 bytes para PWD de 4 bytes + padding)
        // Realmente PWD es 4 bytes en pagina 133, PACK es 2 bytes en pagina 135

        // Escribir PACK en pagina 135 (bytes 0-1 = PACK, bytes 2-3 = 0)
        val packPage = ByteArray(4)
        System.arraycopy(pack, 0, packPage, 0, 2)
        if (!writePage(tag, 135, packPage)) return false

        // Escribir AUTH0 en pagina 131 (byte 0 = AUTH0)
        // AUTH0 = primera pagina protegida (debe ser 10 para zona privada)
        val auth0Page = ByteArray(4)
        auth0Page[0] = auth0
        // Access: PROT=1 (proteccion read+write), CFGLCK=0
        auth0Page[1] = 0x00
        auth0Page[2] = 0x00
        auth0Page[3] = 0x00
        if (!writePage(tag, 131, auth0Page)) return false

        // Configurar ACCESS en pagina 132
        // ACCESS: AUTH0 limit, PROT bit (0=write-only, 1=read+write protected)
        val accessPage = ByteArray(4)
        accessPage[0] = 0x00 // CFGLCK=0
        accessPage[1] = 0x80.toByte() // PROT=1 (read+write protection)
        accessPage[2] = 0x00
        accessPage[3] = 0x00
        if (!writePage(tag, 132, accessPage)) return false

        return true
    }

    override fun totalSlots(): Int = 30
    override fun activeSlots(): Int = 15

    /**
     * Convierte un slot a su pagina inicial.
     * pagina_inicial = 10 + (slot * 4)
     */
    override fun slotToStartPage(slot: Int): Int {
        return PRIVATE_ZONE_START + (slot * 4)
    }

    /**
     * Convierte un slot a su pagina final (inclusiva).
     */
    override fun slotToEndPage(slot: Int): Int {
        return slotToStartPage(slot) + 3
    }
}
