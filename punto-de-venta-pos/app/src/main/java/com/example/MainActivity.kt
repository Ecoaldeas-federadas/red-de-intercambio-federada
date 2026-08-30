package com.example

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.room.Room
import com.example.data.crypto.CryptoEngine
import com.example.data.db.AppDatabase
import com.example.data.db.MIGRATION_2_3
import com.example.data.db.MIGRATION_3_4
import com.example.ui.components.DemoWatermarkOverlay
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
            )
            .addMigrations(MIGRATION_2_3, MIGRATION_3_4)
            // fallback solo como ultima opcion para migraciones futuras no previstas,
            // pero MIGRATION_2_3 y MIGRATION_3_4 preservan los datos existentes al actualizar.
            .fallbackToDestructiveMigration()
            .build().also { instance = it }
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

class MainActivity : ComponentActivity(), NfcAdapter.ReaderCallback {
    private var nfcAdapter: NfcAdapter? = null
    private lateinit var viewModel: PosViewModel

    private val nfcStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == NfcAdapter.ACTION_ADAPTER_STATE_CHANGED) {
                val state = intent.getIntExtra(NfcAdapter.EXTRA_ADAPTER_STATE, NfcAdapter.STATE_OFF)
                val isEnabled = (state == NfcAdapter.STATE_ON)
                viewModel.updateNfcHardwareStatus(hasHardware = (nfcAdapter != null), isEnabled = isEnabled)
                if (isEnabled) {
                    enableNfcReaderMode()
                } else {
                    disableNfcReaderMode()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Keep screen active for continuous kiosk terminal operation
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val database = DatabaseProvider.getDatabase(this)
        val factory = PosViewModelFactory(application, database)
        viewModel = ViewModelProvider(this, factory)[PosViewModel::class.java]

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        val hasHardware = (nfcAdapter != null)
        val isEnabled = nfcAdapter?.isEnabled == true
        viewModel.updateNfcHardwareStatus(hasHardware, isEnabled)

        val filter = IntentFilter(NfcAdapter.ACTION_ADAPTER_STATE_CHANGED)
        registerReceiver(nfcStateReceiver, filter)

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
        val adapter = nfcAdapter
        val hasHardware = (adapter != null)
        val isEnabled = adapter?.isEnabled == true
        viewModel.updateNfcHardwareStatus(hasHardware, isEnabled)

        if (adapter != null && isEnabled) {
            enableNfcReaderMode()
        }
    }

    override fun onPause() {
        super.onPause()
        disableNfcReaderMode()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(nfcStateReceiver)
        } catch (e: Exception) {
            // ignore
        }
    }

    private fun enableNfcReaderMode() {
        val adapter = nfcAdapter ?: return
        if (!adapter.isEnabled) return

        // Intercept all NFC technologies directly and suppress system tag dispatcher & sound popups
        val flags = NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V or
                NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS

        val extras = Bundle().apply {
            putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250)
        }

        try {
            adapter.enableReaderMode(this, this, flags, extras)
        } catch (e: Exception) {
            // Safe fallback
        }
    }

    private fun disableNfcReaderMode() {
        try {
            nfcAdapter?.disableReaderMode(this)
        } catch (e: Exception) {
            // ignore
        }
    }

    private var lastDiscoveredTag: Tag? = null

    override fun onTagDiscovered(tag: Tag?) {
        if (tag == null) return
        val tagId = tag.id ?: return
        val cardUid = CryptoEngine.bytesToHex(tagId)
        val techList = tag.techList.toList()
        val isDesfire = techList.any {
            it.contains("IsoDep", ignoreCase = true) || it.contains("Desfire", ignoreCase = true)
        }
        val isMifareClassic = techList.any { it == "android.nfc.tech.MifareClassic" }

        // Guardar el tag para el flujo Classic (lectura/escritura de sectores)
        if (isMifareClassic) {
            lastDiscoveredTag = tag
        }

        runOnUiThread {
            processCardTap(cardUid, isDesfire, isMifareClassic, if (isMifareClassic) tag else null)
        }
    }

    private fun processCardTap(cardUid: String, isDesfire: Boolean, isMifareClassic: Boolean = false, tag: Tag? = null) {
        val currentScreen = viewModel.uiState.value.currentScreen
        when (currentScreen) {
            is PosScreen.NfcCharge -> {
                val state = viewModel.uiState.value

                // Solo procesar tarjetas si estamos en step "tap_card" (despues del pre-auth)
                if (state.classicStep != "tap_card") {
                    // Ignorar tap si no estamos esperando tarjeta
                    return
                }

                // Flujo Classic: si tenemos tag fisico, leer/escribir sectores
                if (state.isClassicFlow && tag != null) {
                    val reader = com.example.data.nfc.MifareClassicReader()
                    viewModel.onClassicCardTapped(tag, reader)
                    return
                }

                // Flujo uid_only/desfire: onCardTapped verifica UID contra pre-auth
                viewModel.onCardTapped(cardUid, isDesfire)
            }
            is PosScreen.MultiVendor -> {
                val state = viewModel.uiState.value
                val step = state.mvStep
                if (step == 1) {
                    viewModel.onMultiVendorSellerTapped(cardUid)
                } else if (step == 5 && !state.isMultisigActive) {
                    viewModel.onMultiVendorBuyerTapped(cardUid, isDesfire = isDesfire)
                } else if (state.isMultisigActive) {
                    viewModel.submitMultisigSigner(
                        cardUid = cardUid,
                        pin = if (state.customerPin.isNotBlank()) state.customerPin else state.buyerPin,
                        docType = if (state.selectedDocType.isNotBlank()) state.selectedDocType else state.buyerDocType,
                        docNum = if (state.idDocNumber.isNotBlank()) state.idDocNumber else state.buyerDocNumber
                    )
                }
            }
            is PosScreen.ProvisionCard -> {
                // En provisionamiento, leer el UID de la tarjeta en blanco
                if (isMifareClassic && tag != null) {
                    // El UID ya se leyo, solo actualizar el estado
                    viewModel.setProvisionCardUid(cardUid)
                }
            }
            else -> {
                // SILENTLY IGNORE on all other screens
            }
        }
    }
}

@Composable
fun PosMainContent(viewModel: PosViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var lastBackPressTime by remember { mutableLongStateOf(0L) }

    // Intercept hardware/system back button
    BackHandler {
        val handled = viewModel.handleBackPress()
        if (!handled) {
            // We are on the main/root screen
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastBackPressTime < 2000) {
                (context as? ComponentActivity)?.finish()
            } else {
                lastBackPressTime = currentTime
                Toast.makeText(context, "Presione nuevamente para salir", Toast.LENGTH_SHORT).show()
            }
        }
    }

    DemoWatermarkOverlay(
        isDemo = uiState.isDemoNode,
        onBannerClick = {
            viewModel.navigateTo(PosScreen.Settings)
        }
    ) {
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
                is PosScreen.ProvisionCard -> ProvisionCardScreen(viewModel = viewModel)
            }
        }
    }
}
