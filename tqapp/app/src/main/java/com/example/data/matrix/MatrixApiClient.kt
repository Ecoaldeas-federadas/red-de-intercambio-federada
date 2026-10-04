package com.example.data.matrix

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

object MatrixApiClient {

    /** Homeserver of the active session, used to resolve mxc:// media URLs. */
    @Volatile
    var defaultHomeserver: String = "https://matrix.org"

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
            redactHeader("Authorization")
        })
        .build()

    private val serviceCache = ConcurrentHashMap<String, MatrixApiService>()

    fun getService(homeserverUrl: String): MatrixApiService {
        val cleanUrl = MatrixServersConfig.cleanUrl(homeserverUrl) + "/"
        return serviceCache.getOrPut(cleanUrl) {
            Retrofit.Builder()
                .baseUrl(cleanUrl)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(MatrixApiService::class.java)
        }
    }

    fun mxcToHttp(mxcUrl: String?, homeserverUrl: String = defaultHomeserver): String? {
        if (mxcUrl.isNullOrBlank() || !mxcUrl.startsWith("mxc://")) return mxcUrl
        val path = mxcUrl.removePrefix("mxc://")
        val cleanServer = MatrixServersConfig.cleanUrl(homeserverUrl)
        return "$cleanServer/_matrix/media/v3/download/$path"
    }
}
