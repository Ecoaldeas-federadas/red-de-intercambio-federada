package com.example.data.model

/**
 * UI models fed by the Matrix Rust SDK (single source of truth, which keeps its
 * own encrypted local store like Element X). These are plain data classes, not
 * Room entities — names are kept identical to the old entities to minimize churn.
 */

data class UserSessionEntity(
    val id: Int = 1,
    val userId: String,
    val homeserverUrl: String,
    val accessToken: String = "",
    val deviceId: String? = null,
    val displayName: String,
    val avatarUrl: String? = null,
    val isLoggedIn: Boolean = true,
    val isDemoMode: Boolean = false
)

data class RoomEntity(
    val roomId: String,
    val name: String,
    val topic: String = "",
    val avatarUrl: String? = null,
    val roomType: String = "DIRECT", // "DIRECT", "GROUP", "CHANNEL", "COMMUNITY", "INVITE"
    val lastMessage: String = "",
    val lastTimestamp: Long = System.currentTimeMillis(),
    val unreadCount: Int = 0,
    val isPinned: Boolean = false,
    val isMuted: Boolean = false,
    val isEncrypted: Boolean = false,
    val parentSpaceId: String? = null,
    val directUserId: String? = null,
    val hasActiveCall: Boolean = false
)

data class MessageEntity(
    val id: String,
    val roomId: String,
    val senderId: String,
    val senderName: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val status: String = "READ", // "SENDING", "SENT", "DELIVERED", "READ", "FAILED"
    val isOutgoing: Boolean = false,
    val messageType: String = "TEXT", // "TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "SYSTEM", "CALL", "POLL"
    val mediaUrl: String? = null,
    val mediaSourceJson: String? = null,
    val mediaDuration: String? = null,
    val callIsVideo: Boolean = false,
    // Polls (m.poll.start)
    val pollQuestion: String? = null,
    val pollAnswerIds: List<String> = emptyList(),
    val pollAnswers: List<String> = emptyList(),
    val pollMaxSelections: Int = 1,
    // Locations (m.location)
    val locationGeoUri: String? = null,
    // Reactions (m.reaction annotations)
    val reactions: List<ReactionUi> = emptyList(),
    // Reply (m.in_reply_to)
    val replyToEventId: String? = null,
    val replyToSender: String? = null,
    val replyToText: String? = null,
    // Edit (m.replace)
    val isEdited: Boolean = false,
    // Redaction (deleted message)
    val isDeleted: Boolean = false,
    // Pinned via m.pinned_events room state
    val isPinned: Boolean = false
)

/** A grouped emoji reaction on a message. */
data class ReactionUi(
    val emoji: String,
    val count: Int,
    val includesMe: Boolean,
    val senders: List<String>
)

data class ContactEntity(
    val userId: String,
    val displayName: String,
    val avatarUrl: String? = null,
    val statusMessage: String = "¡Hola! Estoy usando TqApp.",
    val lastSeen: String = "en línea"
)
