-- Migration 127: Informacion del dispositivo en emparejamiento y terminales
-- Compatible with YugabyteDB / PostgreSQL

-- Info del dispositivo en pairing requests
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS chip_id TEXT;
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS device_manufacturer TEXT;
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS android_version TEXT;
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS terminal_type TEXT;

-- Info del dispositivo en terminales registrados
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS device_manufacturer TEXT;
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS android_version TEXT;

-- Indice para buscar terminales por fingerprint (deteccion de re-registros)
CREATE INDEX IF NOT EXISTS idx_nfc_terminals_fingerprint
ON nfc_terminals(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
