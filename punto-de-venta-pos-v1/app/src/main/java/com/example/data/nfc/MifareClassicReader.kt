package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.MifareClassic
import com.example.data.crypto.CryptoEngine
import java.io.IOException

/**
 * Lector/escritor para tarjetas MIFARE Classic 1K.
 *
 * Modelo de seguridad:
 * - 15 sectores (1-15), cada uno con claves A/B unicas.
 * - Sector 0 es read-only (UID de fabrica).
 * - Cada sector tiene 4 bloques de 16 bytes:
 *     Bloque 0: copia 1 del certificado
 *     Bloque 1: copia 2 del certificado
 *     Bloque 2: copia 3 del certificado
 *     Bloque 3: SECTOR TRAILER (Key A + Access Bits + Key B) - NUNCA se escribe en caliente
 * - Key A = lectura, Key B = escritura.
 */
class MifareClassicReader {

    /**
     * Verifica si el tag soporta MIFARE Classic.
     * Nota: No todos los telefonos Android soportan MIFARE Classic
     * (Samsung si, Google Pixel no).
     */
    fun isMifareClassic(tag: Tag): Boolean {
        return tag.techList.any { it == "android.nfc.tech.MifareClassic" }
    }

    /**
     * Lee el UID del sector 0 (read-only, no requiere autenticacion).
     * Retorna el UID en hex (ej. "AABBCCDD").
     */
    fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    /**
     * Lee los bloques 0, 1, 2 de un sector usando Key A.
     * Retorna 3 bloques de 16 bytes cada uno, o null si falla.
     *
     * Triple redundancia: los 3 bloques deberian contener el mismo certificado.
     */
    fun readSectorBlocks(tag: Tag, sector: Int, keyA: ByteArray): List<ByteArray>? {
        val mifare = MifareClassic.get(tag) ?: return null
        try {
            mifare.connect()
            val firstBlock = mifare.sectorToBlock(sector)

            // Autenticar con Key A
            if (!mifare.authenticateSectorWithKeyA(sector, keyA)) {
                return null
            }

            val blocks = mutableListOf<ByteArray>()
            // Leer bloques 0, 1, 2 del sector (firstBlock, firstBlock+1, firstBlock+2)
            for (i in 0 until 3) {
                val blockData = mifare.readBlock(firstBlock + i)
                blocks.add(blockData)
            }
            return blocks
        } catch (e: IOException) {
            return null
        } finally {
            try {
                mifare.close()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Escribe el mismo certificado (16 bytes) en los bloques 0, 1, 2 de un sector
     * usando Key B.
     *
     * NUNCA escribe el bloque 3 (sector trailer) para evitar corrupcion.
     * Retorna true si los 3 bloques se escribieron correctamente.
     */
    fun writeSectorBlocks(tag: Tag, sector: Int, data: ByteArray, keyB: ByteArray): Boolean {
        if (data.size != 16) return false

        val mifare = MifareClassic.get(tag) ?: return false
        try {
            mifare.connect()
            val firstBlock = mifare.sectorToBlock(sector)

            // Autenticar con Key B
            if (!mifare.authenticateSectorWithKeyB(sector, keyB)) {
                return false
            }

            // Escribir bloques 0, 1, 2
            for (i in 0 until 3) {
                mifare.writeBlock(firstBlock + i, data)
            }
            return true
        } catch (e: IOException) {
            return false
        } finally {
            try {
                mifare.close()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Re-lee los 3 bloques de un sector y verifica cuantos coinciden
     * con el certificado esperado.
     *
     * Retorna el numero de bloques que coinciden (0-3).
     */
    fun verifyWrite(tag: Tag, sector: Int, keyA: ByteArray, expected: ByteArray): Int {
        val blocks = readSectorBlocks(tag, sector, keyA) ?: return 0
        var matches = 0
        for (block in blocks) {
            if (block.contentEquals(expected)) {
                matches++
            }
        }
        return matches
    }

    /**
     * Verifica si al menos uno de los 3 bloques coincide con el certificado esperado.
     * Esto se usa para la lectura del sector activo: si al menos 1 bloque coincide,
     * el certificado es valido (triple redundancia).
     */
    fun verifyCertificate(blocks: List<ByteArray>, expected: ByteArray): Boolean {
        return blocks.any { it.contentEquals(expected) }
    }

    /**
     * Escribe un sector completo durante el provisionamiento.
     * Esto incluye el bloque 3 (sector trailer) con Key A, Access Bits y Key B.
     *
     * SOLO se usa durante el provisionamiento inicial en una maquina dedicada.
     * NUNCA se usa en transacciones en caliente.
     *
     * Estructura del bloque 3 (trailer):
     *   Bytes 0-5: Key A (6 bytes)
     *   Bytes 6-8: Access Bits (3 bytes)
     *   Byte 9:    User byte / GPB
     *   Bytes 10-15: Key B (6 bytes)
     */
    fun writeFullSector(
        tag: Tag,
        sector: Int,
        keyA: ByteArray,
        keyB: ByteArray,
        accessBits: ByteArray,
        certificate: ByteArray
    ): Boolean {
        if (keyA.size != 6 || keyB.size != 6 || accessBits.size != 4 || certificate.size != 16) {
            return false
        }

        val mifare = MifareClassic.get(tag) ?: return false
        try {
            mifare.connect()
            val firstBlock = mifare.sectorToBlock(sector)

            // Autenticar con Key B (necesaria para escribir trailer)
            // Usar Key B para autenticar. Si la tarjeta es nueva, usar default keys.
            if (!mifare.authenticateSectorWithKeyB(sector, keyB)) {
                // Intentar con default key B (0xFF * 6)
                val defaultKeyB = ByteArray(6) { 0xFF.toByte() }
                if (!mifare.authenticateSectorWithKeyB(sector, defaultKeyB)) {
                    return false
                }
            }

            // Construir el sector trailer (bloque 3)
            // Formato: Key A (6) + Access Bits (3) + GPB (1) + Key B (6) = 16 bytes
            val trailer = ByteArray(16)
            System.arraycopy(keyA, 0, trailer, 0, 6)
            // Access bits: los 3 bytes relevantes de accessBits (posiciones 1,2,3)
            trailer[6] = accessBits[1]
            trailer[7] = accessBits[2]
            trailer[8] = accessBits[3]
            trailer[9] = accessBits[0] // GPB / byte de usuario
            System.arraycopy(keyB, 0, trailer, 10, 6)

            // Escribir trailer (bloque 3)
            mifare.writeBlock(firstBlock + 3, trailer)

            // Escribir certificado en bloques 0, 1, 2
            for (i in 0 until 3) {
                mifare.writeBlock(firstBlock + i, certificate)
            }
            return true
        } catch (e: IOException) {
            return false
        } finally {
            try {
                mifare.close()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Cuenta cuantos bloques de un sector coinciden con el certificado esperado.
     * Usa Key A para leer. Retorna 0-3.
     */
    fun countMatchingBlocks(tag: Tag, sector: Int, keyA: ByteArray, expected: ByteArray): Int {
        return verifyWrite(tag, sector, keyA, expected)
    }
}
