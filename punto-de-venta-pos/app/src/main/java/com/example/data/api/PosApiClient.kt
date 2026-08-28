package com.example.data.api

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.net.URI
import java.util.concurrent.TimeUnit

class PosApiClient(
    initialServerUrl: String = "https://feria.loanstly.com/main"
) {
    var serverUrl: String = sanitizeUrl(initialServerUrl)
        private set

    var nodeDomain: String = extractNodeDomain(initialServerUrl)
        private set

    var authToken: String? = null
    var terminalId: String = "TERM-POS-001"

    val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private var cachedService: PosApiService? = null

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Content-Type", "application/json")
            .header("X-Node-Domain", nodeDomain)

        if (!authToken.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $authToken")
        }
        if (terminalId.isNotBlank()) {
            builder.header("X-Terminal-ID", terminalId)
        }

        chain.proceed(builder.build())
    }

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    fun updateConfig(url: String, token: String? = authToken, termId: String = terminalId) {
        val clean = sanitizeUrl(url)
        serverUrl = clean
        nodeDomain = extractNodeDomain(clean)
        authToken = token
        terminalId = termId
        cachedService = null // Force recreate retrofit
    }

    fun getService(): PosApiService {
        val current = cachedService
        if (current != null) return current

        val baseUrl = getApiBaseUrl()
        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

        val service = retrofit.create(PosApiService::class.java)
        cachedService = service
        return service
    }

    /**
     * Constructs base API URL according to section 3:
     * https://example.org -> https://example.org/api/
     * https://feria.loanstly.com/demo -> https://feria.loanstly.com/demo/api/
     */
    fun getApiBaseUrl(): String {
        val clean = serverUrl.trimEnd('/')
        return "$clean/api/"
    }

    /**
     * Constructs the Pay QR URL for customers:
     * {server_url}{base_path}/pay?t={charge_token}
     */
    fun getPayQrUrl(chargeToken: String): String {
        val clean = serverUrl.trimEnd('/')
        return "$clean/pay?t=$chargeToken"
    }

    companion object {
        fun sanitizeUrl(url: String): String {
            var trimmed = url.trim()
            if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                trimmed = "https://$trimmed"
            }
            return trimmed.trimEnd('/')
        }

        fun extractNodeDomain(url: String): String {
            return try {
                val clean = sanitizeUrl(url)
                val uri = URI(clean)
                // X-Node-Domain debe ser SOLO el host, no host+path.
                // El path (ej: /main) es solo para la URL base de Retrofit,
                // no para identificar el nodo. Si incluimos el path,
                // el backend no reconoce el dominio como local.
                uri.host ?: clean.removePrefix("https://").removePrefix("http://")
            } catch (e: Exception) {
                url.removePrefix("https://").removePrefix("http://").trimEnd('/')
            }
        }
    }
}
