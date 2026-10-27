package com.example.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Update
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "pos_transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val amount: Long, // in centavos TQ
    val paymentMethod: String, // "qr", "nfc_single", "nfc_community", "multisig"
    val status: String, // "approved", "rejected", "pending", "cancelled", "expired"
    val cardUid: String? = null,
    val customerName: String? = null,
    val vendorName: String? = null,
    val description: String? = null,
    val receiptNumber: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "pos_shifts")
data class ShiftEntity(
    @PrimaryKey val id: String,
    val status: String = "open", // "open", "closed"
    val openedAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
    val openingAmount: Long = 0L,
    val closingAmount: Long? = null,
    val totalSales: Long = 0L,
    val transactionsCount: Int = 0,
    val notes: String? = null,
    // Offline close support (migración 3→4)
    val pendingSync: Boolean = false,      // true si se cerró offline y falta sincronizar con el backend
    val closedOffline: Boolean = false     // true si el cierre se hizo sin conexión
)

@Entity(tableName = "terminal_config")
data class TerminalConfigEntity(
    @PrimaryKey val id: Int = 1,
    val serverUrl: String = "https://feria.loanstly.com/main",
    val terminalId: String = "TERM-POS-001",
    val label: String = "Terminal Kiosco POS",
    val isRegistered: Boolean = false,
    val terminalPrivateKeyHex: String = "",
    val terminalPublicKeyHex: String = "",
    val serverPublicKeyHex: String? = null,
    val sessionToken: String? = null,
    val isMultiVendorEnabled: Boolean = false,
    // Format settings (received from server)
    val fmtLocale: String = "es",
    val fmtNumberLocale: String = "es-VE",
    val fmtDateFormat: String = "DD/MM/YYYY",
    val fmtTimeFormat: String = "24h",
    val fmtFirstDayOfWeek: Int = 1,
    val fmtTimezone: String = "America/Caracas"
)

@Entity(tableName = "shift_pin")
data class ShiftPinEntity(
    @PrimaryKey val id: Int = 1,
    val pinHash: String // SHA-256 hash del PIN
)

@Dao
interface TransactionDao {
    @Query("SELECT * FROM pos_transactions ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM pos_transactions WHERE status = 'approved' ORDER BY timestamp DESC")
    fun getApprovedTransactions(): Flow<List<TransactionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Query("DELETE FROM pos_transactions")
    suspend fun clearTransactions()
}

@Dao
interface ShiftDao {
    @Query("SELECT * FROM pos_shifts ORDER BY openedAt DESC LIMIT 1")
    fun getLatestShiftFlow(): Flow<ShiftEntity?>

    @Query("SELECT * FROM pos_shifts WHERE status = 'open' LIMIT 1")
    suspend fun getOpenShift(): ShiftEntity?

    @Query("SELECT * FROM pos_shifts WHERE pendingSync = 1 LIMIT 1")
    suspend fun getPendingSyncShift(): ShiftEntity?

    @Query("SELECT * FROM pos_shifts ORDER BY openedAt DESC")
    fun getAllShifts(): Flow<List<ShiftEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertShift(shift: ShiftEntity)

    @Update
    suspend fun updateShift(shift: ShiftEntity)
}

@Dao
interface ShiftPinDao {
    @Query("SELECT * FROM shift_pin WHERE id = 1")
    suspend fun getPin(): ShiftPinEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun savePin(pin: ShiftPinEntity)

    @Query("DELETE FROM shift_pin")
    suspend fun clearPin()
}

@Dao
interface TerminalConfigDao {
    @Query("SELECT * FROM terminal_config WHERE id = 1")
    fun getConfigFlow(): Flow<TerminalConfigEntity?>

    @Query("SELECT * FROM terminal_config WHERE id = 1")
    suspend fun getConfig(): TerminalConfigEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: TerminalConfigEntity)
}

// Migracion de v2 a v3: anade columnas de formato SIN perder datos existentes.
// Esto preserva las credenciales del terminal (terminalId, privateKey, sessionToken, etc.)
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // ALTER TABLE ADD COLUMN conserva todas las filas existentes.
        // Los defaults coinciden con los de TerminalConfigEntity.
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtLocale TEXT NOT NULL DEFAULT 'es'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtNumberLocale TEXT NOT NULL DEFAULT 'es-VE'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtDateFormat TEXT NOT NULL DEFAULT 'DD/MM/YYYY'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimeFormat TEXT NOT NULL DEFAULT '24h'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtFirstDayOfWeek INTEGER NOT NULL DEFAULT 1")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimezone TEXT NOT NULL DEFAULT 'America/Caracas'")
    }
}

// Migracion de v3 a v4: anade columnas de cierre offline a pos_shifts SIN perder datos.
val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 0")
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN closedOffline INTEGER NOT NULL DEFAULT 0")
    }
}

@Database(
    entities = [TransactionEntity::class, ShiftEntity::class, TerminalConfigEntity::class, ShiftPinEntity::class],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun shiftDao(): ShiftDao
    abstract fun shiftPinDao(): ShiftPinDao
    abstract fun terminalConfigDao(): TerminalConfigDao
}
