package com.example.calls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.TqApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Keeps the process (and therefore the Matrix SDK sliding sync) alive while a
 * session exists, so incoming calls and room updates arrive with the app
 * backgrounded or removed from recents. Posts a heads-up call notification
 * with a full-screen intent when an incoming MatrixRTC call is detected.
 */
class MatrixSyncService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var ringtone: Ringtone? = null
    private var inCall = false

    companion object {
        private const val TAG = "MatrixSyncService"
        private const val CHANNEL_SYNC = "tqapp_sync"
        private const val CHANNEL_CALLS = "tqapp_calls"
        private const val CHANNEL_MESSAGES = "tqapp_messages"
        private const val SYNC_NOTIFICATION_ID = 1
        private const val CALL_NOTIFICATION_ID = 2
        const val EXTRA_IN_CALL = "in_call"
        const val ACTION_DECLINE = "com.example.calls.ACTION_DECLINE"
        const val ACTION_ANSWER = "com.example.calls.ACTION_ANSWER"
        const val EXTRA_ROOM_ID = "room_id"
        const val EXTRA_SHOW_INCOMING_CALL = "show_incoming_call"

        /** True while MainActivity is in the foreground — suppresses the
         * service ringtone because IncomingCallScreen plays its own. */
        @Volatile
        var uiVisible = false

        private const val PREFS = "tqapp_settings"
        private const val KEY_BACKGROUND_SYNC = "background_sync"

        /** Whether the always-on background connection is enabled. When off,
         * the app only syncs while its process is alive — Android may kill it
         * once the UI is gone, so calls/messages stop arriving until reopen. */
        fun isBackgroundSyncEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(KEY_BACKGROUND_SYNC, true)

        fun setBackgroundSyncEnabled(context: Context, enabled: Boolean) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_BACKGROUND_SYNC, enabled).apply()
            if (enabled) start(context) else stop(context)
        }

        fun start(context: Context, inCall: Boolean = false) {
            val intent = Intent(context, MatrixSyncService::class.java)
                .putExtra(EXTRA_IN_CALL, inCall)
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                // ForegroundServiceStartNotAllowedException if the OS rejects a
                // background start — sync still runs while the process lives.
                Log.w(TAG, "startForegroundService rejected: ${e.message}")
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MatrixSyncService::class.java))
        }

        /** Called when an Element Call session starts/ends so the foreground
         * service claims mic/camera types and Android keeps the media alive
         * when the user leaves the app mid-call. */
        fun setCallActive(context: Context, active: Boolean) {
            // During a call we need the FGS for mic/camera even when the
            // always-on sync preference is off; afterwards don't resurrect it.
            if (active || isBackgroundSyncEnabled(context)) {
                start(context, inCall = active)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.hasExtra(EXTRA_IN_CALL) == true) {
            inCall = intent.getBooleanExtra(EXTRA_IN_CALL, false)
        }
        foreground()
        observeIncomingCalls()
        observeMessageNotifications()
        return START_STICKY
    }

    @Volatile private var destroyed = false

    override fun onDestroy() {
        destroyed = true
        foregroundTypes = -1
        serviceScope.cancel()
        stopRingtone()
        super.onDestroy()
    }

    @Volatile private var foregroundTypes = -1

    private fun foreground() {
        var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        if (inCall && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
        // Skip the binder call entirely when the foreground state is already
        // what we want — onStartCommand can fire many times in a row.
        if (types == foregroundTypes) return
        foregroundTypes = types

        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_SYNC)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("TqApp")
            .setContentText("Conectado — recibiendo mensajes y llamadas")
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()

        // startForeground is a binder call into system_server that can block
        // the main thread for tens of seconds under load (media codecs busy,
        // memory pressure) — causing "executing service" ANRs and a frozen
        // UI. Run it on a worker thread; it is not required to run on main.
        val typesF = types
        serviceScope.launch(Dispatchers.IO) {
            if (destroyed) return@launch
            try {
                ServiceCompat.startForeground(
                    this@MatrixSyncService, SYNC_NOTIFICATION_ID, notification, typesF
                )
            } catch (e: Exception) {
                Log.e(TAG, "startForeground failed: ${e.message}")
            }
        }
    }

    private var msgObserving = false
    private fun observeMessageNotifications() {
        if (msgObserving) return
        msgObserving = true
        val repository = (application as TqApp).repository
        serviceScope.launch {
            repository.notificationEvents.collect { n ->
                postMessageNotification(n)
            }
        }
    }

    private fun postMessageNotification(n: com.example.data.repository.MatrixRepository.AppNotification) {
        val open = PendingIntent.getActivity(
            this, n.roomId.hashCode(),
            Intent(this, MainActivity::class.java)
                .putExtra(EXTRA_ROOM_ID, n.roomId)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val title = if (n.isInvite) "Invitación" else (n.senderName.takeIf { it != n.roomId } ?: n.roomName)
        val notification = NotificationCompat.Builder(this, CHANNEL_MESSAGES)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(n.body)
            .setSubText(n.roomName.takeIf { it != title })
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        getSystemService(NotificationManager::class.java)
            .notify(n.roomId.hashCode() + 1000, notification)
    }

    private var observing = false
    private fun observeIncomingCalls() {
        if (observing) return
        observing = true
        val repository = (application as TqApp).repository
        serviceScope.launch {
            repository.incomingCall.collectLatest { call ->
                if (call != null) {
                    postCallNotification(call.roomId, call.callerName, call.isVideo)
                    if (!uiVisible) startRingtone()
                } else {
                    cancelCallNotification()
                    stopRingtone()
                }
            }
        }
    }

    private fun postCallNotification(roomId: String, callerName: String, isVideo: Boolean) {
        val fullScreen = PendingIntent.getActivity(
            this, 1,
            Intent(this, MainActivity::class.java)
                .putExtra(EXTRA_SHOW_INCOMING_CALL, true)
                .putExtra(EXTRA_ROOM_ID, roomId)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val decline = PendingIntent.getBroadcast(
            this, 2,
            Intent(this, CallActionReceiver::class.java)
                .setAction(ACTION_DECLINE)
                .putExtra(EXTRA_ROOM_ID, roomId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val answer = PendingIntent.getBroadcast(
            this, 3,
            Intent(this, CallActionReceiver::class.java)
                .setAction(ACTION_ANSWER)
                .putExtra(EXTRA_ROOM_ID, roomId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_CALLS)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(if (isVideo) "Videollamada entrante" else "Llamada entrante")
            .setContentText(callerName)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .addAction(0, "Rechazar", decline)
            .addAction(0, "Contestar", answer)
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(CALL_NOTIFICATION_ID, notification)
    }

    private fun cancelCallNotification() {
        getSystemService(NotificationManager::class.java).cancel(CALL_NOTIFICATION_ID)
    }

    private fun startRingtone() {
        if (ringtone != null) return
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(this, uri)?.apply {
                audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
                if (Build.VERSION.SDK_INT >= 28) isLooping = true
                play()
            }
        } catch (e: Exception) {
            Log.w(TAG, "ringtone failed: ${e.message}")
        }
    }

    private fun stopRingtone() {
        try { ringtone?.stop() } catch (_: Exception) {}
        ringtone = null
    }

    private fun createChannels() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_SYNC, "Sincronización", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Mantiene TqApp conectado para recibir mensajes y llamadas"
                setShowBadge(false)
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_CALLS, "Llamadas", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Llamadas entrantes"
                // Sound/vibration handled by the service ringtone so it can be
                // stopped precisely on answer/decline.
                setSound(null, null)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MESSAGES, "Mensajes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Mensajes nuevos e invitaciones"
            }
        )
    }
}
