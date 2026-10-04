package com.example

import android.app.Application
import com.example.calls.MatrixSyncService
import com.example.data.local.AppDatabase
import com.example.data.matrix.MatrixSessionManager
import com.example.data.repository.MatrixRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Process-level owner of the Matrix session. The repository, SDK client and
 * sliding sync live here (not in an Activity/ViewModel) so they survive when
 * the UI is backgrounded or destroyed — the foreground service keeps the
 * process alive until explicit logout.
 */
class TqApp : Application() {

    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    lateinit var database: AppDatabase
        private set
    lateinit var sessionManager: MatrixSessionManager
        private set
    lateinit var repository: MatrixRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        sessionManager = MatrixSessionManager(this)
        repository = MatrixRepository(database, sessionManager)
        AnrWatchdog.start()

        // Restore the persisted session and start sync immediately — this runs
        // even when the process was started by the service/boot receiver with
        // no UI at all.
        applicationScope.launch {
            repository.tryRestoreSession()
        }

        // Keep the sync foreground service running while logged in; stop it
        // only on explicit logout.
        applicationScope.launch {
            repository.sessionFlow.collect { session ->
                if (session?.isLoggedIn == true) {
                    if (MatrixSyncService.isBackgroundSyncEnabled(this@TqApp)) {
                        MatrixSyncService.start(this@TqApp)
                    }
                } else {
                    MatrixSyncService.stop(this@TqApp)
                }
            }
        }
    }
}
