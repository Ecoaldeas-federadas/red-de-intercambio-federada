package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.IsoDep
import com.example.data.crypto.CryptoEngine

/**
 * Reader placeholder para MIFARE DESFire EV3.
 *
 * DESFire usa AES-128 real y no necesita certificados rotativos.
 * La implementacion completa del protocolo AES se hara en el futuro.
 *
 * Por ahora, este reader solo detecta DESFire y lee el UID.
 */
class DesfireCardReader : CardReader {

    override val cardType: String = "desfire"
    override val displayName: String = "MIFARE DESFire EV3"

    override fun canHandle(tag: Tag): Boolean {
        return tag.techList.any {
            it.contains("IsoDep", ignoreCase = true) || it.contains("Desfire", ignoreCase = true)
        }
    }

    override fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        // DESFire no usa certificados rotativos — usa AES-128
        // TODO: Implementar protocolo AES DESFire
        return null
    }

    override fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean {
        // DESFire no usa certificados rotativos — usa AES-128
        // TODO: Implementar protocolo AES DESFire
        return false
    }

    override fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int {
        return 0
    }

    override fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean {
        // TODO: Implementar escritura de datos publicos DESFire
        return false
    }

    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        // TODO: Implementar configuracion AES DESFire
        return false
    }

    override fun totalSlots(): Int = 0 // DESFire no usa slots
    override fun activeSlots(): Int = 0

    override fun slotToStartPage(slot: Int): Int = 0
    override fun slotToEndPage(slot: Int): Int = 0
}
