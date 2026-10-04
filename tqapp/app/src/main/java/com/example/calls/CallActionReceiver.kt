package com.example.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.MainActivity
import com.example.TqApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Handles the notification action buttons for incoming calls:
 * decline → real m.rtc.decline via the SDK; answer → opens the app and
 * auto-answers through the shared repository.
 */
class CallActionReceiver : BroadcastReceiver() {

    private val receiverScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext as TqApp
        when (intent.action) {
            MatrixSyncService.ACTION_DECLINE -> {
                val roomId = intent.getStringExtra(MatrixSyncService.EXTRA_ROOM_ID)
                    ?: app.repository.incomingCall.value?.roomId
                val pending = goAsync()
                receiverScope.launch {
                    try {
                        if (roomId != null) {
                            app.repository.declineIncomingCall(roomId)
                        }
                    } finally {
                        pending.finish()
                    }
                }
            }
            MatrixSyncService.ACTION_ANSWER -> {
                val roomId = intent.getStringExtra(MatrixSyncService.EXTRA_ROOM_ID)
                if (roomId != null) app.repository.requestAutoAnswer(roomId)
                val open = Intent(context, MainActivity::class.java)
                    .putExtra(MatrixSyncService.EXTRA_SHOW_INCOMING_CALL, true)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                context.startActivity(open)
            }
        }
    }
}
