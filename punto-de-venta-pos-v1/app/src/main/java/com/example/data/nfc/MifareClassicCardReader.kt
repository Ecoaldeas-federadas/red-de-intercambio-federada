package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.MifareClassic
import com.example.data.crypto.CryptoEngine
import java.io.IOException

/**
 * Adapter que envuelve MifareClassicReader existente para implementar CardReader.
 *
 * MIFARE Classic 1K:
 * - 15 sectores usables (1-15), sector 0 es read-only
 * - Cada sector: 4 bloques de 16 bytes (3 datos + 1 trailer)
 * - Key A = lectura, Key B = escritura
 * - Crypto1 48-bit (roto, pero ampliamente disponible)
 * - No soportado en Google Pixel ni iOS
 */
class MifareClassicCardReader(
    private val inner: MifareClassicReader = MifareClassicReader()
) : CardReader {

    override val cardType: String = "classic"
    override val displayName: String = "MIFARE Classic 1K"

    override fun canHandle(tag: Tag): Boolean {
        return tag.techList.any { it == "android.nfc.tech.MifareClassic" }
    }

    override fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    /**
     * Lee el certificado de un sector usando Key A.
     * authData = Key A (6 bytes).
     * Retorna el primer bloque que contenga datos (triple redundancia).
     */
    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        // slot = sector number (1-15)
        val blocks = inner.readSectorBlocks(tag, slot, authData) ?: return null
        // Retornar el primer bloque (copia 1 del certificado)
        return blocks.firstOrNull()
    }

    /**
     * Escribe el certificado en los 3 bloques de datos del sector usando Key B.
     * authData = Key B (6 bytes).
     */
    override fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean {
        return inner.writeSectorBlocks(tag, slot, certificate, authData)
    }

    /**
     * Verifica cuantos bloques coinciden con el certificado esperado.
     * authData = Key A (6 bytes).
     */
    override fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int {
        return inner.verifyWrite(tag, slot, authData, expected)
    }

    /**
     * En Classic no hay zona publica separada. El UID es publico por defecto.
     */
    override fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean {
        // Classic no tiene zona publica configurable
        return true
    }

    /**
     * En Classic, la autenticacion se configura escribiendo el sector trailer.
     * authConfig = sector trailer completo (16 bytes) o datos del sector.
     * Esto se maneja via writeFullSector del reader interno.
     */
    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        // El provisionamiento Classic se maneja via writeFullSector
        // que ya esta implementado en MifareClassicReader
        return true
    }

    override fun totalSlots(): Int = 15
    override fun activeSlots(): Int = 15

    /**
     * En Classic, el slot es el numero de sector (1-15).
     * El bloque inicial = sector * 4 (para sector 1 = bloque 4).
     */
    override fun slotToStartPage(slot: Int): Int {
        return slot * 4
    }

    override fun slotToEndPage(slot: Int): Int {
        return slotToStartPage(slot) + 2 // bloques 0,1,2 (3 bloques de datos)
    }
}
