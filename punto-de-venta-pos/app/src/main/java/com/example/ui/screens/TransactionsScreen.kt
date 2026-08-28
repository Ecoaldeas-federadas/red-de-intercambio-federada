package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.db.TransactionEntity
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.util.FeedbackHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val transactions by viewModel.transactions.collectAsState()
    var selectedFilter by remember { mutableStateOf("TODOS") }
    var selectedTransaction by remember { mutableStateOf<TransactionEntity?>(null) }
    val context = LocalContext.current

    val filtered = when (selectedFilter) {
        "QR" -> transactions.filter { it.paymentMethod == "qr" }
        "NFC" -> transactions.filter { it.paymentMethod.startsWith("nfc") }
        "MULTI-VENDEDOR" -> transactions.filter { it.paymentMethod == "nfc_community" }
        else -> transactions
    }

    val totalSales = transactions.filter { it.status == "approved" }.sumOf { it.amount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Historial de Ventas",
                        fontWeight = FontWeight.Bold,
                        color = PosSlate100
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            FeedbackHelper.playButtonClick(context)
                            viewModel.navigateTo(PosScreen.Dashboard)
                        },
                        modifier = Modifier.testTag("trans_back_btn")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                            tint = PosSlate100
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PosSlate900)
            )
        },
        containerColor = PosNavyDark
    ) { padding ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // SUMMARY CARD
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PosSlate900),
                shape = RoundedCornerShape(18.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "TOTAL RECAUDADO (HISTÓRICO)",
                            style = MaterialTheme.typography.labelSmall,
                            color = PosSlate300,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = CurrencyHelper.formatMicroUnits(totalSales),
                            style = MaterialTheme.typography.headlineMedium,
                            color = PosGoldLight,
                            fontWeight = FontWeight.Black
                        )
                    }
                    Text(
                        text = "${transactions.size} ventas",
                        style = MaterialTheme.typography.labelMedium,
                        color = PosPrimaryLight,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // FILTER TABS
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val filters = listOf("TODOS", "NFC", "QR", "MULTI-VENDEDOR")
                filters.forEach { filter ->
                    val isSelected = (selectedFilter == filter)
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilter = filter },
                        label = { Text(filter, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PosPrimaryBlue,
                            selectedLabelColor = PosWhite,
                            containerColor = PosSlate800,
                            labelColor = PosSlate300
                        )
                    )
                }
            }

            if (filtered.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Receipt,
                            contentDescription = null,
                            tint = PosSlate600,
                            modifier = Modifier.size(54.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No hay transacciones registradas", color = PosSlate300)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filtered) { tx ->
                        TransactionItemCard(
                            transaction = tx,
                            onClick = { selectedTransaction = tx }
                        )
                    }
                }
            }
        }
    }

    // TRANSACTION DETAIL DIALOG
    if (selectedTransaction != null) {
        val tx = selectedTransaction!!
        AlertDialog(
            onDismissRequest = { selectedTransaction = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Default.ReceiptLong, contentDescription = null, tint = PosPrimaryLight)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Detalle del Comprobante", fontWeight = FontWeight.Bold, color = PosSlate100)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Monto:", color = PosSlate300)
                        Text(CurrencyHelper.formatMicroUnits(tx.amount), color = PosGoldLight, fontWeight = FontWeight.Black)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Método:", color = PosSlate300)
                        Text(tx.paymentMethod.uppercase(), color = PosSlate100, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Estado:", color = PosSlate300)
                        Text(tx.status.uppercase(), color = PosSuccessGreenLight, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Comprobante:", color = PosSlate300)
                        Text(tx.receiptNumber ?: tx.id.take(8), color = PosSlate100)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Fecha y Hora:", color = PosSlate300)
                        Text(CurrencyHelper.formatDateTime(tx.timestamp), color = PosSlate300)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        FeedbackHelper.playButtonClick(context)
                        selectedTransaction = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue)
                ) {
                    Text("Cerrar", color = PosWhite)
                }
            },
            containerColor = PosSlate900
        )
    }
}

@Composable
fun TransactionItemCard(
    transaction: TransactionEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .testTag("tx_item_${transaction.id}"),
        colors = CardDefaults.cardColors(containerColor = PosSlate800),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            when (transaction.paymentMethod) {
                                "qr" -> PosSecondaryLight.copy(alpha = 0.2f)
                                "nfc_community" -> PosGoldLight.copy(alpha = 0.2f)
                                else -> PosPrimaryLight.copy(alpha = 0.2f)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = when (transaction.paymentMethod) {
                            "qr" -> Icons.Default.QrCode2
                            "nfc_community" -> Icons.Default.Storefront
                            else -> Icons.Default.Nfc
                        },
                        contentDescription = null,
                        tint = when (transaction.paymentMethod) {
                            "qr" -> PosSecondaryLight
                            "nfc_community" -> PosGoldLight
                            else -> PosPrimaryLight
                        },
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = when (transaction.paymentMethod) {
                            "qr" -> "Cobro QR"
                            "nfc_community" -> "Multi-Vendedor"
                            else -> "Terminal NFC"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = CurrencyHelper.formatDateTime(transaction.timestamp),
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "+${CurrencyHelper.formatMicroUnits(transaction.amount)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = PosGoldLight,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Aprobado",
                    style = MaterialTheme.typography.labelSmall,
                    color = PosSuccessGreenLight,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
