package com.example.data.nfc

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistencia local de configuraciones reader.json descargadas del servidor.
 *
 * Los reader.json se guardan en SharedPreferences para que esten disponibles
 * offline. El CardReaderRegistry los carga al iniciar y cuando se sincronizan.
 */
object CardReaderConfigStore {

    private const val PREFS_NAME = "nfc_reader_configs"
    private const val KEY_PREFIX = "reader_"
    private const val KEY_TYPES = "reader_types"

    private lateinit var prefs: SharedPreferences

    /**
     * Inicializa el store con el contexto de la aplicacion.
     * Se llama desde Application.onCreate() o al iniciar el POS.
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Guarda un reader.json por tipo de tarjeta.
     */
    fun save(cardType: String, readerJson: String) {
        val types = getTypes().toMutableSet()
        types.add(cardType)
        prefs.edit()
            .putString(KEY_PREFIX + cardType, readerJson)
            .putStringSet(KEY_TYPES, types)
            .apply()
    }

    /**
     * Obtiene el reader.json de un tipo de tarjeta, o null si no existe.
     */
    fun get(cardType: String): String? {
        return prefs.getString(KEY_PREFIX + cardType, null)
    }

    /**
     * Obtiene el ReaderConfig parseado de un tipo de tarjeta, o null.
     */
    fun getConfig(cardType: String): ReaderConfig? {
        val json = get(cardType) ?: return null
        return ReaderConfig.fromJson(json)
    }

    /**
     * Retorna todos los ReaderConfig guardados localmente.
     */
    fun getAll(): List<ReaderConfig> {
        val configs = mutableListOf<ReaderConfig>()
        for (type in getTypes()) {
            getConfig(type)?.let { configs.add(it) }
        }
        return configs
    }

    /**
     * Remueve un reader.json por tipo de tarjeta.
     */
    fun remove(cardType: String) {
        val types = getTypes().toMutableSet()
        types.remove(cardType)
        prefs.edit()
            .remove(KEY_PREFIX + cardType)
            .putStringSet(KEY_TYPES, types)
            .apply()
    }

    /**
     * Remueve todos los reader.json guardados.
     */
    fun clear() {
        prefs.edit().clear().apply()
    }

    /**
     * Retorna la lista de tipos de tarjeta con reader.json guardados.
     */
    fun getTypes(): Set<String> {
        return prefs.getStringSet(KEY_TYPES, emptySet()) ?: emptySet()
    }

    /**
     * Verifica si el store ha sido inicializado.
     */
    fun isInitialized(): Boolean {
        return ::prefs.isInitialized
    }
}
