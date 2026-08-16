-- 005_terminal_chip_binding.sql
-- Agrega chip_id a nfc_terminals para vincular el firmware a un ESP32 especifico.
-- El chip_id es el MAC address de fabrica (efuse) del ESP32, unico por chip.
-- Esto impide que un firmware compilado para un nodo sea copiado a otro.

ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS chip_id TEXT;
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS firmware_binary_path TEXT;

-- Indice para buscar terminales por chip_id (verificacion de hardware)
CREATE INDEX IF NOT EXISTS idx_nfc_terminals_chip_id ON nfc_terminals(chip_id) WHERE chip_id IS NOT NULL;
