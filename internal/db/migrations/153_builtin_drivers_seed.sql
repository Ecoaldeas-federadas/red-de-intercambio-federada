-- Migracion 153: Insertar drivers built-in en el registry + label en nfc_cards
--
-- Los drivers built-in (MifareClassic, NTAG215, UltralightC, DESFire) existen
-- compilados en Go pero no aparecen en la tabla nfc_card_drivers porque la
-- migracion 151 solo creo la tabla. Esta migracion los inserta como registros
-- is_builtin = true para que sean visibles en la web admin de drivers NFC.
--
-- Los drivers built-in NO se pueden eliminar ni sobrescribir via .nfcpkg.
-- Son de referencia y siempre estan disponibles.
--
-- Tambien agrega columna label a nfc_cards para que el admin pueda ponerle
-- un nombre descriptivo a cada tarjeta (ej: "Tarjeta de Juan").

INSERT INTO nfc_card_drivers (type, display_name, version, description, manufacturer, capacity, manifest, driver_js, reader_json, signature, signed_by, trust_level, is_active, is_builtin, shared_with_federation, package_hash)
VALUES
(
    'mifare_classic',
    'MIFARE Classic 1K/4K',
    '1.0.0',
    'Tarjeta clasica de NXP con sectores protegidos por claves A/B. Soporta certificados dinamicos rotativos en sectores 1-15. Compatible con terminales ESP32 y POS Android.',
    'NXP Semiconductors',
    'full',
    '{"memory":{"total_bytes":1024,"user_bytes":752},"security":{"level":"medium","algorithm":"Crypto-1"},"protocol":{"slots":16,"active_slots":1,"backup_slots":15},"compatibility":{"android":"all","ios":"none"}}',
    '-- driver.js no aplica para drivers built-in (compilados en Go)',
    '{"type":"mifare_classic","auth":"keyA","sector":1,"read_blocks":[0,1,2],"write_blocks":[0,1,2]}',
    'builtin',
    'system',
    'builtin',
    true,
    true,
    false,
    'builtin-mifare-classic'
) ON CONFLICT (type) DO NOTHING;

INSERT INTO nfc_card_drivers (type, display_name, version, description, manufacturer, capacity, manifest, driver_js, reader_json, signature, signed_by, trust_level, is_active, is_builtin, shared_with_federation, package_hash)
VALUES
(
    'ntag215',
    'NTAG215',
    '1.0.0',
    'Tag NFC de NXP con 504 bytes, 30 slots para certificados, PWD unica de 4 bytes y rotacion aleatoria. Compatible con todos los telefonos NFC. Usado por Nintendo Amiibo. Disponible en Venezuela.',
    'NXP Semiconductors',
    'full',
    '{"memory":{"total_bytes":540,"user_bytes":504},"security":{"level":"medium","algorithm":"PWD+PACK"},"protocol":{"slots":30,"active_slots":1,"backup_slots":29},"compatibility":{"android":"all","ios":"all"}}',
    '-- driver.js no aplica para drivers built-in (compilados en Go)',
    '{"type":"ntag215","auth":"pwd","pwd_page":43,"pack_page":44,"cert_page":4,"slot_size":16,"max_slots":30}',
    'builtin',
    'system',
    'builtin',
    true,
    true,
    false,
    'builtin-ntag215'
) ON CONFLICT (type) DO NOTHING;

INSERT INTO nfc_card_drivers (type, display_name, version, description, manufacturer, capacity, manifest, driver_js, reader_json, signature, signed_by, trust_level, is_active, is_builtin, shared_with_federation, package_hash)
VALUES
(
    'ultralight_c',
    'Ultralight C',
    '1.0.0',
    'Tag NFC de NXP con 137 bytes y autenticacion 3DES (112-bit). Baja capacidad (8 slots). Fallback si no hay NTAG215 disponible.',
    'NXP Semiconductors',
    'low',
    '{"memory":{"total_bytes":173,"user_bytes":137},"security":{"level":"high","algorithm":"3DES-112"},"protocol":{"slots":8,"active_slots":1,"backup_slots":7},"compatibility":{"android":"all","ios":"all"}}',
    '-- driver.js no aplica para drivers built-in (compilados en Go)',
    '{"type":"ultralight_c","auth":"3des","key_page":44,"cert_page":4,"slot_size":16,"max_slots":8}',
    'builtin',
    'system',
    'builtin',
    true,
    true,
    false,
    'builtin-ultralight-c'
) ON CONFLICT (type) DO NOTHING;

INSERT INTO nfc_card_drivers (type, display_name, version, description, manufacturer, capacity, manifest, driver_js, reader_json, signature, signed_by, trust_level, is_active, is_builtin, shared_with_federation, package_hash)
VALUES
(
    'desfire',
    'DESFire EV2/EV3',
    '1.0.0',
    'Tarjeta smart card de NXP con AES-128 y estructura de aplicaciones/archivos. Alta seguridad. Requiere APDU complejo. No soportado por motor declarativo (requiere reader built-in).',
    'NXP Semiconductors',
    'full',
    '{"memory":{"total_bytes":4096,"user_bytes":2048},"security":{"level":"high","algorithm":"AES-128"},"protocol":{"slots":99,"active_slots":1,"backup_slots":98},"compatibility":{"android":"all","ios":"all"}}',
    '-- driver.js no aplica para drivers built-in (compilados en Go)',
    '{"type":"desfire","auth":"aes","app_id":"A0A1A2","file_id":1,"cert_size":16}',
    'builtin',
    'system',
    'builtin',
    true,
    true,
    false,
    'builtin-desfire'
) ON CONFLICT (type) DO NOTHING;

-- ===== Columna label en nfc_cards =====
-- Permite al admin ponerle un nombre descriptivo a cada tarjeta
-- (ej: "Tarjeta de Juan", "Tarjeta principal", "Tarjeta de respaldo")
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

