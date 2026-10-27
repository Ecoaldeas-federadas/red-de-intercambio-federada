package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.NfcA
import android.nfc.tech.MifareClassic
import android.nfc.tech.MifareUltralight
import android.nfc.tech.IsoDep
import android.util.Log
import com.example.data.crypto.CryptoEngine

/**
 * Motor que interpreta ReaderConfig (reader.json) para leer/escribir tarjetas NFC
 * sin codigo compilado. Soporta comandos NFC Type 2 (NfcA) y MIFARE Classic.
 *
 * Esto permite agregar soporte para nuevas tarjetas dinamicamente:
 * el servidor descarga reader.json y este motor lo interpreta.
 *
 * Limitaciones:
 * - Solo soporta comandos declarados en reader.json (READ, WRITE, PWD_AUTH, etc.)
 * - Tarjetas que requieren logica compleja (DESFire, MIFARE Plus) necesitan
 *   un reader compilado (built-in), no pueden usar este motor.
 */
class CardReaderEngine(private val config: ReaderConfig) : CardReader {

    override val cardType: String = config.type
    override val displayName: String = config.displayName

    companion object {
        private const val TAG = "CardReaderEngine"
    }

    override fun canHandle(tag: Tag): Boolean {
        val tagTechList = tag.techList.toList()
        // Verificar que todas las tech requeridas estan presentes
        for (requiredTech in config.detection.techList) {
            if (requiredTech !in tagTechList) {
                return false
            }
        }
        // Si hay SAK definido, verificarlo
        // (tag.getTechList() no da SAK directamente, pero NfcA si)
        return true
    }

    override fun readUid(tag: Tag): String {
        return when (config.uid.method) {
            "tag_id" -> CryptoEngine.bytesToHex(tag.id)
            "read_page_0" -> {
                val page0 = readPageNfcA(tag, 0) ?: return CryptoEngine.bytesToHex(tag.id)
                CryptoEngine.bytesToHex(page0.copyOfRange(0, 4))
            }
            else -> CryptoEngine.bytesToHex(tag.id)
        }
    }

    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        val cfg = config.readCertificate ?: return null

        if (cfg.authRequired) {
            if (!authenticate(tag, authData)) {
                Log.w(TAG, "readCertificate: autenticacion fallida")
                return null
            }
        }

