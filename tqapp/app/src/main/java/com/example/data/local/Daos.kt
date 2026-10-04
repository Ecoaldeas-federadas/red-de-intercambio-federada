package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface StoryDao {
    @Query("SELECT * FROM stories WHERE expiresAt > :currentTime ORDER BY timestamp DESC")
    fun getActiveStories(currentTime: Long = System.currentTimeMillis()): Flow<List<StoryEntity>>

    @Query("SELECT * FROM stories WHERE isMine = 1 AND expiresAt > :currentTime ORDER BY timestamp DESC")
    fun getMyActiveStories(currentTime: Long = System.currentTimeMillis()): Flow<List<StoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStory(story: StoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStories(stories: List<StoryEntity>)

    @Query("UPDATE stories SET isViewed = 1, viewsCount = viewsCount + 1 WHERE id = :storyId")
    suspend fun markStoryViewed(storyId: String)

    @Query("SELECT isViewed FROM stories WHERE id = :storyId")
    suspend fun isStoryViewed(storyId: String): Boolean?

    @Query("SELECT viewsCount FROM stories WHERE id = :storyId")
    suspend fun storyViewsCount(storyId: String): Int?

    @Query("DELETE FROM stories WHERE isMine = 0")
    suspend fun deleteRemoteStories()

    @Query("DELETE FROM stories WHERE isMine = 0 AND id NOT IN (:ids)")
    suspend fun deleteRemoteStoriesNotIn(ids: List<String>)

    @Query("DELETE FROM stories WHERE expiresAt <= :currentTime")
    suspend fun cleanExpiredStories(currentTime: Long = System.currentTimeMillis())

    @Query("DELETE FROM stories")
    suspend fun clearAllStories()

    @Query("DELETE FROM stories WHERE id IN ('story_carlos', 'story_sofia', 'story_david')")
    suspend fun deleteMockStories()
}

@Dao
interface CallDao {
    @Query("SELECT * FROM calls ORDER BY timestamp DESC")
    fun getAllCalls(): Flow<List<CallEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCall(call: CallEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCalls(calls: List<CallEntity>)

    @Query("DELETE FROM calls")
    suspend fun clearAllCalls()

    @Query("DELETE FROM calls WHERE contactName IN ('Carlos Méndez', 'Sofía Valenzuela', 'David Tech')")
    suspend fun deleteMockCalls()
}
