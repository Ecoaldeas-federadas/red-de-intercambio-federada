package com.example.data.matrix.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class VersionsResponse(
    @Json(name = "versions") val versions: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class UserIdentifier(
    @Json(name = "type") val type: String = "m.id.user",
    @Json(name = "user") val user: String
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "type") val type: String = "m.login.password",
    @Json(name = "identifier") val identifier: UserIdentifier,
    @Json(name = "password") val password: String,
    @Json(name = "initial_device_display_name") val deviceDisplayName: String = "TqApp Matrix Android"
)

@JsonClass(generateAdapter = true)
data class TokenLoginRequest(
    @Json(name = "type") val type: String = "m.login.token",
    @Json(name = "token") val token: String,
    @Json(name = "device_id") val deviceId: String? = null,
    @Json(name = "initial_device_display_name") val deviceDisplayName: String = "TqApp"
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    @Json(name = "user_id") val userId: String,
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "home_server") val homeServer: String? = null,
    @Json(name = "device_id") val deviceId: String? = null
)

@JsonClass(generateAdapter = true)
data class RegisterAuth(
    @Json(name = "type") val type: String? = null,
    @Json(name = "session") val session: String? = null,
    @Json(name = "response") val response: String? = null
)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    @Json(name = "username") val username: String,
    @Json(name = "password") val password: String,
    @Json(name = "auth") val auth: RegisterAuth? = null,
    @Json(name = "initial_device_display_name") val deviceDisplayName: String = "TqApp Matrix Android"
)

@JsonClass(generateAdapter = true)
data class RegisterResponse(
    @Json(name = "user_id") val userId: String,
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "home_server") val homeServer: String? = null,
    @Json(name = "device_id") val deviceId: String? = null
)

@JsonClass(generateAdapter = true)
data class UiaStageFlow(
    @Json(name = "stages") val stages: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SendMessageRequest(
    @Json(name = "msgtype") val msgtype: String = "m.text",
    @Json(name = "body") val body: String
)

@JsonClass(generateAdapter = true)
data class SendMessageResponse(
    @Json(name = "event_id") val eventId: String
)

@JsonClass(generateAdapter = true)
data class CreateRoomRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "topic") val topic: String? = null,
    @Json(name = "preset") val preset: String = "private_chat", // "private_chat" or "public_chat"
    @Json(name = "is_direct") val isDirect: Boolean = false,
    @Json(name = "invite") val invite: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CreateRoomResponse(
    @Json(name = "room_id") val roomId: String
)

@JsonClass(generateAdapter = true)
data class PublicRoomChunk(
    @Json(name = "room_id") val roomId: String,
    @Json(name = "name") val name: String? = null,
    @Json(name = "topic") val topic: String? = null,
    @Json(name = "num_joined_members") val numMembers: Int = 0,
    @Json(name = "avatar_url") val avatarUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class PublicRoomsResponse(
    @Json(name = "chunk") val chunk: List<PublicRoomChunk> = emptyList()
)

@JsonClass(generateAdapter = true)
data class MatrixProfileResponse(
    @Json(name = "displayname") val displayName: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class MatrixErrorResponse(
    @Json(name = "errcode") val errcode: String? = null,
    @Json(name = "error") val error: String? = null
)
