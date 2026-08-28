package com.example.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.platform.LocalContext
import com.example.ui.util.FeedbackHelper

/**
 * Modificador que reproduce sonido + vibracion al hacer click en cualquier elemento.
 * Usa playButtonClick (sonido tactil moderno para botones de accion, navegacion, etc).
 * Respeta las preferencias del usuario (isSoundEnabled, soundVolume, isVibrationEnabled).
 *
 * Usar en lugar de Modifier.clickable { } para cualquier boton/enlace clickable
 * que NO sea del teclado numerico (el teclado usa playKeyClick directamente).
 *
 * Ejemplo:
 *   Box(modifier = Modifier.feedbackClickable { onClick() }) { ... }
 */
fun Modifier.feedbackClickable(onClick: () -> Unit): Modifier = composed {
    val context = LocalContext.current
    this.clickable {
        FeedbackHelper.playButtonClick(context)
        onClick()
    }
}

/**
 * Funcion helper para llamar desde onClick de Button/OutlinedButton/TextButton
 * de Material3 (que usan onClick como parametro, no Modifier.clickable).
 *
 * Ejemplo:
 *   Button(onClick = { feedbackClick(context) { doAction() } }) { ... }
 */
@Composable
fun rememberFeedbackClick(): (context: android.content.Context, action: () -> Unit) -> Unit {
    return { context, action ->
        FeedbackHelper.playButtonClick(context)
        action()
    }
}
