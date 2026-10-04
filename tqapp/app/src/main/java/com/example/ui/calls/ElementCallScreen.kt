package com.example.ui.calls

import android.annotation.SuppressLint
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.example.data.repository.MatrixRepository
import kotlinx.coroutines.launch

/**
 * The Element Call widget page runs as a top-level document (not inside an
 * iframe), so its calls to `window.parent.postMessage(...)` would otherwise
 * loop back into itself instead of reaching the native host. This script
 * (injected before any page script runs) redirects outgoing widget messages
 * to the `elementX` JavaScript interface, and exposes a function the native
 * side can call to deliver messages back into the page as proper
 * `MessageEvent`s, mirroring how a real widget iframe would behave.
 */
private const val WIDGET_BRIDGE_SCRIPT = """
(function() {
  if (window.__tqappBridgeInstalled) return;
  window.__tqappBridgeInstalled = true;
  console.log('[tqapp-bridge] installed');
  window.postMessage = function(message, targetOrigin, transfer) {
    try {
      if (window.elementX && window.elementX.postMessage) {
        window.elementX.postMessage(JSON.stringify(message));
      }
    } catch (e) {}
  };
  function relaxTrackConstraints(track) {
    if (!track || typeof track !== 'object') return track;
    var relaxed = {};
    Object.keys(track).forEach(function(key) {
      var value = track[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        var inner = {};
        Object.keys(value).forEach(function(k) {
          // Convert hard "exact"/"min" constraints (which throw
          // OverconstrainedError on devices that don't match exactly) into
          // soft "ideal" hints instead.
          if (k === 'exact' || k === 'min') inner.ideal = value[k];
          else inner[k] = value[k];
        });
        relaxed[key] = inner;
      } else {
        relaxed[key] = value;
      }
    });
    return relaxed;
  }
  if (window.navigator && window.navigator.mediaDevices && window.navigator.mediaDevices.getUserMedia) {
    var originalGetUserMedia = window.navigator.mediaDevices.getUserMedia.bind(window.navigator.mediaDevices);
    window.navigator.mediaDevices.getUserMedia = function(constraints) {
      var safeConstraints = constraints;
      try {
        safeConstraints = {
          audio: relaxTrackConstraints(constraints && constraints.audio),
          video: relaxTrackConstraints(constraints && constraints.video)
        };
        if (!constraints || !constraints.audio) safeConstraints.audio = constraints ? constraints.audio : undefined;
        if (!constraints || !constraints.video) safeConstraints.video = constraints ? constraints.video : undefined;
      } catch (e) {}
      return originalGetUserMedia(safeConstraints).catch(function(err) {
        console.error('getUserMedia failed: ' + err.name + ' - ' + err.message + ' constraints=' + JSON.stringify(safeConstraints));
        // Retry once with maximally relaxed constraints before giving up.
        return originalGetUserMedia({ audio: !!safeConstraints.audio, video: !!safeConstraints.video }).catch(function(err2) {
          console.error('getUserMedia retry also failed: ' + err2.name + ' - ' + err2.message);
          throw err2;
        });
      });
    };
  }
  // Android's system WebView does not implement the Audio Output Devices API
  // (HTMLMediaElement.setSinkId / navigator.mediaDevices.selectAudioOutput).
  // Element Call calls these unconditionally, which throws and crashes the
  // whole call view. Polyfill them as harmless no-ops.
  if (window.HTMLMediaElement && !window.HTMLMediaElement.prototype.setSinkId) {
    window.HTMLMediaElement.prototype.setSinkId = function() { return Promise.resolve(); };
  }
  if (window.navigator && window.navigator.mediaDevices && !window.navigator.mediaDevices.selectAudioOutput) {
    window.navigator.mediaDevices.selectAudioOutput = function() { return Promise.reject(new DOMException('Not supported', 'NotSupportedError')); };
  }
  window.__deliverFromNative = function(json) {
    try {
      var data = JSON.parse(json);
      var event = new MessageEvent('message', { data: data, origin: window.location.origin, source: window });
      window.dispatchEvent(event);
    } catch (e) {}
  };
})();
"""

