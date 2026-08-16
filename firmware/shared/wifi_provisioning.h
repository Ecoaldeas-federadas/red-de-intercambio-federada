// wifi_provisioning.h — Provisioning de WiFi en el sitio (modo AP cautivo)
// El ESP32 no trae WiFi preconfigurado. La primera vez que arranca:
//   1. Si no hay WiFi guardado en NVS -> arranca como AP "Terminal-XXXX"
//   2. El usuario se conecta a ese WiFi desde su celular
//   3. Se abre automaticamente una pagina (portal cautivo) en el navegador
//   4. El usuario selecciona su red WiFi y entra la contraseña
//   5. El ESP32 guarda las credenciales en NVS, se reinicia y se conecta
// Las veces siguientes arranca directamente conectado al WiFi guardado.
// Si el WiFi falla 5 veces seguidas, vuelve a modo provisioning.
#ifndef WIFI_PROVISIONING_H
#define WIFI_PROVISIONING_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "nvs_flash.h"

static const char* WIFI_NVS_NS = "wifi_prov";
static const char* WIFI_NVS_SSID = "ssid";
static const char* WIFI_NVS_PASS = "pass";

static DNSServer dnsServer;
static WebServer provServer(80);

// HTML del portal cautivo — pagina simple para configurar WiFi
static const char PROVISIONING_HTML[] PROGMEM = R"=====(<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Configurar Terminal</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#eee;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.card{background:#16213e;border-radius:16px;padding:32px;max-width:420px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.3)}
h1{font-size:1.4rem;margin-bottom:8px;color:#0f3460}
h2{font-size:.9rem;color:#888;margin-bottom:24px;font-weight:400}
label{display:block;font-size:.85rem;margin-bottom:6px;color:#aaa}
select,input{width:100%;padding:12px;margin-bottom:16px;border:1px solid #333;border-radius:8px;background:#0f3460;color:#eee;font-size:1rem}
select:focus,input:focus{outline:none;border-color:#e94560}
button{width:100%;padding:14px;border:none;border-radius:8px;background:#e94560;color:#fff;font-size:1.1rem;font-weight:600;cursor:pointer}
button:hover{background:#c73e54}
.info{margin-top:16px;padding:12px;background:#0a1128;border-radius:8px;font-size:.8rem;color:#6ab7ff;line-height:1.5}
</style>
</head>
<body>
<div class="card">
<h1>Terminal NFC</h1>
<h2>Configuracion de red WiFi</h2>
<form action="/save" method="POST">
<label for="ssid">Red WiFi</label>
<select name="ssid" id="ssid">%NETWORKS%</select>
<label for="pass">Contrase&ntilde;a WiFi</label>
<input type="password" name="pass" placeholder="Contrase&ntilde;a" autocomplete="off">
<button type="submit">Conectar</button>
</form>
<div class="info">Selecciona tu red WiFi y entra la contrase&ntilde;a. El terminal se reiniciara y se conectara automaticamente.</div>
</div>
</body>
</html>)=====";

// Escanear redes WiFi disponibles y construir opciones para el <select>
String scanNetworks() {
  int n = WiFi.scanNetworks();
  String options = "";
  bool added = false;
  for (int i = 0; i < n; i++) {
    // Evitar duplicados
    String ssid = WiFi.SSID(i);
    if (ssid.length() == 0) continue;
    bool dup = false;
    for (int j = 0; j < i; j++) {
      if (WiFi.SSID(j) == ssid) { dup = true; break; }
    }
    if (dup) continue;
    int rssi = WiFi.RSSI(i);
    bool secure = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;
    String lock = secure ? " \xF0\x9F\x94\x92" : "";
    options += "<option value=\"" + ssid + "\">" + ssid + " (" + String(rssi) + "dBm)" + lock + "</option>\n";
    added = true;
  }
  if (!added) {
    options = "<option value=\"\">No se encontraron redes</option>";
  }
  return options;
}

// Cargar SSID desde NVS
bool loadWifiSSID(String& ssid) {
  nvs_handle_t handle;
  if (nvs_open(WIFI_NVS_NS, NVS_READONLY, &handle) != ESP_OK) return false;
  size_t len = 0;
  if (nvs_get_str(handle, WIFI_NVS_SSID, NULL, &len) != ESP_OK) {
    nvs_close(handle);
    return false;
  }
  char buf[65];
  if (nvs_get_str(handle, WIFI_NVS_SSID, buf, &len) != ESP_OK) {
    nvs_close(handle);
    return false;
  }
  ssid = String(buf);
  nvs_close(handle);
  return ssid.length() > 0;
}

// Cargar password desde NVS
bool loadWifiPass(String& pass) {
  nvs_handle_t handle;
  if (nvs_open(WIFI_NVS_NS, NVS_READONLY, &handle) != ESP_OK) return false;
  size_t len = 0;
  if (nvs_get_str(handle, WIFI_NVS_PASS, NULL, &len) != ESP_OK) {
    nvs_close(handle);
    return false;
  }
  char buf[129];
  if (nvs_get_str(handle, WIFI_NVS_PASS, buf, &len) != ESP_OK) {
    nvs_close(handle);
    return false;
  }
  pass = String(buf);
  nvs_close(handle);
  return true;
}

// Guardar credenciales WiFi en NVS
bool saveWifiCredentials(const String& ssid, const String& pass) {
  nvs_handle_t handle;
  if (nvs_open(WIFI_NVS_NS, NVS_READWRITE, &handle) != ESP_OK) return false;
  nvs_set_str(handle, WIFI_NVS_SSID, ssid.c_str());
  nvs_set_str(handle, WIFI_NVS_PASS, pass.c_str());
  nvs_commit(handle);
  nvs_close(handle);
  return true;
}

// Borrar credenciales WiFi de NVS (para re-provisioning)
bool clearWifiCredentials() {
  nvs_handle_t handle;
  if (nvs_open(WIFI_NVS_NS, NVS_READWRITE, &handle) != ESP_OK) return false;
  nvs_erase_key(handle, WIFI_NVS_SSID);
  nvs_erase_key(handle, WIFI_NVS_PASS);
  nvs_commit(handle);
  nvs_close(handle);
  return true;
}

// Handler: pagina principal del portal
void handleProvisioningRoot() {
  String networks = scanNetworks();
  String html = String(PROVISIONING_HTML);
  html.replace("%NETWORKS%", networks);
  provServer.send(200, "text/html", html);
}

// Handler: recibir credenciales del formulario
void handleProvisioningSave() {
  String ssid = provServer.arg("ssid");
  String pass = provServer.arg("pass");

  if (ssid.length() == 0) {
    provServer.send(400, "text/html", "<h2>Error: SSID vacio</h2><p><a href='/'>Volver</a></p>");
    return;
  }

  saveWifiCredentials(ssid, pass);

  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:system-ui;background:#1a1a2e;color:#eee;display:flex;justify-content:center;align-items:center;min-height:100vh}";
  html += ".card{background:#16213e;border-radius:16px;padding:32px;text-align:center;max-width:400px}";
  html += "h2{color:#0f3460}p{margin:12px 0;color:#aaa}</style></head>";
  html += "<body><div class='card'><h2>Configuracion guardada</h2>";
  html += "<p>Conectando a: <strong>" + ssid + "</strong></p>";
  html += "<p>El terminal se reiniciara en 3 segundos...</p>";
  html += "<p>Puedes cerrar esta pagina.</p></div></body></html>";
  provServer.send(200, "text/html", html);

  delay(3000);
  ESP.restart();
}

// Handler: capturar cualquier request y redirigir al portal (captive portal)
void handleProvisioningRedirect() {
  provServer.sendHeader("Location", "http://192.168.4.1/", true);
  provServer.send(302, "text/plain", "");
}

// Iniciar modo provisioning (AP cautivo)
// terminalName se usa para el nombre del AP (ej. "Terminal-A1B2")
void startProvisioningAP(const String& terminalName) {
  String apName = "Terminal-" + terminalName;

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str());

  Serial.print("Modo provisioning activo. Conectate a: ");
  Serial.println(apName);
  Serial.print("Abre http://192.168.4.1 en el navegador");
  Serial.println();

  // DNS captive portal — redirige todas las peticiones DNS a 192.168.4.1
  dnsServer.start(53, "*", WiFi.softAPIP());

  // Configurar rutas del web server
  provServer.on("/", HTTP_GET, handleProvisioningRoot);
  provServer.on("/save", HTTP_POST, handleProvisioningSave);
  provServer.on("/generate_204", handleProvisioningRedirect);  // Android
  provServer.on("/hotspot-detect.html", handleProvisioningRedirect);  // iOS
  provServer.on("/connecttest.txt", handleProvisioningRedirect);  // Windows
  provServer.onNotFound(handleProvisioningRedirect);

  provServer.begin();
}

// Mantener el portal cautivo activo (llamar en loop mientras se esta provisioning)
void provisioningLoop() {
  dnsServer.processNextRequest();
  provServer.handleClient();
}

// Intentar conectar al WiFi guardado en NVS.
// Si no hay WiFi guardado o falla 5 veces, retorna false (llamar a startProvisioningAP).
// Si conecta, retorna true.
bool connectToWifi() {
  String ssid, pass;
  if (!loadWifiSSID(ssid)) {
    // No hay WiFi guardado -> necesita provisioning
    return false;
  }
  loadWifiPass(pass);

  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi conectado. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  // WiFi fallo — podria ser que cambiaron la red o la contraseña
  Serial.println("WiFi no disponible. Entrando en modo provisioning.");
  return false;
}

#endif // WIFI_PROVISIONING_H
