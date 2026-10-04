package com.example

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.WhatsAppMatrixViewModel
import com.example.ui.auth.MatrixAuthScreen
import com.example.ui.main.MainScreen
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private val viewModel: WhatsAppMatrixViewModel by viewModels()

    private val notificationPermissionLauncher =
        registerForActivityResult(
            androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
        ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)
        requestNotificationPermission()
        setContent {
            MyApplicationTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WhatsAppMatrixApp(viewModel = viewModel)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    override fun onStart() {
        super.onStart()
        com.example.calls.MatrixSyncService.uiVisible = true
    }

    override fun onStop() {
        com.example.calls.MatrixSyncService.uiVisible = false
        super.onStop()
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun handleDeepLink(intent: Intent?) {
        // Launched by the incoming-call full-screen notification: show the
        // answer UI over the lock screen.
        if (intent?.getBooleanExtra(
                com.example.calls.MatrixSyncService.EXTRA_SHOW_INCOMING_CALL, false) == true) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        // Message-notification tap: open that room directly.
        intent?.getStringExtra(com.example.calls.MatrixSyncService.EXTRA_ROOM_ID)
            ?.let { viewModel.repository.requestOpenRoom(it) }
        val data = intent?.data ?: return
        if (data.scheme == "tqapp" && data.host == "login") {
            val token = data.getQueryParameter("loginToken")
            if (!token.isNullOrBlank()) {
                viewModel.loginWithToken(token)
            }
        }
    }
}

@Composable
fun WhatsAppMatrixApp(viewModel: WhatsAppMatrixViewModel) {
    val session by viewModel.sessionState.collectAsStateWithLifecycle()
    val servers by viewModel.serversList.collectAsStateWithLifecycle()
    val selectedServer by viewModel.selectedServer.collectAsStateWithLifecycle()
    val isLoading by viewModel.authLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.authError.collectAsStateWithLifecycle()
    val recaptchaChallenge by viewModel.recaptchaChallenge.collectAsStateWithLifecycle()

    if (session == null || !session!!.isLoggedIn) {
        MatrixAuthScreen(
            servers = servers,
            selectedServer = selectedServer,
            isLoading = isLoading,
            errorMessage = errorMessage,
            recaptchaChallenge = recaptchaChallenge,
            onSelectServer = { viewModel.selectServer(it) },
            onAddCustomServer = { name, url -> viewModel.addCustomServer(name, url) },
            onLogin = { user, pass -> viewModel.login(user, pass) },
            onRegister = { user, pass -> viewModel.register(user, pass) },
            onLoginWithToken = { token -> viewModel.loginWithToken(token) },
            onCompleteRecaptcha = { viewModel.completeRecaptcha(it) },
            onDismissRecaptcha = { viewModel.dismissRecaptcha() },
            onQuickDemo = { user -> viewModel.loginAsDemo(user) },
            onClearError = { viewModel.clearAuthError() }
        )
    } else {
        MainScreen(viewModel = viewModel)
    }
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    androidx.compose.material3.Text(text = "Hello $name!", modifier = modifier)
}
