package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Local database for features without a Matrix equivalent (stories / estados and
 * the call log). Chats, messages and sessions are stored by the Matrix Rust
 * SDK's own encrypted store.
 */
@Database(
    entities = [
        StoryEntity::class,
        CallEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun storyDao(): StoryDao
    abstract fun callDao(): CallDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "whatsapp_matrix.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }

    suspend fun clearAllData() {
        storyDao().clearAllStories()
        callDao().clearAllCalls()
    }

    suspend fun deleteMockData() {
        storyDao().deleteMockStories()
        callDao().deleteMockCalls()
    }

    suspend fun prepopulateInitialData() {
        val now = System.currentTimeMillis()
        val oneHour = 3600000L

        // Default 24-hour Stories (Estados de 24 horas)
        val defaultStories = listOf(
            StoryEntity(
                id = "story_carlos",
                userId = "@carlos.matrix:matrix.org",
                userName = "Carlos Méndez",
                content = "¡Probando el nuevo TqApp federado! Privacidad total y código libre 🛡️✨",
                backgroundColorHex = "#075E54",
                timestamp = now - (2 * oneHour),
                expiresAt = now + (22 * oneHour),
                isViewed = false,
                viewsCount = 14,
                isMine = false
            ),
            StoryEntity(
                id = "story_sofia",
                userId = "@sofia.val:kde.org",
                userName = "Sofía Valenzuela",
                content = "Atardecer hermoso terminando la semana de código 🌅☕",
                backgroundColorHex = "#792138",
                timestamp = now - (5 * oneHour),
                expiresAt = now + (19 * oneHour),
                isViewed = false,
                viewsCount = 28,
                isMine = false
            ),
            StoryEntity(
                id = "story_david",
                userId = "@david.dev:mozilla.modular.im",
                userName = "David Tech",
                content = "Configurando un nuevo servidor Synapse Matrix en Kubernetes 💻⚡",
                backgroundColorHex = "#1EBEA5",
                timestamp = now - (8 * oneHour),
                expiresAt = now + (16 * oneHour),
                isViewed = true,
                viewsCount = 42,
                isMine = false
            )
        )
        storyDao().insertStories(defaultStories)

        // Default Calls
        val defaultCalls = listOf(
            CallEntity(
                contactName = "Carlos Méndez",
                callType = "VOICE",
                direction = "INCOMING",
                timestamp = now - (3 * oneHour),
                durationSeconds = 145
            ),
            CallEntity(
                contactName = "Sofía Valenzuela",
                callType = "VIDEO",
                direction = "OUTGOING",
                timestamp = now - (22 * oneHour),
                durationSeconds = 310
            ),
            CallEntity(
                contactName = "David Tech",
                callType = "VOICE",
                direction = "MISSED",
                timestamp = now - (30 * oneHour),
                durationSeconds = 0
            )
        )
        callDao().insertCalls(defaultCalls)
    }
}
