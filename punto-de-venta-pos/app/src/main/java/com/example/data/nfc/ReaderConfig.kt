package com.example.data.nfc

import org.json.JSONObject

/**
 * Configuracion declarativa de un reader NFC, cargada desde reader.json.
 *
 * El POS Android NO ejecuta JavaScript. En cambio, interpreta reader.json
 * que describe como leer/escribir la tarjeta usando comandos NFC estandar.
 *
 * Esto permite agregar soporte para nuevas tarjetas sin recompilar el APK:
 * el servidor descarga reader.json y el CardReaderEngine lo interpreta.
 */
data class ReaderConfig(
    val type: String,
    val displayName: String,
    val detection: DetectionConfig,
    val uid: UidConfig,
    val auth: AuthConfig?,
    val readCertificate: ReadCertificateConfig?,
    val writeCertificate: WriteCertificateConfig?,
    val writePublicData: WritePublicDataConfig?,
    val configureAuth: ConfigureAuthConfig?,
    val memoryLayout: MemoryLayoutConfig,
    val slots: SlotsConfig
) {

    data class DetectionConfig(
        val techList: List<String>,
        val sak: Int? = null,
        val atqa: String? = null,
        val identifyCommand: IdentifyCommandConfig? = null
    )

    data class IdentifyCommandConfig(
        val opcode: String,
        val expectedResponsePrefix: String
    )

    data class UidConfig(
        val method: String,  // "tag_id", "read_page_0"
        val format: String   // "hex"
    )

    data class AuthConfig(
        val method: String,       // "PWD_AUTH", "3DES_AUTH", "AES_AUTH", "KEY_A", "KEY_B", "none"
        val commandOpcode: String?,
        val pwdOffset: Int,
        val pwdLength: Int,
        val packLength: Int,
        val packVerify: Boolean
    )

    data class ReadCertificateConfig(
        val method: String,           // "READ"
        val commandOpcode: String,
        val pagesPerRead: Int,
        val bytesPerCertificate: Int,
        val slotToPageFormula: String,
        val authRequired: Boolean
    )

    data class WriteCertificateConfig(
        val method: String,           // "WRITE"
        val commandOpcode: String,
        val pagesPerWrite: Int,
        val writesPerCertificate: Int,
        val slotToPageFormula: String,
        val authRequired: Boolean,
        val verifyAfterWrite: Boolean
    )

    data class WritePublicDataConfig(
        val method: String,
        val commandOpcode: String,
        val startPage: Int,
        val pages: Int,
        val authRequired: Boolean
    )

    data class ConfigureAuthConfig(
        val method: String,           // "WRITE_MULTIPLE"
        val pages: List<ConfigPage>,
        val authRequired: Boolean,
        val notes: String?
    )

    data class ConfigPage(
        val page: Int,
        val dataOffset: Int,
        val dataLength: Int,
        val description: String?
    )

    data class MemoryLayoutConfig(
        val publicZoneStartPage: Int,
        val publicZoneEndPage: Int,
        val privateZoneStartPage: Int,
        val privateZoneEndPage: Int,
        val configZoneStartPage: Int?
    )

    data class SlotsConfig(
        val total: Int,
        val active: Int,
        val backup: Int,
        val certificateSize: Int,
        val pagesPerSlot: Int
    )

    companion object {
        /**
         * Parsea reader.json desde un string JSON.
         */
        fun fromJson(jsonStr: String): ReaderConfig? {
            return try {
                val json = JSONObject(jsonStr)
                val detection = json.getJSONObject("detection")
                val uid = json.getJSONObject("uid")
                val memoryLayout = json.getJSONObject("memory_layout")
                val slots = json.getJSONObject("slots")

                val auth = json.optJSONObject("auth")?.let {
                    AuthConfig(
                        method = it.getString("method"),
                        commandOpcode = it.optString("command_opcode", null),
                        pwdOffset = it.optInt("pwd_offset", 0),
                        pwdLength = it.optInt("pwd_length", 4),
                        packLength = it.optInt("pack_length", 2),
                        packVerify = it.optBoolean("pack_verify", true)
                    )
                }

                val readCert = json.optJSONObject("read_certificate")?.let {
                    ReadCertificateConfig(
                        method = it.getString("method"),
                        commandOpcode = it.getString("command_opcode"),
                        pagesPerRead = it.optInt("pages_per_read", 4),
                        bytesPerCertificate = it.optInt("bytes_per_certificate", 16),
                        slotToPageFormula = it.getString("slot_to_page_formula"),
                        authRequired = it.optBoolean("auth_required", true)
                    )
                }

                val writeCert = json.optJSONObject("write_certificate")?.let {
                    WriteCertificateConfig(
                        method = it.getString("method"),
                        commandOpcode = it.getString("command_opcode"),
                        pagesPerWrite = it.optInt("pages_per_write", 1),
                        writesPerCertificate = it.optInt("writes_per_certificate", 4),
                        slotToPageFormula = it.getString("slot_to_page_formula"),
                        authRequired = it.optBoolean("auth_required", true),
                        verifyAfterWrite = it.optBoolean("verify_after_write", true)
                    )
                }

                val writePublic = json.optJSONObject("write_public_data")?.let {
                    WritePublicDataConfig(
                        method = it.getString("method"),
                        commandOpcode = it.getString("command_opcode"),
                        startPage = it.optInt("start_page", 4),
                        pages = it.optInt("pages", 6),
                        authRequired = it.optBoolean("auth_required", false)
                    )
                }

                val configureAuth = json.optJSONObject("configure_auth")?.let {
                    val pagesArr = it.getJSONArray("pages")
                    val pages = mutableListOf<ConfigPage>()
                    for (i in 0 until pagesArr.length()) {
                        val p = pagesArr.getJSONObject(i)
                        pages.add(ConfigPage(
                            page = p.getInt("page"),
                            dataOffset = p.getInt("data_offset"),
                            dataLength = p.getInt("data_length"),
                            description = p.optString("description", null)
                        ))
                    }
                    ConfigureAuthConfig(
                        method = it.getString("method"),
                        pages = pages,
                        authRequired = it.optBoolean("auth_required", false),
                        notes = it.optString("notes", null)
                    )
                }

                val techList = mutableListOf<String>()
                val techArr = detection.getJSONArray("tech_list")
                for (i in 0 until techArr.length()) {
                    techList.add(techArr.getString(i))
                }

                ReaderConfig(
                    type = json.getString("type"),
                    displayName = json.getString("display_name"),
                    detection = DetectionConfig(
                        techList = techList,
                        sak = if (detection.has("sak")) detection.getInt("sak") else null,
                        atqa = detection.optString("atqa", null),
                        identifyCommand = detection.optJSONObject("identify_command")?.let {
                            IdentifyCommandConfig(
                                opcode = it.getString("opcode"),
                                expectedResponsePrefix = it.getString("expected_response_prefix")
                            )
                        }
                    ),
                    uid = UidConfig(
                        method = uid.getString("method"),
                        format = uid.optString("format", "hex")
                    ),
                    auth = auth,
                    readCertificate = readCert,
                    writeCertificate = writeCert,
                    writePublicData = writePublic,
                    configureAuth = configureAuth,
                    memoryLayout = MemoryLayoutConfig(
                        publicZoneStartPage = memoryLayout.getInt("public_zone_start_page"),
                        publicZoneEndPage = memoryLayout.getInt("public_zone_end_page"),
                        privateZoneStartPage = memoryLayout.getInt("private_zone_start_page"),
                        privateZoneEndPage = memoryLayout.getInt("private_zone_end_page"),
                        configZoneStartPage = if (memoryLayout.has("config_zone_start_page")) memoryLayout.getInt("config_zone_start_page") else null
                    ),
                    slots = SlotsConfig(
                        total = slots.getInt("total"),
                        active = slots.getInt("active"),
                        backup = slots.getInt("backup"),
                        certificateSize = slots.getInt("certificate_size"),
                        pagesPerSlot = slots.getInt("pages_per_slot")
                    )
                )
            } catch (e: Exception) {
                null
            }
        }
    }
}
