-- 126_drop_wifi_ssid.sql — Eliminar columna wifi_ssid de nfc_terminals
-- El WiFi se configura en el sitio via portal cautivo (wifi_provisioning.h)
-- o via Bluetooth (lector BLE), no en el registro del terminal.
-- No hay datos existentes (app en modo alfa).
ALTER TABLE nfc_terminals DROP COLUMN IF EXISTS wifi_ssid;
