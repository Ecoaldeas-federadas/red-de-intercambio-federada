package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

// Only purely-local features stay in Room. Chats, messages, contacts and the
// session are provided by the Matrix Rust SDK's own encrypted store.

@Entity(tableName = "stories")
data class StoryEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val userName: String,
    val userAvatar: String? = null,
    val content: String,
    val mediaUrl: String? = null,
    val backgroundColorHex: String = "#075E54",
    val timestamp: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + 86400000L, // 24 hours
    val isViewed: Boolean = false,
    val viewsCount: Int = 0,
    val isMine: Boolean = false
)

@Entity(tableName = "calls")
data class CallEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val contactName: String,
    val contactAvatar: String? = null,
    val callType: String = "VOICE", // "VOICE", "VIDEO"
    val direction: String = "INCOMING", // "INCOMING", "OUTGOING", "MISSED"
    val timestamp: Long = System.currentTimeMillis(),
    val durationSeconds: Int = 0,
    val roomId: String? = null
)