/**
 * Renders a real MatrixRTC call using the Element Call widget embedded in
 * the app (io.element.android:element-call-embedded). The widget's own UI
 * (mute/camera/hangup/participants) runs inside the WebView; messages are
 * bridged to the Matrix Rust SDK's WidgetDriver over the room's timeline.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ElementCallScreen(
    session: MatrixRepository.ElementCallSession,
    onClose: () -> Unit
) {
    val context = LocalContext.current

    // WebRTC audio capture inside a WebView needs the app to already own audio
    // focus and be in "communication" mode, or Chromium fails with
    // NotReadableError ("Unable to select communication device") on many
    // devices (notably Samsung/OneUI).
    DisposableEffect(Unit) {
        val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as? android.media.AudioManager
        val previousMode = audioManager?.mode ?: android.media.AudioManager.MODE_NORMAL
        var focusRequest: android.media.AudioFocusRequest? = null
        if (audioManager != null) {
            audioManager.mode = android.media.AudioManager.MODE_IN_COMMUNICATION
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val attrs = android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                val request = android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setAudioAttributes(attrs)
                    .build()
                audioManager.requestAudioFocus(request)
                focusRequest = request
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null, android.media.AudioManager.STREAM_VOICE_CALL, android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
                )
            }
        }
        onDispose {
            if (audioManager != null) {
                focusRequest?.let {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        audioManager.abandonAudioFocusRequest(it)
                    }
                }
                audioManager.mode = previousMode
            }
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
            val webView = remember {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    webChromeClient = object : WebChromeClient() {
                        override fun onPermissionRequest(request: PermissionRequest) {
                            android.util.Log.d("ElementCall", "onPermissionRequest: ${request.resources.joinToString()} origin=${request.origin}")
                            request.grant(request.resources)
                        }
                        override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage): Boolean {
                            android.util.Log.d(
                                "ElementCallJS",
                                "${consoleMessage.messageLevel()} ${consoleMessage.message()} @${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}"
                            )
                            return true
                        }
                    }
                    val assetLoader = WebViewAssetLoader.Builder()
                        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                        .build()
                    webViewClient = object : android.webkit.WebViewClient() {
                        override fun shouldInterceptRequest(
                            view: WebView,
                            request: android.webkit.WebResourceRequest
                        ): android.webkit.WebResourceResponse? {
                            val response = assetLoader.shouldInterceptRequest(request.url)
                            android.util.Log.d("ElementCall", "asset request ${request.url} -> ${if (response != null) "OK (${response.mimeType})" else "MISS"}")
                            return response
                        }

                        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                            super.onPageStarted(view, url, favicon)
                            // Fallback for WebViews without DOCUMENT_START_SCRIPT support.
                            if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                                view.evaluateJavascript(WIDGET_BRIDGE_SCRIPT, null)
                            }
                        }
                    }
                    addJavascriptInterface(
                        object {
                            @android.webkit.JavascriptInterface
                            fun postMessage(message: String) {
                                (context as? androidx.activity.ComponentActivity)?.lifecycleScope?.launch {
                                    // Log the widget protocol action/event type so we can
                                    // see exactly what Element Call asks the driver to do
                                    // (e.g. send_event m.rtc.notification, get_rtc_transports).
                                    try {
                                        val json = org.json.JSONObject(message)
                                        val action = json.optString("action", "?")
                                        val api = json.optString("api", "?")
                                        val dataType = json.optJSONObject("data")?.optString("type") ?: ""
                                        android.util.Log.d("ElementCall", "widget->native api=$api action=$action dataType=$dataType")
                                    } catch (_: Exception) {}
                                    val ok = session.sendFromWidget(message)
                                    android.util.Log.d("ElementCall", "sendFromWidget ok=$ok len=${message.length}")
                                }
                            }
                        },
                        "elementX"
                    )
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                        WebViewCompat.addDocumentStartJavaScript(this, WIDGET_BRIDGE_SCRIPT, setOf("*"))
                    }
                }
            }

            AndroidView(
                factory = { webView.apply { loadUrl(session.widgetUrl) } },
                modifier = Modifier.fillMaxSize()
            )

            // Pump messages coming from the SDK/room into the widget page.
            LaunchedEffect(session) {
                while (true) {
                    val message = session.nextOutgoingMessage() ?: break
                    android.util.Log.d("ElementCall", "deliverFromNative len=${message.length}")
                    val escaped = org.json.JSONObject.quote(message)
                    webView.post {
                        webView.evaluateJavascript(
                            "window.__deliverFromNative && window.__deliverFromNative($escaped)",
                            null
                        )
                    }
                }
                android.util.Log.d("ElementCall", "outgoing message pump ended")
            }

            // Element Call restores its remembered lobby mute state, so calls
            // can start with the mic muted. WhatsApp behavior: the mic is on
            // once the call connects. Send the host->widget
            // io.element.device_mute action a few times (it only applies once
            // EC has registered its handler after joining).
            LaunchedEffect(session) {
                repeat(3) { attempt ->
                    kotlinx.coroutines.delay(if (attempt == 0) 2500L else 3000L)
                    val action = org.json.JSONObject()
                        .put("api", "toWidget")
                        .put("widgetId", session.widgetId)
                        .put("requestId", java.util.UUID.randomUUID().toString())
                        .put("action", "io.element.device_mute")
                        .put(
                            "data",
                            org.json.JSONObject()
                                .put("audio_enabled", true)
                                .put("video_enabled", session.isVideo)
                        )
                    val escaped = org.json.JSONObject.quote(action.toString())
                    webView.post {
                        webView.evaluateJavascript(
                            "window.__deliverFromNative && window.__deliverFromNative($escaped)",
                            null
                        )
                    }
                }
            }

            DisposableEffect(Unit) {
                onDispose { webView.destroy() }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopStart)
                    .background(Color(0xFF075E54))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(session.roomName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("Llamada Matrix", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, contentDescription = "Cerrar llamada", tint = Color.White)
                }
            }
        }
    }
}
