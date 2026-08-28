package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.util.CurrencyHelper
import com.example.ui.viewmodel.PosScreen
import com.example.ui.viewmodel.PosViewModel

@Composable
fun DashboardScreen(
    viewModel: PosViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val shift by viewModel.latestShift.collectAsState()
    val isShiftOpen = (shift != null && shift?.status == "open")

    Scaffold(
        containerColor = PosNavyDark,
        modifier = modifier.fillMaxSize()
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // --- TOP KIOSK HEADER ---
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = PosSlate900),
            shape = RoundedCornerShape(20.dp),
            border = CardDefaults.outlinedCardBorder().copy(
                brush = Brush.horizontalGradient(listOf(PosSlate700, PosSlate800))
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (uiState.isLoggedIn) PosPrimaryBlue.copy(alpha = 0.2f) else PosSlate800),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (uiState.isLoggedIn) Icons.Default.Storefront else Icons.Default.PersonOutline,
                            contentDescription = null,
                            tint = if (uiState.isLoggedIn) PosPrimaryLight else PosSlate400,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(if (uiState.isLoggedIn) PosSuccessGreen else PosWarningAmber)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = uiState.nodeDomain,
                                style = MaterialTheme.typography.labelSmall,
                                color = PosPrimaryLight,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = uiState.currentUser?.displayName ?: if (uiState.isLoggedIn) "Comercio Conectado" else "Comercio no autenticado",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosSlate100,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (uiState.currentUser?.username != null) {
                            Text(
                                text = "@${uiState.currentUser!!.username}",
                                style = MaterialTheme.typography.labelSmall,
                                color = PosSlate300
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isShiftOpen) {
                        AssistChip(
                            onClick = { viewModel.navigateTo(PosScreen.Settings) },
                            label = {
                                Text(
                                    text = "Abierto",
                                    color = PosSuccessGreenLight,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.LockOpen,
                                    contentDescription = "Turno Abierto",
                                    tint = PosSuccessGreenLight,
                                    modifier = Modifier.size(13.dp)
                                )
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = PosSuccessGreen.copy(alpha = 0.15f)
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosSuccessGreen),
                            modifier = Modifier.testTag("shift_status_btn")
                        )
                    }

                    if (!uiState.isLoggedIn) {
                        Button(
                            onClick = { viewModel.navigateTo(PosScreen.Login) },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosPrimaryBlue),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.testTag("dashboard_login_btn")
                        ) {
                            Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Entrar", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        IconButton(
                            onClick = { viewModel.logout() },
                            modifier = Modifier.testTag("dashboard_logout_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Logout,
                                contentDescription = "Cerrar Sesión",
                                tint = PosSlate400
                            )
                        }
                    }
                }
            }
        }

        // --- SUCCESS OR ERROR ALERT BANNER ---
        if (!uiState.successMessage.isNullOrBlank()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = PosSuccessGreen.copy(alpha = 0.2f)),
                shape = RoundedCornerShape(12.dp),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(PosSuccessGreen))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(imageVector = Icons.Default.CheckCircle, contentDescription = "Éxito", tint = PosSuccessGreenLight)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = uiState.successMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        if (!uiState.errorMessage.isNullOrBlank()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = PosErrorRed.copy(alpha = 0.2f)),
                shape = RoundedCornerShape(12.dp),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(PosErrorRed))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(imageVector = Icons.Default.Error, contentDescription = "Error", tint = PosErrorRedLight)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = uiState.errorMessage!!, color = PosSlate100, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // --- 3 BIG POS ACTION TILES ---
        Text(
            text = "MODOS DE COBRO",
            style = MaterialTheme.typography.labelLarge,
            color = PosSlate300,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(start = 4.dp)
        )

        // Tile 1: NFC Payment (Primary)
        PosActionTile(
            title = "Cobro con Tarjeta NFC",
            subtitle = "Acercar tarjeta del cliente (DESFire / UID + PIN)",
            icon = Icons.Default.Nfc,
            gradient = listOf(Color(0xFF0284C7), Color(0xFF0369A1)),
            accentColor = PosPrimaryLight,
            tag = "action_tile_nfc",
            onClick = { viewModel.navigateTo(PosScreen.NfcCharge) }
        )

        // Tile 2: QR Payment
        PosActionTile(
            title = "Cobro con Código QR",
            subtitle = "Genera QR para que el cliente pague desde su teléfono",
            icon = Icons.Default.QrCode2,
            gradient = listOf(Color(0xFF0F766E), Color(0xFF115E59)),
            accentColor = PosSecondaryLight,
            tag = "action_tile_qr",
            onClick = { viewModel.navigateTo(PosScreen.QrCharge) }
        )

        // Tile 3: Multi-Vendor Mode
        PosActionTile(
            title = "Modo Multi-Vendedor (Feria)",
            subtitle = "Prestar terminal: Vendedor y cliente acercan tarjetas",
            icon = Icons.Default.Storefront,
            gradient = listOf(Color(0xFF854D0E), Color(0xFF713F12)),
            accentColor = PosGoldLight,
            tag = "action_tile_multivendor",
            onClick = { viewModel.navigateTo(PosScreen.MultiVendor) }
        )

        // --- QUICK MANAGEMENT BUTTONS ---
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "HERRAMIENTAS Y REGISTRO",
            style = MaterialTheme.typography.labelLarge,
            color = PosSlate300,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(start = 4.dp)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SecondaryMenuButton(
                title = "Historial",
                icon = Icons.Default.ReceiptLong,
                tag = "menu_btn_history",
                modifier = Modifier.weight(1f),
                onClick = { viewModel.navigateTo(PosScreen.Transactions) }
            )
            SecondaryMenuButton(
                title = "Terminal & Claves",
                icon = Icons.Default.Security,
                tag = "menu_btn_admin",
                modifier = Modifier.weight(1f),
                onClick = { viewModel.navigateTo(PosScreen.Admin) }
            )
            SecondaryMenuButton(
                title = "Ajustes",
                icon = Icons.Default.Settings,
                tag = "menu_btn_settings",
                modifier = Modifier.weight(1f),
                onClick = { viewModel.navigateTo(PosScreen.Settings) }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}
}

@Composable
fun PosActionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    gradient: List<Color>,
    accentColor: Color,
    tag: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(108.dp)
            .testTag(tag)
            .clip(RoundedCornerShape(20.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = PosSlate800),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = Brush.horizontalGradient(gradient)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.horizontalGradient(gradient.map { it.copy(alpha = 0.35f) }))
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(accentColor.copy(alpha = 0.2f))
                        .border(1.5.dp, accentColor, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = title,
                        tint = accentColor,
                        modifier = Modifier.size(30.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = PosSlate100,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = PosSlate300,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ArrowForwardIos,
                contentDescription = null,
                tint = accentColor,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun SecondaryMenuButton(
    title: String,
    icon: ImageVector,
    tag: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(84.dp)
            .testTag(tag)
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosSlate800)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = PosPrimaryLight,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                color = PosSlate100,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
