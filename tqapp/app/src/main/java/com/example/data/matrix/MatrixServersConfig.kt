package com.example.data.matrix

/**
 * =========================================================================
 * LISTA DE SERVIDORES MATRIX PROPUESTOS (CONFIGURABLE)
 * =========================================================================
 * Puedes modificar esta lista para agregar tus propios servidores privados,
 * servidores comunitarios o de tu organización para futuras compilaciones.
 */
data class MatrixServer(
    val id: String,
    val name: String,
    val url: String,
    val description: String,
    val isDefault: Boolean = false,
    val allowsPublicRegistration: Boolean = true
)

object MatrixServersConfig {
    /**
     * Lista inicial de servidores Matrix públicos y comunitarios.
     * Modifica o añade elementos aquí en cualquier momento.
     */
    val PROPOSED_SERVERS: List<MatrixServer> = listOf(
        MatrixServer(
            id = "matrix_org",
            name = "Matrix.org",
            url = "https://matrix.org",
            description = "Servidor público principal (registro vía portal web oficial)",
            isDefault = true,
            allowsPublicRegistration = true
        ),
        MatrixServer(
            id = "mozilla",
            name = "Mozilla Matrix",
            url = "https://mozilla.modular.im",
            description = "Servidor federado de la comunidad Mozilla",
            allowsPublicRegistration = false
        ),
        MatrixServer(
            id = "kde",
            name = "KDE Community",
            url = "https://kde.org",
            description = "Servidor abierto de desarrollo KDE",
            allowsPublicRegistration = true
        ),
        MatrixServer(
            id = "gnome",
            name = "GNOME Foundation",
            url = "https://gnome.org",
            description = "Servidor federado de la comunidad GNOME",
            allowsPublicRegistration = false
        ),
        MatrixServer(
            id = "envs_net",
            name = "Envs.net",
            url = "https://envs.net",
            description = "Servidor federado independiente y libre",
            allowsPublicRegistration = true
        ),
        MatrixServer(
            id = "tchncs",
            name = "Tchncs.de",
            url = "https://tchncs.de",
            description = "Servidor comunitario federado en Alemania",
            allowsPublicRegistration = true
        ),
        MatrixServer(
            id = "nitro_chat",
            name = "Nitro.chat",
            url = "https://nitro.chat",
            description = "Servidor federado de alto rendimiento",
            allowsPublicRegistration = true
        ),
        MatrixServer(
            id = "ethz",
            name = "ETH Zürich",
            url = "https://matrix.ethz.ch",
            description = "Servidor académico federado en Suiza",
            allowsPublicRegistration = false
        )
    )

    fun getDefaultServer(): MatrixServer {
        return PROPOSED_SERVERS.firstOrNull { it.isDefault } ?: PROPOSED_SERVERS.first()
    }

    fun cleanUrl(rawUrl: String): String {
        var cleaned = rawUrl.trim()
        if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
            cleaned = "https://$cleaned"
        }
        if (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length - 1)
        }
        return cleaned
    }
}
