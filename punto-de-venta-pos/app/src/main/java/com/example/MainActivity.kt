package com.example

import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.room.Room
import com.example.data.crypto.CryptoEngine
import com.example.data.db.AppDatabase
import com.example.ui.screens.*
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

object DatabaseProvider {
    @Volatile
    private var instance: AppDatabase? = null

    fun getDatabase(context: Context): AppDatabase {
        return instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "pos_terminal_db.db"
            ).fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}

class PosViewModelFactory(
    private val application: Application,
    private val database: AppDatabase
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(PosViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return PosViewModel(application, database) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

class MainActivity : ComponentActivity() {
    private var nfcAdapter: NfcAdapter? = null
    private var pendingIntent: PendingIntent? = null
    private lateinit var viewModel: PosViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Keep screen active for continuous kiosk terminal operation
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val database = DatabaseProvider.getDatabase(this)
        val factory = PosViewModelFactory(application, database)
        viewModel = ViewModelProvider(this, factory)[PosViewModel::class.java]

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    PosMainContent(viewModel = viewModel)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.let { adapter ->
            if (adapter.isEnabled && pendingIntent != null) {
                adapter.enableForegroundDispatch(this, pendingIntent, null, null)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNfcIntent(intent)
    }

    private fun handleNfcIntent(intent: Intent) {
        if (NfcAdapter.ACTION_TAG_DISCOVERED == intent.action ||
            NfcAdapter.ACTION_TECH_DISCOVERED == intent.action ||
            NfcAdapter.ACTION_NDEF_DISCOVERED == intent.action
        ) {
            val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            } ?: return

            val tagId = tag.id ?: return
            val cardUid = CryptoEngine.bytesToHex(tagId)
            val techList = tag.techList.toList()
            val isDesfire = techList.any {
                it.contains("IsoDep", ignoreCase = true) || it.contains("Desfire", ignoreCase = true)
            }

            val currentScreen = viewModel.uiState.value.currentScreen
            when (currentScreen) {
                is PosScreen.NfcCharge -> {
                    viewModel.onCardTapped(cardUid, isDesfire)
                }
                is PosScreen.MultiVendor -> {
                    val step = viewModel.uiState.value.mvStep
                    if (step == 1) {
                        viewModel.onMultiVendorSellerTapped(cardUid)
                    } else if (step == 3) {
                        viewModel.onMultiVendorBuyerTapped(cardUid)
                    }
                }
                else -> {
                    // Quick transition to NFC charge when card is tapped on dashboard
                    viewModel.navigateTo(PosScreen.NfcCharge)
                    viewModel.onCardTapped(cardUid, isDesfire)
                }
            }
        }
    }
}

@Composable
fun PosMainContent(viewModel: PosViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    AnimatedContent(
        targetState = uiState.currentScreen,
        transitionSpec = {
            fadeIn() togetherWith fadeOut()
        },
        label = "screen_transition"
    ) { screen ->
        when (screen) {
            is PosScreen.RegisterTerminal -> RegisterTerminalScreen(viewModel = viewModel)
            is PosScreen.Login -> LoginScreen(viewModel = viewModel)
            is PosScreen.Dashboard -> DashboardScreen(viewModel = viewModel)
            is PosScreen.QrCharge -> QrChargeScreen(viewModel = viewModel)
            is PosScreen.NfcCharge -> NfcChargeScreen(viewModel = viewModel)
            is PosScreen.MultiVendor -> MultiVendorScreen(viewModel = viewModel)
            is PosScreen.Transactions -> TransactionsScreen(viewModel = viewModel)
            is PosScreen.Admin -> AdminScreen(viewModel = viewModel)
            is PosScreen.Settings -> SettingsScreen(viewModel = viewModel)
            is PosScreen.ShiftManagement -> ShiftManagementScreen(viewModel = viewModel)
        }
    }
}
