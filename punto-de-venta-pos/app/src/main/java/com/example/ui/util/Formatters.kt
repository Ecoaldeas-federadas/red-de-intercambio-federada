package com.example.ui.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.ToneGenerator
import android.os.Build
import android.os.CombinedVibration
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.example.data.db.TerminalConfigEntity
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.EnumMap
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.*

/**
 * Holds the format settings received from the server so that the formatting
 * functions in [CurrencyHelper] are locale-aware and configurable at runtime.
 */
object FormatConfig {
    var locale: String = "es"
    var numberLocale: String = "es-VE"
    var dateFormat: String = "DD/MM/YYYY"
    var timeFormat: String = "24h"
    var firstDayOfWeek: Int = 1
    var timezone: String = "America/Caracas"

    fun updateFromEntity(config: TerminalConfigEntity) {
        locale = config.fmtLocale
        numberLocale = config.fmtNumberLocale
        dateFormat = config.fmtDateFormat
        timeFormat = config.fmtTimeFormat
        firstDayOfWeek = config.fmtFirstDayOfWeek
        timezone = config.fmtTimezone
    }
}

object CurrencyHelper {
    /**
     * Converts micro-units integer (e.g. 50000) to formatted TQ string (e.g. "500.00 TQ")
     */
    fun formatMicroUnits(microUnits: Long): String {
        val locale = parseLocale(FormatConfig.numberLocale)
        val formatter = NumberFormat.getNumberInstance(locale).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        val amount = microUnits / 100.0
        return "${formatter.format(amount)} TQ"
    }

    /**
     * Converts raw string input from POS keypad to integer micro-units.
     * POS-style decimal entry: the input string represents CENTIMOS directly.
     * "1" → 1 centimo → 0.01 TQ → 1 micro-unit
     * "100" → 100 centimos → 1.00 TQ → 100 micro-units
     * "12345" → 123.45 TQ → 12345 micro-units
     *
     * This matches how real POS keypads work: digits enter from the right
     * as the least significant decimal position.
     */
    fun parseInputToMicroUnits(input: String): Long {
        val clean = input.replace(Regex("[^0-9]"), "").trim()
        if (clean.isEmpty()) return 0L
        return clean.toLongOrNull() ?: 0L
    }

    fun formatDateTime(timestamp: Long): String {
        val d = Date(timestamp)
        val pattern = buildDateTimePattern(FormatConfig.dateFormat, FormatConfig.timeFormat)
        val locale = parseLocale(FormatConfig.locale)
        val sdf = SimpleDateFormat(pattern, locale)
        return sdf.format(d)
    }

    fun formatDate(timestamp: Long): String {
        val d = Date(timestamp)
        val pattern = buildDatePattern(FormatConfig.dateFormat)
        val locale = parseLocale(FormatConfig.locale)
        val sdf = SimpleDateFormat(pattern, locale)
        return sdf.format(d)
    }

    fun formatTime(timestamp: Long): String {
        val d = Date(timestamp)
        val pattern = buildTimePattern(FormatConfig.timeFormat)
        val locale = parseLocale(FormatConfig.locale)
        val sdf = SimpleDateFormat(pattern, locale)
        return sdf.format(d)
    }

    private fun buildDatePattern(format: String): String {
        return when (format) {
            "MM/DD/YYYY" -> "MM/dd/yyyy"
            "YYYY-MM-DD" -> "yyyy-MM-dd"
            else -> "dd/MM/yyyy"
        }
    }

    private fun buildTimePattern(format: String): String {
        return when (format) {
            "12h" -> "hh:mm a"
            else -> "HH:mm"
        }
    }

    private fun buildDateTimePattern(dateFormat: String, timeFormat: String): String {
        return "${buildDatePattern(dateFormat)} ${buildTimePattern(timeFormat)}"
    }

    private fun parseLocale(localeStr: String): Locale {
        val parts = localeStr.split("-")
        return if (parts.size >= 2) Locale(parts[0], parts[1]) else Locale(parts[0])
    }
}

object QrCodeHelper {
    /**
     * Generates a high-quality Bitmap for a QR code string
     */
    fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap? {
        return try {
            val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
                put(EncodeHintType.MARGIN, 1)
                put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M)
            }
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val pixels = IntArray(width * height)

            for (y in 0 until height) {
                val offset = y * width
                for (x in 0 until width) {
                    // Dark navy color for foreground on clean white background
                    pixels[offset + x] = if (bitMatrix.get(x, y)) 0xFF0F172A.toInt() else 0xFFFFFFFF.toInt()
                }
            }

            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
            bitmap
        } catch (e: Exception) {
            null
        }
    }
}

object FeedbackHelper {
    private var toneGen: ToneGenerator? = null
    private const val PREFS_NAME = "pos_feedback_prefs"
    private const val KEY_SOUND_ENABLED = "sound_enabled"
    private const val KEY_VIBRATION_ENABLED = "vibration_enabled"

    var isSoundEnabled: Boolean = true
        private set

    var isVibrationEnabled: Boolean = true
        private set

