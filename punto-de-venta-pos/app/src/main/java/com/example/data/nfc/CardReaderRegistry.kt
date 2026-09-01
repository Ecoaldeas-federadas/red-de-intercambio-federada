package com.example.data.nfc

import android.nfc.Tag
import com.example.data.crypto.CryptoEngine

/**
 * Registry central de lectores de tarjetas NFC.
 *
 * Detecta el tipo de tarjeta desde tag.techList y devuelve el CardReader
 * apropiado. Para agregar una nueva tarjeta, solo se registra su reader aqui.
 *
 * Uso:
 *   val reader = CardReaderRegistry.detectReader(tag)
 *   if (reader != null) {
 *       val uid = reader.readUid(tag)
 *       val cert = reader.readCertificate(tag, slot, authData)
 *   }
 */
object CardReaderRegistry {

    private val readers = mutableListOf<CardReader>()

    init {
        // Registrar todos los readers soportados
        register(MifareClassicCardReader())
        register(Ntag215Reader())
        register(UltralightCReader())
        register(DesfireCardReader())
    }

    /**
     * Registra un nuevo reader. Se llama automaticamente desde el init,
     * pero puede usarse para agregar readers dinamicamente.
     */
    fun register(reader: CardReader) {
        // No duplicar
        if (readers.none { it.cardType == reader.cardType }) {
            readers.add(reader)
        }
    }

    /**
     * Detecta el tipo de tarjeta y devuelve el reader apropiado.
     * Retorna null si no hay reader que pueda manejar el tag.
     */
    fun detectReader(tag: Tag): CardReader? {
        return readers.firstOrNull { it.canHandle(tag) }
    }

    /**
     * Retorna el reader por tipo de tarjeta, o null si no esta registrado.
     */
    fun getReader(cardType: String): CardReader? {
        return readers.firstOrNull { it.cardType == cardType }
    }

    /**
     * Retorna la lista de todos los readers registrados.
     */
    fun listReaders(): List<CardReader> {
        return readers.toList()
    }

    /**
     * Verifica si un tipo de tarjeta esta soportado.
     */
    fun isSupported(cardType: String): Boolean {
        return readers.any { it.cardType == cardType }
    }

    /**
     * Lee el UID de cualquier tag detectado, sin necesidad de saber el tipo.
     */
    fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    /**
     * Detecta el tipo de tarjeta desde el tag y retorna su cardType.
     * Retorna null si no se puede determinar.
     */
    fun detectCardType(tag: Tag): String? {
        return detectReader(tag)?.cardType
    }
}
