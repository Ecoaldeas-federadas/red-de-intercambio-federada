package com.example.data.matrix

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.matrix.rustcomponents.sdk.Client
import org.matrix.rustcomponents.sdk.ClientBuilder
import org.matrix.rustcomponents.sdk.LogLevel
import org.matrix.rustcomponents.sdk.Session
import org.matrix.rustcomponents.sdk.SessionVerificationController
import org.matrix.rustcomponents.sdk.SlidingSyncVersion
import org.matrix.rustcomponents.sdk.SyncService
import org.matrix.rustcomponents.sdk.TracingConfiguration
import org.matrix.rustcomponents.sdk.initPlatform
import java.io.File

/**
 * Owns the Rust SDK Client lifecycle: build, login, session persistence and
 * restore. The SDK keeps its own encrypted store (same as Element X), so chats
 * and crypto keys persist locally without any manual database work.
 */
class MatrixSessionManager(private val context: Context) {

    companion object {
        private const val TAG = "MatrixAuth"
    }

    private val sessionFile = File(context.filesDir, "session.json")
    private val dataPath = File(context.filesDir, "matrix_store").absolutePath
    private val cachePath = File(context.cacheDir, "matrix_cache").absolutePath
    /** Directory where downloaded media (decrypted attachments) is cached. */
    val mediaCachePath = File(context.cacheDir, "matrix_media").absolutePath
    /** App context for content resolver access (URI → file copies). */
    val appContext: Context get() = context

    @Volatile
    private var platformInitialized = false

    var client: Client? = null
        private set
    var syncService: SyncService? = null
        private set
    var verificationController: SessionVerificationController? = null
        private set

    /**
     * The Rust SDK needs initPlatform() exactly once per process: it sets up the
     * tokio runtime and the Android TLS verifier (rustls-platform-verifier).
     * Without it every SDK network call fails.
     */
    private fun ensurePlatformInitialized() {
        if (platformInitialized) return
        try {
            initPlatform(
                TracingConfiguration(
                    logLevel = LogLevel.DEBUG,
                    traceLogPacks = emptyList(),
                    extraTargets = listOf(
                        "matrix_sdk::http_client",
                        "matrix_sdk_ffi::client",
                        "reqwest",
                        "hyper",
                        "hyper_util",
                        "rustls"
                    ),
                    writeToStdoutOrSystem = true,
                    writeToFiles = null,
                    sentryConfig = null
                ),
                false
            )
            platformInitialized = true
            Log.i(TAG, "SDK platform initialized")
        } catch (e: Exception) {
            // "logger already initialized" means another call already did it
            if (e.message?.contains("already initialized") == true) {
                platformInitialized = true
            } else {
                throw e
            }
        }
    }

    private suspend fun buildClient(homeserverUrl: String): Client {
        ensurePlatformInitialized()
        return ClientBuilder()
            .sessionPaths(dataPath, cachePath)
            .serverNameOrHomeserverUrl(homeserverUrl)
            .autoEnableCrossSigning(true)
            .autoEnableBackups(true)
            .systemIsMemoryConstrained()
            .userAgent("TqApp Android")
            .build()
    }

    fun hasSavedSession(): Boolean = sessionFile.exists()

    /** Device ID of the persisted session, so re-login reuses it instead of
     * creating a brand-new (unverified, unnamed) device on the server. */
    fun savedDeviceId(): String? = try {
        if (!sessionFile.exists()) null
        else JSONObject(sessionFile.readText()).optString("device_id").ifBlank { null }
    } catch (_: Exception) {
        null
    }

    /** Password login through the SDK. Persists the session on success. */
    suspend fun loginWithPassword(serverUrl: String, username: String, password: String) {
        val cleanUrl = MatrixServersConfig.cleanUrl(serverUrl)
        val c = buildClient(cleanUrl)
        c.login(username, password, "TqApp Android", null)
        client = c
        persistSession(c.session())
        MatrixApiClient.defaultHomeserver = cleanUrl
    }

    /** Attach a session obtained via REST (register/recaptcha/SSO token). */
    suspend fun attachRestSession(
        userId: String,
        deviceId: String?,
        accessToken: String,
        homeserverUrl: String
    ) {
        val cleanUrl = MatrixServersConfig.cleanUrl(homeserverUrl)
        Log.i(TAG, "attachRestSession: building client for $cleanUrl")
        val c = buildClient(cleanUrl)
        Log.i(TAG, "attachRestSession: client built, restoring session for $userId")
        c.restoreSession(
            Session(
                accessToken = accessToken,
                refreshToken = null,
                userId = userId,
                deviceId = deviceId ?: "TQAPP",
                homeserverUrl = cleanUrl,
                oauthData = null,
                slidingSyncVersion = SlidingSyncVersion.NATIVE
            )
        )
        Log.i(TAG, "attachRestSession: session restored")
        client = c
        persistSession(c.session())
        MatrixApiClient.defaultHomeserver = cleanUrl
    }

    /** Restores a previously persisted session. Returns false if none. */
    suspend fun restoreSavedSession(): Boolean {
        if (!sessionFile.exists()) return false
        return try {
            val json = JSONObject(sessionFile.readText())
            val session = Session(
                accessToken = json.getString("access_token"),
                refreshToken = json.optString("refresh_token").ifBlank { null },
                userId = json.getString("user_id"),
                deviceId = json.getString("device_id"),
                homeserverUrl = json.getString("homeserver_url"),
                oauthData = json.optString("oauth_data").ifBlank { null },
                slidingSyncVersion = SlidingSyncVersion.NATIVE
            )
            val c = buildClient(session.homeserverUrl)
            c.restoreSession(session)
            client = c
            MatrixApiClient.defaultHomeserver = session.homeserverUrl
            true
        } catch (e: Exception) {
            // Corrupted session file: start clean
            Log.e(TAG, "restoreSavedSession failed: ${e.javaClass.simpleName}", e)
            sessionFile.delete()
            false
        }
    }

    suspend fun startSync(): SyncService {
        val c = client ?: error("No active Matrix client")
        if (syncService == null) {
            Log.i(TAG, "startSync: creating SyncService")
            syncService = c.syncService().withOfflineMode().finish()
            verificationController = c.getSessionVerificationController()
            Log.i(TAG, "startSync: waiting for E2EE init tasks")
            c.encryption().waitForE2eeInitializationTasks()
            Log.i(TAG, "startSync: E2EE initialized")
        }
        syncService!!.start()
        Log.i(TAG, "startSync: sync started")
        return syncService!!
    }

    suspend fun logout() {
        try {
            client?.logout()
        } catch (_: Exception) {
        }
        sessionFile.delete()
        verificationController?.destroy()
        verificationController = null
        syncService?.destroy()
        syncService = null
        client?.destroy()
        client = null
        File(dataPath).deleteRecursively()
        File(cachePath).deleteRecursively()
    }

    private fun persistSession(session: Session) {
        val json = JSONObject()
            .put("access_token", session.accessToken)
            .put("refresh_token", session.refreshToken)
            .put("user_id", session.userId)
            .put("device_id", session.deviceId)
            .put("homeserver_url", session.homeserverUrl)
            .put("oauth_data", session.oauthData)
        sessionFile.writeText(json.toString())
    }
}