    private var isInitialized = false
    private val audioExecutor = Executors.newSingleThreadExecutor()
    private const val SAMPLE_RATE = 44100

    init {
        try {
            toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            // Tone generator fallback
        }
    }

    fun initPreferences(context: Context) {
        if (!isInitialized) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            isSoundEnabled = prefs.getBoolean(KEY_SOUND_ENABLED, true)
            isVibrationEnabled = prefs.getBoolean(KEY_VIBRATION_ENABLED, true)
            isInitialized = true
        }
    }

    fun setSoundEnabled(context: Context, enabled: Boolean) {
        isSoundEnabled = enabled
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_SOUND_ENABLED, enabled)
            .apply()
    }

    fun setVibrationEnabled(context: Context, enabled: Boolean) {
        isVibrationEnabled = enabled
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_VIBRATION_ENABLED, enabled)
            .apply()
    }

    // --- PCM SYNTHESIZED BUFFERS ---

    /**
     * Synthesizes Cash Register Drawer Open & Cascading Shower of Falling Gold Coins
     * (Caja fuerte / caja registradora abriéndose + lluvia de monedas metálicas tintineantes)
     */
    private val paymentApprovedCoinsPcm: ShortArray by lazy {
        val duration = 0.95 // seconds
        val totalSamples = (SAMPLE_RATE * duration).toInt()
        val buffer = ShortArray(totalSamples)
        val twoPi = 2.0 * Math.PI

        // 1. Safe latch snap & drawer release (t = 0.0s to 0.14s)
        // 2. Bell chime "Ding!" / Cha-Ching chord (t = 0.08s to 0.65s)
        // 3. Falling coins cascade: 8 distinct metallic coin clinks
        val coinTimes = doubleArrayOf(0.12, 0.18, 0.25, 0.32, 0.40, 0.49, 0.58, 0.68)
        val coinFreqs = doubleArrayOf(3136.0, 3729.0, 2793.0, 4186.0, 3520.0, 4699.0, 5274.0, 4400.0)

        for (i in 0 until totalSamples) {
            val t = i.toDouble() / SAMPLE_RATE
            var sample = 0.0

            // Latch / Drawer Snap (t < 0.12)
            if (t < 0.12) {
                val envLatch = exp(-t / 0.025)
                val thump = sin(twoPi * 135.0 * t) * 0.45
                val click = (sin(twoPi * 2400.0 * t) + sin(twoPi * 3800.0 * t)) * 0.35
                sample += (thump + click) * envLatch
            }

            // Bell Chime / Cha-Ching Ring (t >= 0.08)
            if (t >= 0.08) {
                val dt = t - 0.08
                val envBell = exp(-dt / 0.22)
                val bell = sin(twoPi * 1760.0 * dt) * 0.45 +
                        sin(twoPi * 2640.0 * dt) * 0.28 +
                        sin(twoPi * 3520.0 * dt) * 0.15 +
                        sin(twoPi * 5280.0 * dt) * 0.08
                sample += bell * envBell
            }

            // Falling Coins Shower
            for (c in coinTimes.indices) {
                val ct = coinTimes[c]
                if (t >= ct) {
                    val dt = t - ct
                    val envCoin = exp(-dt / 0.055)
                    val f0 = coinFreqs[c]
                    val coinClink = (sin(twoPi * f0 * dt) * 0.35 +
                            sin(twoPi * (f0 * 1.52) * dt) * 0.22 +
                            sin(twoPi * (f0 * 2.31) * dt) * 0.12)
                    sample += coinClink * envCoin
                }
            }

            val clamped = (sample * 24000.0).coerceIn(-32767.0, 32767.0)
            buffer[i] = clamped.toInt().toShort()
        }
        buffer
    }

    /**
     * Synthesizes Deep Financial Rejection Buzz (Error de Pago / Fondos / Límites superados / Rechazo)
     * Two distinct descending dissonant buzz pulses
     */
    private val paymentErrorPcm: ShortArray by lazy {
        val duration = 0.52
        val totalSamples = (SAMPLE_RATE * duration).toInt()
        val buffer = ShortArray(totalSamples)
        val twoPi = 2.0 * Math.PI

        for (i in 0 until totalSamples) {
            val t = i.toDouble() / SAMPLE_RATE
            var sample = 0.0

            // Pulse 1: 0.0 to 0.20s (Dissonant 185Hz + 233Hz)
            if (t < 0.20) {
                val env = (1.0 - t / 0.20).coerceAtLeast(0.0)
                val f1 = 185.0
                val f2 = 233.0
                val buzz = sin(twoPi * f1 * t) * 0.5 +
                        sin(twoPi * f2 * t) * 0.4 +
                        sin(twoPi * (f1 * 2) * t) * 0.25
                sample += buzz * env
            }
            // Pulse 2: 0.24 to 0.48s (Deeper descending 138Hz + 174Hz)
            else if (t in 0.24..0.48) {
                val dt = t - 0.24
                val env = (1.0 - dt / 0.24).coerceAtLeast(0.0)
                val f1 = 138.0 - (dt * 50.0)
                val f2 = 174.0 - (dt * 60.0)
                val buzz = sin(twoPi * f1 * dt) * 0.55 +
                        sin(twoPi * f2 * dt) * 0.45 +
                        sin(twoPi * (f1 * 2) * dt) * 0.3
                sample += buzz * env
            }

            val clamped = (sample * 26000.0).coerceIn(-32767.0, 32767.0)
            buffer[i] = clamped.toInt().toShort()
        }
        buffer
    }

    /**
     * Synthesizes Fast Double Warning Chirp (Error de Escaneo NFC / Tarjeta Inválida / Misma Tarjeta)
     * High-pitched rapid double warning blip
     */
    private val cardScanErrorPcm: ShortArray by lazy {
        val duration = 0.30
        val totalSamples = (SAMPLE_RATE * duration).toInt()
        val buffer = ShortArray(totalSamples)
        val twoPi = 2.0 * Math.PI

        for (i in 0 until totalSamples) {
            val t = i.toDouble() / SAMPLE_RATE
            var sample = 0.0

            // Chirp 1: 0.0 to 0.09s (988 Hz)
            if (t < 0.09) {
                val env = (1.0 - t / 0.09).coerceAtLeast(0.0)
                val tone = sin(twoPi * 988.0 * t) * 0.6 + sin(twoPi * 1976.0 * t) * 0.2
                sample += tone * env
            }
            // Chirp 2: 0.13 to 0.26s (659 Hz)
            else if (t in 0.13..0.26) {
                val dt = t - 0.13
                val env = (1.0 - dt / 0.13).coerceAtLeast(0.0)
                val tone = sin(twoPi * 659.0 * dt) * 0.65 + sin(twoPi * 1318.0 * dt) * 0.25
                sample += tone * env
            }

            val clamped = (sample * 26000.0).coerceIn(-32767.0, 32767.0)
            buffer[i] = clamped.toInt().toShort()
        }
        buffer
    }

    private fun playPcm(pcm: ShortArray) {
        if (!isSoundEnabled) return
        audioExecutor.execute {
            try {
                val audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(SAMPLE_RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(pcm.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                audioTrack.write(pcm, 0, pcm.size)
                audioTrack.play()
                val durationMs = (pcm.size.toDouble() / SAMPLE_RATE * 1000).toLong() + 40
                Thread.sleep(durationMs)
                audioTrack.stop()
                audioTrack.release()
            } catch (e: Exception) {
                try {
                    toneGen?.startTone(ToneGenerator.TONE_PROP_ACK, 200)
                } catch (t: Exception) {}
            }
        }
    }

    // --- PUBLIC PLAYBACK FUNCTIONS ---

    fun playKeyClick(context: Context) {
        initPreferences(context)
        if (isSoundEnabled) {
            try {
                toneGen?.startTone(ToneGenerator.TONE_DTMF_1, 30)
            } catch (e: Exception) {}
        }
        if (isVibrationEnabled) {
            vibrate(context, 18)
        }
    }

    fun playCardDetected(context: Context) {
        initPreferences(context)
        if (isSoundEnabled) {
            try {
                toneGen?.startTone(ToneGenerator.TONE_PROP_BEEP, 90)
            } catch (e: Exception) {}
        }
        if (isVibrationEnabled) {
            vibrate(context, 75)
        }
    }

    /**
     * Pago Aprobado: Caja Fuerte + Cascada de Monedas de Oro ("Cha-ching" y monedas cayendo)
     */
    fun playPaymentApprovedCoins(context: Context) {
        initPreferences(context)
        if (isSoundEnabled) {
            playPcm(paymentApprovedCoinsPcm)
        }
        if (isVibrationEnabled) {
            vibratePattern(context, longArrayOf(0, 80, 50, 90, 40, 150))
        }
    }

    fun playSuccess(context: Context) {
        playPaymentApprovedCoins(context)
    }

    /**
     * Error de Pago: Rechazo de Transacción, Límites Superados (Superior/Inferior), Saldo Insuficiente
     */
    fun playPaymentError(context: Context) {
        initPreferences(context)
        if (isSoundEnabled) {
            playPcm(paymentErrorPcm)
        }
        if (isVibrationEnabled) {
            vibratePattern(context, longArrayOf(0, 160, 80, 220))
        }
    }

    /**
     * Error de Tarjeta / Escaneo NFC: Tarjeta Inválida, Tarjeta Duplicada, No Reconocida, Error de Lectura
     */
    fun playCardScanError(context: Context) {
        initPreferences(context)
        if (isSoundEnabled) {
            playPcm(cardScanErrorPcm)
        }
        if (isVibrationEnabled) {
            vibratePattern(context, longArrayOf(0, 50, 40, 50))
        }
    }

    fun playError(context: Context) {
        playPaymentError(context)
    }

    private fun vibrate(context: Context, durationMs: Long) {
        if (!isVibrationEnabled) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(durationMs)
                }
            }
        } catch (e: Exception) {}
    }

    private fun vibratePattern(context: Context, timings: LongArray) {
        if (!isVibrationEnabled) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(timings, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(timings, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(timings, -1)
                }
            }
        } catch (e: Exception) {}
    }
}
