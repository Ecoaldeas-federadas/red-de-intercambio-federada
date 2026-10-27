package com.example.data.nfc

import android.nfc.Tag

/**
 * Interfaz comun para todos los lectores/escritores de tarjetas NFC.
 *
 * Cada tipo de tarjeta (MIFARE Classic, NTAG215, Ultralight C, DESFire, etc.)
 * implementa esta interfaz. El CardReaderRegistry detecta el tipo de tarjeta
 * y devuelve el reader apropiado.
 *
 * Para agregar una nueva tarjeta:
 * 1. Crear una clase que implemente CardReader
 * 2. Registrarla en CardReaderRegistry
 * 3. No se necesita modificar ningun otro archivo
 */
interface CardReader {

    /** Tipo de tarjeta (ej. "classic", "ntag215", "ultralight_c", "desfire"). */
    val cardType: String

    /** Nombre para mostrar (ej. "MIFARE Classic 1K"). */
    val displayName: String

    /**
     * Verifica si este reader puede manejar el tag detectado.
     * Se basa en tag.techList y/o propiedades del tag.
     */
    fun canHandle(tag: Tag): Boolean

    /**
     * Lee el UID del tag en formato hex (ej. "AABBCCDD").
     */
    fun readUid(tag: Tag): String

    /**
     * Lee un certificado de 16 bytes de un slot especifico.
     *
     * @param tag Tag fisico detectado
     * @param slot Numero de slot a leer
     * @param authData Datos de autenticacion (clave, PWD, etc.) en bytes
     * @return Certificado de 16 bytes, o null si falla
     */
    fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray?

    /**
     * Escribe un certificado de 16 bytes en un slot especifico.
     *
     * @param tag Tag fisico detectado
     * @param slot Numero de slot a escribir
     * @param certificate Certificado de 16 bytes
     * @param authData Datos de autenticacion (clave, PWD, etc.) en bytes
     * @return true si se escribio correctamente
     */
    fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean

    /**
     * Verifica que un certificado se haya escrito correctamente re-leyendo el slot.
     *
     * @param tag Tag fisico detectado
     * @param slot Numero de slot a verificar
     * @param expected Certificado esperado
     * @param authData Datos de autenticacion
     * @return Numero de paginas/bloques que coinciden (0 = fallo total)
     */
    fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int

    /**
     * Escribe datos publicos (custom_card_id) en la zona publica del tag.
     * Solo se usa durante el provisionamiento.
     *
     * @param tag Tag fisico detectado
     * @param publicData Datos publicos a escribir
     * @param authData Datos de autenticacion
     * @return true si se escribio correctamente
     */
    fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean

    /**
     * Configura la autenticacion de la tarjeta durante el provisionamiento.
     * (ej. set PWD+PACK en NTAG215, set 3DES key en Ultralight C).
     *
     * @param tag Tag fisico detectado
     * @param authConfig Configuracion de autenticacion (PWD, clave, etc.)
     * @return true si se configuro correctamente
     */
    fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean

    /**
     * Retorna el numero total de slots soportados por esta tarjeta.
     */
    fun totalSlots(): Int

    /**
     * Retorna el numero de slots activos (no backups).
     */
    fun activeSlots(): Int

    /**
     * Convierte un numero de slot a su pagina/bloque inicial.
     */
    fun slotToStartPage(slot: Int): Int

    /**
     * Convierte un numero de slot a su pagina/bloque final (inclusivo).
     */
    fun slotToEndPage(slot: Int): Int
}
