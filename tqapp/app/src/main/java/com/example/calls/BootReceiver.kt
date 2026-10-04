package com.example.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.TqApp

/**
 * Restarts the sync foreground service after a device reboot if a session is
 * still persisted — Android allows starting a dataSync foreground service
 * from BOOT_COMPLETED.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val app = context.applicationContext as TqApp
        if (!app.sessionManager.hasSavedSession()) return
        if (!MatrixSyncService.isBackgroundSyncEnabled(context)) return
        try {
            MatrixSyncService.start(context)
        } catch (e: Exception) {
            Log.w("BootReceiver", "cannot start sync service on boot: ${e.message}")
        }
    }
}
