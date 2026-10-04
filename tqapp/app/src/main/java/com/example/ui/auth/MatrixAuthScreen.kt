package com.example.ui.auth

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.example.data.matrix.MatrixServersConfig
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.matrix.MatrixServer
import com.example.ui.RecaptchaChallengeState
import com.example.ui.theme.WhatsAppGreenAccent
import com.example.ui.theme.WhatsAppGreenDark
import com.example.ui.theme.WhatsAppGreenPrimary
import com.example.ui.theme.WhatsAppGreenTeal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatrixAuthScreen(
    servers: List<MatrixServer>,
    selectedServer: MatrixServer,
    isLoading: Boolean,
    errorMessage: String?,
    recaptchaChallenge: RecaptchaChallengeState? = null,
    onSelectServer: (MatrixServer) -> Unit,
    onAddCustomServer: (String, String) -> Unit,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String) -> Unit,
    onLoginWithToken: (String) -> Unit = {},
    onCompleteRecaptcha: (String) -> Unit = {},
    onDismissRecaptcha: () -> Unit = {},
    onQuickDemo: (String) -> Unit,
    onClearError: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Iniciar sesión, 1: Registrarse
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showServerSheet by remember { mutableStateOf(false) }
    var showRegisterWebView by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Extract hostname of selected server (e.g. matrix.org, mozilla.modular.im)
    val serverHost = remember(selectedServer.url) {
        selectedServer.url.removePrefix("https://").removePrefix("http://").trimEnd('/')
    }

    // High-contrast, dark typography and color palette for crisp input on white cards
    val inputTextColor = Color(0xFF111B21)
    val inputPlaceholderColor = Color(0xFF8696A0)
    val inputLabelColor = Color(0xFF54656F)

    val textFieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = inputTextColor,
        unfocusedTextColor = inputTextColor,
        disabledTextColor = Color(0xFF667781),
        errorTextColor = Color(0xFFC62828),
        focusedContainerColor = Color.White,
        unfocusedContainerColor = Color.White,
        disabledContainerColor = Color(0xFFF7F8FA),
        focusedBorderColor = WhatsAppGreenPrimary,
        unfocusedBorderColor = Color(0xFFB0BEC5),
        disabledBorderColor = Color(0xFFE0E0E0),
        focusedLabelColor = WhatsAppGreenDark,
        unfocusedLabelColor = inputLabelColor,
        focusedPlaceholderColor = inputPlaceholderColor,
        unfocusedPlaceholderColor = inputPlaceholderColor,
        focusedPrefixColor = WhatsAppGreenDark,
        unfocusedPrefixColor = WhatsAppGreenDark,
        focusedSuffixColor = Color(0xFF54656F),
        unfocusedSuffixColor = Color(0xFF54656F),
        cursorColor = WhatsAppGreenPrimary,
        selectionColors = TextSelectionColors(
            handleColor = WhatsAppGreenPrimary,
            backgroundColor = WhatsAppGreenPrimary.copy(alpha = 0.25f)
        )
    )

    val authColorScheme = lightColorScheme(
        primary = WhatsAppGreenPrimary,
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDCF8C6),
        onPrimaryContainer = Color(0xFF111B21),
        secondary = WhatsAppGreenTeal,
        onSecondary = Color.White,
        tertiary = WhatsAppGreenAccent,
        background = Color(0xFFF7F8FA),
        onBackground = Color(0xFF111B21),
        surface = Color.White,
        onSurface = Color(0xFF111B21),
        surfaceVariant = Color(0xFFF0F2F5),
        onSurfaceVariant = Color(0xFF54656F),
        outline = Color(0xFFB0BEC5),
        outlineVariant = Color(0xFFCFD8DC)
    )

    MaterialTheme(colorScheme = authColorScheme) {
        CompositionLocalProvider(
            LocalContentColor provides Color(0xFF111B21),
            LocalTextStyle provides TextStyle(
                color = Color(0xFF111B21),
                fontSize = 15.sp
            )
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFF7F8FA))
            ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // TqApp Header Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WhatsAppGreenPrimary)
                    .padding(vertical = 32.dp, horizontal = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "TQ",
                            color = WhatsAppGreenPrimary,
                            fontWeight = FontWeight.Black,
                            fontSize = 30.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "TqApp",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Red Abierta y Federada con Matrix",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = WhatsAppGreenAccent,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Cifrado de extremo a extremo",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 11.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Main Card Container
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    // Selected Matrix Homeserver Selector
                    Text(
                        text = "SERVIDOR MATRIX SELECCIONADO",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = WhatsAppGreenDark,
                        letterSpacing = 0.5.sp
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFF0F5F3))
                            .border(1.dp, WhatsAppGreenPrimary.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                            .clickable { showServerSheet = true }
                            .padding(12.dp)
                            .testTag("server_selector_card")
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Dns,
                                contentDescription = null,
                                tint = WhatsAppGreenPrimary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = selectedServer.name,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF111B21)
                                )
                                Text(
                                    text = selectedServer.url,
                                    fontSize = 12.sp,
                                    color = Color(0xFF667781)
                                )
                            }
                            Text(
                                text = "Cambiar",
                                color = WhatsAppGreenPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Tab Selector: Iniciar Sesión vs Registrarse
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = Color.Transparent,
                        contentColor = WhatsAppGreenPrimary,
                        indicator = { tabPositions ->
                            TabRowDefaults.SecondaryIndicator(
                                Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                                color = WhatsAppGreenPrimary,
                                height = 3.dp
                            )
                        }
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = {
                                selectedTab = 0
                                onClearError()
                            },
                            text = {
                                Text(
                                    text = "INICIAR SESIÓN",
                                    fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 13.sp
                                )
                            },
                            modifier = Modifier.testTag("tab_login")
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = {
                                selectedTab = 1
                                onClearError()
                            },
                            text = {
                                Text(
                                    text = "REGISTRARSE",
                                    fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 13.sp
                                )
                            },
                            modifier = Modifier.testTag("tab_register")
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Matrix SSO / Social Login (Google, Apple, GitHub, GitLab)
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onClearError()
                                showRegisterWebView = true
                            },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F4F8)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCFD8DC))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp, horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Public,
                                contentDescription = "SSO / Red Matrix",
                                tint = WhatsAppGreenPrimary,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (selectedTab == 0) "Continuar con Google / SSO" else "Registrarse con Google / SSO",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFF111B21)
                                )
                                Text(
                                    text = "Google • Apple • GitHub • GitLab (Matrix Oficial)",
                                    fontSize = 10.sp,
                                    color = Color(0xFF54656F)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE0E0E0))
                        Text(
                            text = "  o con credenciales Matrix  ",
                            fontSize = 11.sp,
                            color = Color(0xFF8696A0)
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE0E0E0))
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Error Banner
                    if (errorMessage != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFFFEBEE))
                                .border(1.dp, Color(0xFFEF5350), RoundedCornerShape(8.dp))
                                .padding(12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.Top) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = null,
                                    tint = Color(0xFFC62828),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = errorMessage,
                                    color = Color(0xFFC62828),
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp
                                )
                            }
                            if (errorMessage.contains("element.io") || errorMessage.contains("web oficial") || errorMessage.contains("deshabilitado")) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = { showRegisterWebView = true },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary),
                                    modifier = Modifier.fillMaxWidth().height(38.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Security,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Crear Cuenta Real en Matrix.org",
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedButton(
                                    onClick = {
                                        selectedTab = 0
                                        onClearError()
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth().height(36.dp)
                                ) {
                                    Text(
                                        text = "Ya me registré -> Iniciar Sesión",
                                        fontSize = 12.sp,
                                        color = WhatsAppGreenPrimary,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // For matrix.org in register mode, provide direct official registration access
                    if (selectedTab == 1 && serverHost.contains("matrix.org")) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Security,
                                        contentDescription = null,
                                        tint = WhatsAppGreenDark,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Autenticación Moderna (MAS)",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = WhatsAppGreenDark
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Matrix.org utiliza Matrix Authentication Service con Google, Apple, GitHub, GitLab y correo con verificación anti-spam.",
                                    fontSize = 11.sp,
                                    color = Color(0xFF1B5E20),
                                    lineHeight = 15.sp
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = { showRegisterWebView = true },
                                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth().height(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Public,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Crear Cuenta con Google / SSO",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // Username Field
                    if (selectedTab == 0) {
                        // Login Mode
                        OutlinedTextField(
                            value = username,
                            onValueChange = {
                                username = it
                                onClearError()
                            },
                            label = { Text("Usuario Matrix", color = inputLabelColor) },
                            placeholder = { Text("ej. usuario o @usuario:$serverHost", color = inputPlaceholderColor) },
                            singleLine = true,
                            textStyle = TextStyle(color = inputTextColor, fontSize = 15.sp, fontWeight = FontWeight.Normal),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("input_username"),
                            colors = textFieldColors
                        )
                    } else {
                        // Register Mode: Automatically associates username with the selected server!
                        OutlinedTextField(
                            value = username,
                            onValueChange = {
                                // Clean any pasted @ or :server
                                username = it.removePrefix("@").substringBefore(":")
                                onClearError()
                            },
                            label = { Text("Nombre de usuario para registrar", color = inputLabelColor) },
                            placeholder = { Text("mi_usuario", color = inputPlaceholderColor) },
                            prefix = {
                                Text(
                                    text = "@",
                                    color = WhatsAppGreenDark,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                            },
                            suffix = {
                                Text(
                                    text = ":$serverHost",
                                    color = Color(0xFF54656F),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            },
                            singleLine = true,
                            textStyle = TextStyle(color = inputTextColor, fontSize = 15.sp, fontWeight = FontWeight.Normal),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("input_username"),
                            colors = textFieldColors
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        val cleanPreview = username.trim().ifBlank { "tu_nombre" }
                        Text(
                            text = "Tu ID federado en Matrix será: @$cleanPreview:$serverHost",
                            fontSize = 11.sp,
                            color = Color(0xFF54656F),
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Password Field
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            onClearError()
                        },
                        label = { Text("Contraseña", color = inputLabelColor) },
                        placeholder = { Text("Tu contraseña", color = inputPlaceholderColor) },
                        singleLine = true,
                        textStyle = TextStyle(color = inputTextColor, fontSize = 15.sp, fontWeight = FontWeight.Normal),
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = "Mostrar contraseña",
                                    tint = Color(0xFF667781)
                                )
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("input_password"),
                        colors = textFieldColors
                    )

                    // Confirm Password (Register mode only)
                    if (selectedTab == 1) {
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = confirmPassword,
                            onValueChange = { confirmPassword = it },
                            label = { Text("Confirmar contraseña", color = inputLabelColor) },
                            placeholder = { Text("Repite tu contraseña", color = inputPlaceholderColor) },
                            singleLine = true,
                            textStyle = TextStyle(color = inputTextColor, fontSize = 15.sp, fontWeight = FontWeight.Normal),
                            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("input_confirm_password"),
                            colors = textFieldColors
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Submit Button
                    Button(
                        onClick = {
                            val cleanUser = username.trim()
                            if (selectedTab == 0) {
                                onLogin(cleanUser, password)
                            } else {
                                if (confirmPassword.isNotBlank() && password != confirmPassword) {
                                    // Password mismatch check
                                    return@Button
                                }
                                onRegister(cleanUser, password)
                            }
                        },
                        enabled = !isLoading && username.isNotBlank() && password.isNotBlank() && (selectedTab == 0 || confirmPassword == password || confirmPassword.isBlank()),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("auth_submit_button"),
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = WhatsAppGreenPrimary,
                            disabledContainerColor = WhatsAppGreenPrimary.copy(alpha = 0.5f)
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(22.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = if (selectedTab == 0) "INICIAR SESIÓN EN MATRIX" else "CREAR CUENTA EN MATRIX",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Quick Demo Option
                    OutlinedButton(
                        onClick = {
                            val demoUser = if (username.isNotBlank()) username else "usuario_matrix"
                            onQuickDemo(demoUser)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .testTag("quick_demo_button"),
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhatsAppGreenPrimary)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Acceso Rápido / Modo Demostración",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "TqApp conecta directamente a cualquier servidor Matrix federado.\nTus comunicaciones y datos permanecen en tu servidor elegido.",
                color = Color(0xFF667781),
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                lineHeight = 15.sp,
                modifier = Modifier.padding(horizontal = 24.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // Modal BottomSheet for selecting proposed Matrix servers or adding custom one
    if (showServerSheet) {
        var customUrlInput by remember { mutableStateOf("") }
        var customNameInput by remember { mutableStateOf("") }
        var isAddingCustom by remember { mutableStateOf(false) }

        ModalBottomSheet(
            onDismissRequest = { showServerSheet = false },
            sheetState = sheetState,
            containerColor = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.Public,
                        contentDescription = null,
                        tint = WhatsAppGreenPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Seleccionar Servidor Matrix",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF111B21)
                    )
                }

                Text(
                    text = "Servidores propuestos (modificables en MatrixServersConfig.kt):",
                    fontSize = 12.sp,
                    color = Color(0xFF667781),
                    modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
                )

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(260.dp)
                ) {
                    items(servers) { server ->
                        val isSelected = server.url == selectedServer.url
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) Color(0xFFE8F5E9) else Color.Transparent)
                                .clickable {
                                    onSelectServer(server)
                                    showServerSheet = false
                                }
                                .padding(vertical = 10.dp, horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = server.name,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = if (isSelected) WhatsAppGreenPrimary else Color(0xFF111B21)
                                )
                                Text(
                                    text = server.url,
                                    fontSize = 11.sp,
                                    color = Color(0xFF667781)
                                )
                                Text(
                                    text = server.description,
                                    fontSize = 10.sp,
                                    color = Color(0xFF8696A0)
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Seleccionado",
                                    tint = WhatsAppGreenPrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Custom Server section
                if (!isAddingCustom) {
                    TextButton(
                        onClick = { isAddingCustom = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = WhatsAppGreenPrimary)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Añadir otro servidor personalizado...",
                            color = WhatsAppGreenPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF7F8FA)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "Añadir Servidor Matrix Personalizado",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = Color(0xFF111B21)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            OutlinedTextField(
                                value = customNameInput,
                                onValueChange = { customNameInput = it },
                                label = { Text("Nombre (ej. Mi Empresa)", color = inputLabelColor) },
                                singleLine = true,
                                textStyle = TextStyle(color = inputTextColor, fontSize = 14.sp),
                                modifier = Modifier.fillMaxWidth(),
                                colors = textFieldColors
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            OutlinedTextField(
                                value = customUrlInput,
                                onValueChange = { customUrlInput = it },
                                label = { Text("URL (ej. https://matrix.midominio.com)", color = inputLabelColor) },
                                singleLine = true,
                                textStyle = TextStyle(color = inputTextColor, fontSize = 14.sp),
                                modifier = Modifier.fillMaxWidth(),
                                colors = textFieldColors
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { isAddingCustom = false }) {
                                    Text("Cancelar")
                                }
                                Button(
                                    onClick = {
                                        if (customUrlInput.isNotBlank()) {
                                            onAddCustomServer(customNameInput, customUrlInput)
                                            showServerSheet = false
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary)
                                ) {
                                    Text("Guardar y Usar", color = Color.White)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Matrix UIA reCAPTCHA Verification Dialog
    if (recaptchaChallenge != null) {
        RecaptchaVerificationDialog(
            challenge = recaptchaChallenge,
            onSuccess = { token -> onCompleteRecaptcha(token) },
            onDismiss = onDismissRecaptcha
        )
    }

    // Matrix SSO / Social (Google, Apple, GitHub, GitLab) & Official Portal Dialog
    if (showRegisterWebView) {
        val ssoUrl = remember(selectedServer.url) {
            "${MatrixServersConfig.cleanUrl(selectedServer.url)}/_matrix/client/v3/login/sso/redirect?redirectUrl=" + Uri.encode("tqapp://login")
        }
        var webViewProgress by remember { mutableIntStateOf(0) }

        Dialog(
            onDismissRequest = { showRegisterWebView = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(WhatsAppGreenPrimary)
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Autenticación Matrix Oficial",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "Google • Apple • GitHub • GitLab • Cuenta Matrix",
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 11.sp
                            )
                        }
                        IconButton(onClick = { showRegisterWebView = false }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Cerrar",
                                tint = Color.White
                            )
                        }
                    }

                    // Progress bar
                    if (webViewProgress < 100) {
                        LinearProgressIndicator(
                            progress = { webViewProgress / 100f },
                            modifier = Modifier.fillMaxWidth(),
                            color = WhatsAppGreenDark,
                            trackColor = Color(0xFFE0E0E0)
                        )
                    }

                    // Official Matrix Authentication Service WebView
                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                        AndroidView(
                            factory = { ctx ->
                                val webView = WebView(ctx)
                                webView.layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                webView.setBackgroundColor(android.graphics.Color.WHITE)
                                webView.settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    loadWithOverviewMode = true
                                    useWideViewPort = true
                                    setSupportZoom(false)
                                    javaScriptCanOpenWindowsAutomatically = true
                                    setSupportMultipleWindows(true)
                                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                    userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
                                }
                                CookieManager.getInstance().setAcceptCookie(true)
                                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
                                webView.webChromeClient = object : WebChromeClient() {
                                    override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                        webViewProgress = newProgress
                                    }
                                }
                                webView.webViewClient = object : WebViewClient() {
                                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                        val url = request?.url?.toString() ?: return false
                                        if (url.startsWith("tqapp://login") || url.contains("loginToken=")) {
                                            val uri = Uri.parse(url)
                                            val token = uri.getQueryParameter("loginToken")
                                            if (!token.isNullOrBlank()) {
                                                onLoginWithToken(token)
                                                showRegisterWebView = false
                                                return true
                                            }
                                        }
                                        return false
                                    }
                                }
                                webView.loadUrl(ssoUrl)
                                webView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    // Action footer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(ssoUrl))
                                context.startActivity(intent)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.OpenInBrowser, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Abrir Navegador", fontSize = 11.sp)
                        }
                        Button(
                            onClick = {
                                showRegisterWebView = false
                                selectedTab = 0
                                onClearError()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreenPrimary),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Ir a Iniciar Sesión", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
            }
        }
    }
}
}
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RecaptchaVerificationDialog(
    challenge: RecaptchaChallengeState,
    onSuccess: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var hasError by remember { mutableStateOf(false) }

    val recaptchaHtml = remember(challenge.publicKey) {
        """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
            <script src="https://www.google.com/recaptcha/api.js" async defer></script>
            <script type="text/javascript">
                function onVerify(token) {
                    if (window.AndroidBridge) {
                        window.AndroidBridge.onToken(token);
                    }
                }
            </script>
            <style>
                body {
                    margin: 0;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: #ffffff;
                    font-family: sans-serif;
                }
            </style>
        </head>
        <body>
            <div class="g-recaptcha" data-sitekey="${challenge.publicKey}" data-callback="onVerify"></div>
        </body>
        </html>
        """.trimIndent()
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .clip(RoundedCornerShape(16.dp)),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            tint = WhatsAppGreenPrimary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Verificación Matrix",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color(0xFF111B21)
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Cerrar",
                            tint = Color(0xFF667781)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "El servidor ${challenge.serverUrl} requiere resolver este desafío de seguridad para registrar la cuenta @${challenge.username}:",
                    fontSize = 12.sp,
                    color = Color(0xFF667781),
                    lineHeight = 16.sp,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Embedded Web reCAPTCHA Box
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, Color(0xFFE0E0E0), RoundedCornerShape(8.dp))
                ) {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.loadWithOverviewMode = true
                                settings.useWideViewPort = true
                                webViewClient = WebViewClient()
                                addJavascriptInterface(object {
                                    @JavascriptInterface
                                    fun onToken(token: String) {
                                        post {
                                            if (token.isNotBlank()) {
                                                onSuccess(token)
                                            }
                                        }
                                    }
                                }, "AndroidBridge")
                                loadDataWithBaseURL("https://matrix.org", recaptchaHtml, "text/html", "UTF-8", null)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Alternative: Register in external browser option
                OutlinedButton(
                    onClick = {
                        val registerUrl = "https://app.element.io/#/register?homeserver=${Uri.encode(challenge.serverUrl)}"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(registerUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = WhatsAppGreenPrimary)
                ) {
                    Icon(
                        imageVector = Icons.Default.OpenInBrowser,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "O registrarse desde la web oficial",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
