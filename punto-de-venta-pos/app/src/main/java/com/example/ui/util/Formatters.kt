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
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.EnumMap
import java.util.Locale

object CurrencyHelper {
    /**
     * Converts micro-units integer (e.g. 50000) to formatted TQ string (e.g. "500.00 TQ")
     */
    fun formatMicroUnits(microUnits: Long): String {
        val amount = microUnits / 100.0
        val formatter = NumberFormat.getNumberInstance(Locale("es", "ES")).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        return "${formatter.format(amount)} TQ"
    }

    /**
     * Converts raw string input from POS keypad (e.g. "500.50" or "500") to integer micro-units (50050)
     */
    fun parseInputToMicroUnits(input: String): Long {
        val clean = input.replace(",", ".").trim()
        val d = clean.toDoubleOrNull() ?: 0.0
        return (d * 100).toLong()
    }

    fun formatDateTime(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale("es", "ES"))
        return sdf.format(Date(timestamp))
    }

    fun formatTime(timestamp: Long): String {
        val sdf = SimpleDateFormat("HH:mm", Locale("es", "ES"))
        return sdf.format(Date(timestamp))
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
