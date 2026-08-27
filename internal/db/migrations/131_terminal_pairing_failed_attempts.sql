-- Migracion 131: Anadir failed_attempts a terminal_pairing_requests
--
-- Para soportar rate-limiting en la verificacion de 4 opciones:
-- despues de 5 intentos fallidos, la solicitud de emparejamiento expira.

ALTER TABLE terminal_pairing_requests
    ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
