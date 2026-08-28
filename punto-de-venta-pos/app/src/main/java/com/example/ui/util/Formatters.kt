package com.example.ui.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.media.AudioManager
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

    init {
        try {
            toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            // Tone generator fallback
        }
    }

    fun playCardDetected(context: Context) {
        try {
            toneGen?.startTone(ToneGenerator.TONE_PROP_BEEP, 100)
        } catch (e: Exception) {}
        vibrate(context, 80)
    }

    fun playSuccess(context: Context) {
        try {
            toneGen?.startTone(ToneGenerator.TONE_PROP_ACK, 250)
        } catch (e: Exception) {}
        vibratePattern(context, longArrayOf(0, 100, 80, 180))
    }

    fun playError(context: Context) {
        try {
            toneGen?.startTone(ToneGenerator.TONE_PROP_NACK, 350)
        } catch (e: Exception) {}
        vibratePattern(context, longArrayOf(0, 200, 100, 200))
    }

    private fun vibrate(context: Context, durationMs: Long) {
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
