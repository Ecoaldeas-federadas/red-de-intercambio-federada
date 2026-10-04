package com.example.data.matrix

import com.example.data.matrix.models.CreateRoomRequest
import com.example.data.matrix.models.CreateRoomResponse
import com.example.data.matrix.models.LoginRequest
import com.example.data.matrix.models.LoginResponse
import com.example.data.matrix.models.MatrixProfileResponse
import com.example.data.matrix.models.PublicRoomsResponse
import com.example.data.matrix.models.RegisterRequest
import com.example.data.matrix.models.RegisterResponse
import com.example.data.matrix.models.SendMessageRequest
import com.example.data.matrix.models.SendMessageResponse
import com.example.data.matrix.models.TokenLoginRequest
import com.example.data.matrix.models.VersionsResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface MatrixApiService {

    @GET("_matrix/client/versions")
    suspend fun getVersions(): Response<VersionsResponse>

    @POST("_matrix/client/v3/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @POST("_matrix/client/v3/login")
    suspend fun loginWithToken(
        @Body request: TokenLoginRequest
    ): Response<LoginResponse>

    @POST("_matrix/client/v3/register")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<RegisterResponse>

    @PUT("_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}")
    suspend fun sendMessage(
        @Header("Authorization") authHeader: String,
        @Path("roomId") roomId: String,
        @Path("txnId") txnId: String,
        @Body request: SendMessageRequest
    ): Response<SendMessageResponse>

    @POST("_matrix/client/v3/createRoom")
    suspend fun createRoom(
        @Header("Authorization") authHeader: String,
        @Body request: CreateRoomRequest
    ): Response<CreateRoomResponse>

    @GET("_matrix/client/v3/publicRooms")
    suspend fun getPublicRooms(
        @Header("Authorization") authHeader: String?,
        @Query("limit") limit: Int = 30
    ): Response<PublicRoomsResponse>

    @GET("_matrix/client/v3/profile/{userId}")
    suspend fun getProfile(
        @Path("userId") userId: String
    ): Response<MatrixProfileResponse>

    @GET("_matrix/client/v3/sync")
    suspend fun sync(
        @Header("Authorization") authHeader: String,
        @Query("since") since: String? = null,
        @Query("timeout") timeout: Long = 10000
    ): Response<ResponseBody>

    @GET("_matrix/client/v3/rooms/{roomId}/messages")
    suspend fun getRoomMessages(
        @Header("Authorization") authHeader: String,
        @Path("roomId") roomId: String,
        @Query("dir") dir: String = "b",
        @Query("limit") limit: Int = 50,
        @Query("from") from: String? = null
    ): Response<ResponseBody>

    @POST("_matrix/client/v3/join/{roomIdOrAlias}")
    suspend fun joinRoom(
        @Header("Authorization") authHeader: String,
        @Path("roomIdOrAlias") roomIdOrAlias: String
    ): Response<ResponseBody>

    @POST("_matrix/client/v3/rooms/{roomId}/leave")
    suspend fun leaveRoom(
        @Header("Authorization") authHeader: String,
        @Path("roomId") roomId: String
    ): Response<ResponseBody>

    @GET("_matrix/client/v3/joined_rooms")
    suspend fun getJoinedRooms(
        @Header("Authorization") authHeader: String
    ): Response<ResponseBody>

    @GET("_matrix/client/v3/rooms/{roomId}/state")
    suspend fun getRoomState(
        @Header("Authorization") authHeader: String,
        @Path("roomId") roomId: String
    ): Response<ResponseBody>

    @PUT("_matrix/client/v3/devices/{deviceId}")
    suspend fun updateDevice(
        @Header("Authorization") authHeader: String,
        @Path("deviceId") deviceId: String,
        @Body body: Map<String, String>
    ): Response<ResponseBody>

    @PUT("_matrix/client/v3/profile/{userId}/displayname")
    suspend fun setDisplayName(
        @Header("Authorization") authHeader: String,
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Response<ResponseBody>

    @PUT("_matrix/client/v3/profile/{userId}/avatar_url")
    suspend fun setAvatarUrl(
        @Header("Authorization") authHeader: String,
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Response<ResponseBody>
}