        val startPage = calculateSlotPage(slot, cfg.slotToPageFormula)
        return readPagesNfcA(tag, startPage, cfg.pagesPerRead)
    }

    override fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean {
        val cfg = config.writeCertificate ?: return false

        if (cfg.authRequired) {
            if (!authenticate(tag, authData)) {
                Log.w(TAG, "writeCertificate: autenticacion fallida")
                return false
            }
        }

        val startPage = calculateSlotPage(slot, cfg.slotToPageFormula)

        // Escribir pagina por pagina (cada WRITE es de 1 pagina de 4 bytes)
        for (i in 0 until cfg.writesPerCertificate) {
            val page = startPage + i
            val offset = i * 4
            if (offset + 4 > certificate.size) break
            val pageData = certificate.copyOfRange(offset, offset + 4)
            if (!writePageNfcA(tag, page, pageData)) {
                Log.w(TAG, "writeCertificate: fallo escribiendo pagina $page")
                return false
            }
        }

        // Verificar despues de escribir si esta configurado
        if (cfg.verifyAfterWrite) {
            val readBack = readCertificate(tag, slot, authData)
            if (readBack == null || !readBack.contentEquals(certificate)) {
                Log.w(TAG, "writeCertificate: verificacion fallo")
                return false
            }
        }

        return true
    }

    override fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int {
        val readBack = readCertificate(tag, slot, authData) ?: return 0
        if (readBack.contentEquals(expected)) return expected.size / 4

        // Contar paginas que coinciden
        var matchingPages = 0
        val pagesToCheck = minOf(expected.size, readBack.size) / 4
        for (i in 0 until pagesToCheck) {
            val offset = i * 4
            if (expected.copyOfRange(offset, offset + 4).contentEquals(readBack.copyOfRange(offset, offset + 4))) {
                matchingPages++
            }
        }
        return matchingPages
    }

    override fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean {
        val cfg = config.writePublicData ?: return false

        if (cfg.authRequired) {
            if (!authenticate(tag, authData)) return false
        }

        // Escribir pagina por pagina desde startPage
        for (i in 0 until cfg.pages) {
            val page = cfg.startPage + i
            val offset = i * 4
            if (offset + 4 > publicData.size) break
            val pageData = publicData.copyOfRange(offset, offset + 4)
            if (!writePageNfcA(tag, page, pageData)) return false
        }
        return true
    }

    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        val cfg = config.configureAuth ?: return false

        // authConfig contiene los datos a escribir en cada pagina
        // El orden y offset estan definidos en cfg.pages
        for (pageCfg in cfg.pages) {
            val offset = pageCfg.dataOffset
            val length = pageCfg.dataLength
            if (offset + length > authConfig.size) {
                Log.w(TAG, "configureAuth: datos insuficientes para pagina ${pageCfg.page}")
                continue
            }
            val pageData = authConfig.copyOfRange(offset, offset + length)
            // Rellenar a 4 bytes si es necesario
            val fullPage = if (pageData.size < 4) {
                pageData.copyOf(4)
            } else if (pageData.size > 4) {
                pageData.copyOf(4)
            } else {
                pageData
            }
            if (!writePageNfcA(tag, pageCfg.page, fullPage)) {
                Log.w(TAG, "configureAuth: fallo escribiendo pagina ${pageCfg.page}")
                return false
            }
        }
        return true
    }

    override fun totalSlots(): Int = config.slots.total
    override fun activeSlots(): Int = config.slots.active

    override fun slotToStartPage(slot: Int): Int {
        val cfg = config.readCertificate ?: return config.memoryLayout.privateZoneStartPage + (slot * config.slots.pagesPerSlot)
        return calculateSlotPage(slot, cfg.slotToPageFormula)
    }

    override fun slotToEndPage(slot: Int): Int {
        return slotToStartPage(slot) + config.slots.pagesPerSlot - 1
    }

    // ===== Metodos privados =====

    /**
     * Autentica con la tarjeta segun el metodo definido en reader.json.
     */
    private fun authenticate(tag: Tag, authData: ByteArray): Boolean {
        val authCfg = config.auth ?: return true
        return when (authCfg.method) {
            "PWD_AUTH" -> authenticatePwd(tag, authData, authCfg)
            "3DES_AUTH" -> authenticate3Des(tag, authData, authCfg)
            "AES_AUTH" -> authenticateAes(tag, authData, authCfg)
            "KEY_A" -> authenticateKeyA(tag, authData, authCfg)
            "KEY_B" -> authenticateKeyB(tag, authData, authCfg)
            "none" -> true
            else -> {
                Log.w(TAG, "Metodo de auth no soportado: ${authCfg.method}")
                false
            }
        }
    }

    /**
     * PWD_AUTH para NTAG215/216 (comando 0x1B).
     */
    private fun authenticatePwd(tag: Tag, authData: ByteArray, authCfg: ReaderConfig.AuthConfig): Boolean {
        val nfcA = NfcA.get(tag) ?: return false
        try {
            nfcA.connect()
            // authData = PWD (4 bytes) + PACK esperado (2 bytes)
            if (authData.size < authCfg.pwdLength) return false
            val pwd = authData.copyOfRange(0, authCfg.pwdLength)
            val cmd = byteArrayOf(0x1B.toByte()) + pwd
            val response = nfcA.transceive(cmd)
            nfcA.close()
            if (authCfg.packVerify && authData.size >= authCfg.pwdLength + authCfg.packLength) {
                val expectedPack = authData.copyOfRange(authCfg.pwdLength, authCfg.pwdLength + authCfg.packLength)
                if (response.size < authCfg.packLength) return false
                val actualPack = response.copyOfRange(0, authCfg.packLength)
                return actualPack.contentEquals(expectedPack)
            }
            return response.isNotEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "authenticatePwd error", e)
            try { nfcA.close() } catch (_: Exception) {}
            return false
        }
    }

    /**
     * 3DES_AUTH para Ultralight C (comando 0x1A).
     */
    private fun authenticate3Des(tag: Tag, authData: ByteArray, authCfg: ReaderConfig.AuthConfig): Boolean {
        // Ultralight C usa MifareUltralight con comando nativo de auth
        // Implementacion simplificada — el reader built-in UltralightCReader
        // tiene la implementacion completa. Este motor es para tarjetas
        // que siguen el mismo patron.
        val nfcA = NfcA.get(tag) ?: return false
        try {
            nfcA.connect()
            // Enviar comando 0x1A (AUTH) con challenge
            val cmd = byteArrayOf(0x1A.toByte(), 0x00.toByte())
            val response = nfcA.transceive(cmd)
            nfcA.close()
            return response.isNotEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "authenticate3Des error", e)
            try { nfcA.close() } catch (_: Exception) {}
            return false
        }
    }

    private fun authenticateAes(tag: Tag, authData: ByteArray, authCfg: ReaderConfig.AuthConfig): Boolean {
        // AES auth no es soportado por el motor declarativo
        // Necesita un reader built-in (DESFire, MIFARE Plus)
        Log.w(TAG, "AES_AUTH no soportado por motor declarativo — usar reader built-in")
        return false
    }

    private fun authenticateKeyA(tag: Tag, authData: ByteArray, authCfg: ReaderConfig.AuthConfig): Boolean {
        return authenticateMifareClassic(tag, authData, true)
    }

    private fun authenticateKeyB(tag: Tag, authData: ByteArray, authCfg: ReaderConfig.AuthConfig): Boolean {
        return authenticateMifareClassic(tag, authData, false)
    }

    private fun authenticateMifareClassic(tag: Tag, key: ByteArray, useKeyA: Boolean): Boolean {
        val mifare = MifareClassic.get(tag) ?: return false
        try {
            mifare.connect()
            // Autenticar sector 0 con la clave
            val keyType = if (useKeyA) MifareClassic.KEY_DEFAULT else MifareClassic.KEY_DEFAULT
            // MifareClassic.authenticateSectorWithKeyA/B requiere el indice del sector
            // Para el motor declarativo, autenticamos el primer sector
            val result = if (useKeyA) {
                mifare.authenticateSectorWithKeyA(0, key)
            } else {
                mifare.authenticateSectorWithKeyB(0, key)
            }
            mifare.close()
            return result
        } catch (e: Exception) {
            Log.e(TAG, "authenticateMifareClassic error", e)
            try { mifare.close() } catch (_: Exception) {}
            return false
        }
    }

    /**
     * Lee una pagina via NfcA (comando READ = 0x30).
     */
    private fun readPageNfcA(tag: Tag, page: Int): ByteArray? {
        val nfcA = NfcA.get(tag) ?: return null
        try {
            nfcA.connect()
            val cmd = byteArrayOf(0x30.toByte(), page.toByte())
            val response = nfcA.transceive(cmd)
            nfcA.close()
            return response
        } catch (e: Exception) {
            Log.e(TAG, "readPageNfcA error page=$page", e)
            try { nfcA.close() } catch (_: Exception) {}
            return null
        }
    }

    /**
     * Lee multiples paginas via NfcA.
     * READ retorna 4 paginas (16 bytes) por comando.
     */
    private fun readPagesNfcA(tag: Tag, startPage: Int, pageCount: Int): ByteArray? {
        val nfcA = NfcA.get(tag) ?: return null
        try {
            nfcA.connect()
            val cmd = byteArrayOf(0x30.toByte(), startPage.toByte())
            val response = nfcA.transceive(cmd)
            nfcA.close()
            // READ retorna 16 bytes (4 paginas) por defecto
            return response
        } catch (e: Exception) {
            Log.e(TAG, "readPagesNfcA error startPage=$startPage", e)
            try { nfcA.close() } catch (_: Exception) {}
            return null
        }
    }

    /**
     * Escribe una pagina via NfcA (comando WRITE = 0xA2).
     * Cada WRITE es de 1 pagina de 4 bytes.
     */
    private fun writePageNfcA(tag: Tag, page: Int, data: ByteArray): Boolean {
        if (data.size != 4) return false
        val nfcA = NfcA.get(tag) ?: return false
        try {
            nfcA.connect()
            val cmd = byteArrayOf(0xA2.toByte(), page.toByte()) + data
            val response = nfcA.transceive(cmd)
            nfcA.close()
            // WRITE retorna ACK (0x0A) en NTAG
            return response.isNotEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "writePageNfcA error page=$page", e)
            try { nfcA.close() } catch (_: Exception) {}
            return false
        }
    }

    /**
     * Calcula la pagina inicial de un slot interpretando la formula.
     * Formula soportada: "private_zone_start + (slot * N)"
     */
    private fun calculateSlotPage(slot: Int, formula: String): Int {
        // Parsear formula simple: "private_zone_start + (slot * 4)"
        val privateStart = config.memoryLayout.privateZoneStartPage
        val pagesPerSlot = config.slots.pagesPerSlot

        // Intentar extraer el multiplicador de la formula
        val regex = Regex("""slot\s*\*\s*(\d+)""")
        val match = regex.find(formula)
        val multiplier = match?.groupValues?.get(1)?.toIntOrNull() ?: pagesPerSlot

        return privateStart + (slot * multiplier)
    }
}
