package com.example.data.nfc

import android.nfc.Tag
import android.util.Log
import com.example.data.crypto.CryptoEngine

/**
 * Registry central de lectores de tarjetas NFC.
 *
 * Detecta el tipo de tarjeta desde tag.techList y devuelve el CardReader
 * apropiado.
 *
 * Soporta dos tipos de readers:
 * 1. Built-in: compilados en el APK (MifareClassic, Ntag215, UltralightC, Desfire).
 *    Siempre disponibles. Tienen prioridad sobre los dinamicos.
 * 2. Dinamicos: cargados desde reader.json (descargados del servidor).
 *    Se interpretan con CardReaderEngine. No requieren recompilar el APK.
 *
 * Uso:
 *   val reader = CardReaderRegistry.detectReader(tag)
 *   if (reader != null) {
 *       val uid = reader.readUid(tag)
 *       val cert = reader.readCertificate(tag, slot, authData)
 *   }
 */
object CardReaderRegistry {

    private const val TAG = "CardReaderRegistry"

    private val builtinReaders = mutableListOf<CardReader>()
    private val dynamicReaders = mutableListOf<CardReader>()
    private val allReaders: List<CardReader>
        get() = builtinReaders + dynamicReaders

    init {
        // Registrar readers built-in (compilados)
        builtinReaders.add(MifareClassicCardReader())
        builtinReaders.add(Ntag215Reader())
        builtinReaders.add(UltralightCReader())
        builtinReaders.add(DesfireCardReader())

        // Cargar readers dinamicos desde el store local
        reloadDynamicReaders()
    }

    /**
     * Recarga los readers dinamicos desde CardReaderConfigStore.
     * Se llama al iniciar y despues de syncCardDrivers().
     */
    fun reloadDynamicReaders() {
        dynamicReaders.clear()
        if (!CardReaderConfigStore.isInitialized()) {
            Log.w(TAG, "CardReaderConfigStore no inicializado — readers dinamicos no disponibles")
            return
        }
        val configs = CardReaderConfigStore.getAll()
        for (config in configs) {
            // No duplicar si ya hay un built-in con el mismo tipo
            if (builtinReaders.none { it.cardType == config.type }) {
                dynamicReaders.add(CardReaderEngine(config))
                Log.i(TAG, "Reader dinamico cargado: ${config.type}")
            }
        }
    }

    /**
     * Registra un nuevo reader built-in. Se llama automaticamente desde init.
     */
    fun register(reader: CardReader) {
        if (builtinReaders.none { it.cardType == reader.cardType }) {
            builtinReaders.add(reader)
        }
    }

    /**
     * Detecta el tipo de tarjeta y devuelve el reader apropiado.
     * Retorna null si no hay reader que pueda manejar el tag.
     * Prioridad: built-in primero, luego dinamicos.
     */
    fun detectReader(tag: Tag): CardReader? {
        // Probar built-in primero
        for (reader in builtinReaders) {
            if (reader.canHandle(tag)) return reader
        }
        // Luego dinamicos
        for (reader in dynamicReaders) {
            if (reader.canHandle(tag)) return reader
        }
        return null
    }

    /**
     * Retorna el reader por tipo de tarjeta, o null si no esta registrado.
     */
    fun getReader(cardType: String): CardReader? {
        return allReaders.firstOrNull { it.cardType == cardType }
    }

    /**
     * Retorna la lista de todos los readers registrados (built-in + dinamicos).
     */
    fun listReaders(): List<CardReader> {
        return allReaders
    }

    /**
     * Verifica si un tipo de tarjeta esta soportado.
     */
    fun isSupported(cardType: String): Boolean {
        return allReaders.any { it.cardType == cardType }
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

    /**
     * Retorna la lista de tipos de tarjeta soportados dinamicamente.
     */
    fun listDynamicTypes(): List<String> {
        return dynamicReaders.map { it.cardType }
    }
}
