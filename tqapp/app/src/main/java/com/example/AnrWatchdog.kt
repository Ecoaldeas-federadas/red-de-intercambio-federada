package com.example

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread

/**
 * Debug watchdog: posts a heartbeat to the main looper every second and, if the
 * main thread fails to process it for [BLOCK_MS], dumps every thread's stack to
 * logcat under tag "ANR_WATCHDOG". Used to pinpoint main-thread freezes
 * (Rust FFI lock waits, deadlocks) on the physical device where /data/anr
 * traces are unreadable without root.
 */
object AnrWatchdog {

    private const val TAG = "ANR_WATCHDOG"
    private const val BLOCK_MS = 4000L

    fun start() {
        val handler = Handler(Looper.getMainLooper())
        val tick = AtomicLong(0)
        val heartbeat = object : Runnable {
            override fun run() {
                tick.incrementAndGet()
                handler.postDelayed(this, 1000)
            }
        }
        handler.post(heartbeat)

        thread(name = "anr-watchdog", isDaemon = true) {
            var lastTick = 0L
            var blockedSince = 0L
            while (true) {
                Thread.sleep(1000)
                val current = tick.get()
                if (current != lastTick) {
                    lastTick = current
                    blockedSince = 0L
                    continue
                }
                val now = SystemClock.elapsedRealtime()
                if (blockedSince == 0L) blockedSince = now
                if (now - blockedSince >= BLOCK_MS) {
                    dumpAllThreads(now - blockedSince)
                    blockedSince = Long.MAX_VALUE // dump once per freeze
                }
            }
        }
    }

    private fun dumpAllThreads(blockedMs: Long) {
        Log.e(TAG, "=== MAIN THREAD BLOCKED ${blockedMs}ms — dumping all threads ===")
        for ((t, stack) in Thread.getAllStackTraces()) {
            Log.e(TAG, "--- \"${t.name}\" tid=${t.id} state=${t.state}")
            for (el in stack) Log.e(TAG, "    at $el")
        }
        Log.e(TAG, "=== END DUMP ===")
    }
}
