// driver.js — Plantilla de driver NFC para el servidor (Goja sandbox)
//
// Este archivo se ejecuta en un sandbox JavaScript (Goja) dentro del servidor Go.
// El sandbox expone el objeto "ctx" con:
//   ctx.db.queryOne(sql, args)  — ejecuta SELECT, retorna una fila o null
//   ctx.db.execute(sql, args)   — ejecuta INSERT/UPDATE/DELETE
//   ctx.db.getPinHash(userId)   — retorna el hash de PIN de un usuario
//   ctx.crypto.randomBytes(n)   — genera n bytes aleatorios
//   ctx.crypto.toHex(bytes)     — convierte bytes a hex string
//   ctx.crypto.fromHex(hex)     — convierte hex a bytes
//   ctx.crypto.uuid()           — genera un UUID v4
//   ctx.crypto.hash(data)       — SHA256 de bytes
//   ctx.bcrypt.hash(password)   — hashea password con bcrypt
//   ctx.bcrypt.verify(pass, hash) — verifica password contra hash
//   ctx.nodeDomain              — dominio de este nodo
//   ctx.terminalId              — ID del terminal (en preAuth/confirm)
//
// IMPORTANTE: Usar "var" (ES5.1). No usar let/const/arrow functions.
// El driver debe definir el objeto "NfcDriver" con 4 metodos:
//   provision, preAuth, confirm, cleanupExpired

var NfcDriver = {
    type: "MIDRIVER",
    requiresDocument: false,

    // ============================================================
    // provision: Registra la tarjeta en el servidor
    // ============================================================
    // Parametros:
    //   ctx         — contexto del sandbox
    //   userId      — UUID del usuario (string)
    //   cardUid     — UID de la tarjeta (hex string)
    //   initialPin  — PIN inicial (string)
    // Retorna: objeto con datos para el POS
    provision: function(ctx, userId, cardUid, initialPin) {
        // 1. Hashear PIN
        var pinHash = ctx.bcrypt.hash(initialPin);

        // 2. Generar credenciales aleatorias
        var pwd = ctx.crypto.randomBytes(4);   // PWD de 4 bytes
        var pack = ctx.crypto.randomBytes(2);  // PACK de 2 bytes
        var customCardId = ctx.crypto.randomBytes(8);

        // 3. INSERT en nfc_cards
        ctx.db.execute(
            "INSERT INTO nfc_cards (user_id, card_uid, card_type, is_active, pin_hash, " +
            "custom_card_id, issued_at) " +
            "VALUES ($1, $2, 'MIDRIVER', true, $3, $4, NOW())",
            [userId, cardUid, pinHash, customCardId]
        );

        // 4. Generar slots (ajustar cantidad segun la tarjeta)
        var totalSlots = 30;
        var activeSlots = 15;
        var slots = [];

        for (var i = 0; i < totalSlots; i++) {
            var cert = ctx.crypto.randomBytes(16);
            var isActive = i < activeSlots;
            var startPage = 10 + (i * 4);

            ctx.db.execute(
                "INSERT INTO nfc_midriver_slots " +
                "(card_uid, node_domain, slot_number, is_backup, " +
                "start_page, end_page, certificate, is_active) " +
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                [cardUid, ctx.nodeDomain, i, !isActive,
                 startPage, startPage + 3, cert, isActive]
            );

            slots.push({
                slot_number: i,
                certificate: ctx.crypto.toHex(cert),
                is_active: isActive,
                is_backup: !isActive
            });
        }

        // 5. Retornar respuesta para el POS
        return {
            card_uid: cardUid,
            card_type: "MIDRIVER",
            pwd: ctx.crypto.toHex(pwd),
            pack: ctx.crypto.toHex(pack),
            custom_card_id: ctx.crypto.toHex(customCardId),
            auth0: 10,
            slots: slots
        };
    },

    // ============================================================
    // preAuth: Valida usuario + PIN + saldo, prepara rotacion
    // ============================================================
    // Parametros:
    //   ctx         — contexto del sandbox
    //   username    — nombre de usuario
    //   pin         — PIN (string)
    //   amount      — monto en centimos (int64)
    // Retorna: objeto con pre_approved y datos para el POS
    preAuth: function(ctx, username, pin, amount) {
        // 1. Buscar usuario
        var user = ctx.db.queryOne(
            "SELECT id, balance, credit_limit FROM users " +
            "WHERE LOWER(username) = LOWER($1) AND node_domain = $2",
            [username, ctx.nodeDomain]
        );
        if (!user) {
            return { pre_approved: false, message: "Usuario no encontrado" };
        }

        // 2. Buscar tarjeta activa
        var card = ctx.db.queryOne(
            "SELECT card_uid FROM nfc_cards " +
            "WHERE user_id = $1 AND card_type = 'MIDRIVER' AND is_active = true " +
            "ORDER BY issued_at DESC LIMIT 1",
            [user.id]
        );
        if (!card) {
            return { pre_approved: false, message: "No tiene tarjeta activa" };
        }

        // 3. Verificar saldo
        var newBalance = user.balance - amount;
        if (newBalance < -user.credit_limit) {
            return { pre_approved: false, message: "Saldo insuficiente" };
        }

        // 4. Encontrar slot activo
        var activeSlot = ctx.db.queryOne(
            "SELECT slot_number, certificate FROM nfc_midriver_slots " +
            "WHERE card_uid = $1 AND is_active = true ORDER BY slot_number LIMIT 1",
            [card.card_uid]
        );
        if (!activeSlot) {
            return { pre_approved: false, message: "No hay slot activo" };
        }

        // 5. Elegir slot de escritura (backup aleatorio)
        var writeSlot = ctx.db.queryOne(
            "SELECT slot_number FROM nfc_midriver_slots " +
            "WHERE card_uid = $1 AND is_backup = true " +
            "ORDER BY RANDOM() LIMIT 1",
            [card.card_uid]
        );

        // 6. Generar nuevo certificado
        var newCert = ctx.crypto.randomBytes(16);

        // 7. Guardar pre-aprobacion
        var pendingId = ctx.crypto.uuid();
        ctx.db.execute(
            "INSERT INTO nfc_midriver_pending " +
            "(id, card_uid, terminal_id, user_id, amount, read_slot, write_slot, " +
            "new_certificate, expires_at) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '30 seconds')",
            [pendingId, card.card_uid, ctx.terminalId, user.id, amount,
             activeSlot.slot_number, writeSlot.slot_number, newCert]
        );

        // 8. Retornar datos para el POS
        return {
            pre_approved: true,
            card_uid: card.card_uid,
            card_type: "MIDRIVER",
            read_slot: activeSlot.slot_number,
            expected_certificate: ctx.crypto.toHex(activeSlot.certificate),
            write_slot: writeSlot.slot_number,
            new_certificate: ctx.crypto.toHex(newCert)
        };
    },

    // ============================================================
    // confirm: Confirma lectura/escritura y procesa pago
    // ============================================================
    // Parametros:
    //   ctx          — contexto del sandbox
    //   cardUid      — UID de la tarjeta
    //   readOk       — true si la lectura fue exitosa
    //   writeOk      — true si la escritura fue exitosa
    //   writtenPages — numero de paginas escritas
    // Retorna: objeto con status (approved/rejected)
    confirm: function(ctx, cardUid, readOk, writeOk, writtenPages) {
        // 1. Buscar pre-aprobacion pendiente
        var pending = ctx.db.queryOne(
            "SELECT * FROM nfc_midriver_pending " +
            "WHERE card_uid = $1 AND expires_at > NOW() " +
            "ORDER BY created_at DESC LIMIT 1",
            [cardUid]
        );
        if (!pending) {
            return { status: "rejected", message: "No hay pre-aprobacion valida" };
        }

        // 2. Si fallo, rechazar
        if (!readOk || !writeOk) {
            ctx.db.execute("DELETE FROM nfc_midriver_pending WHERE id = $1", [pending.id]);
            return {
                status: "rejected",
                message: "Fallo la " + (!readOk ? "lectura" : "escritura") + " de la tarjeta"
            };
        }

        // 3. Debitar balance
        ctx.db.execute(
            "UPDATE users SET balance = balance - $1 WHERE id = $2",
            [pending.amount, pending.user_id]
        );

        // 4. Rotar slots
        ctx.db.execute(
            "UPDATE nfc_midriver_slots SET is_active = false WHERE card_uid = $1 AND slot_number = $2",
            [cardUid, pending.read_slot]
        );
        ctx.db.execute(
            "UPDATE nfc_midriver_slots SET is_active = true, is_backup = false, " +
            "certificate = $3 WHERE card_uid = $1 AND slot_number = $2",
            [cardUid, pending.write_slot, pending.new_certificate]
        );

        // 5. Borrar pending
        ctx.db.execute("DELETE FROM nfc_midriver_pending WHERE id = $1", [pending.id]);

        // 6. Log transaccion
        var txId = ctx.crypto.uuid();
        ctx.db.execute(
            "INSERT INTO nfc_transactions " +
            "(id, terminal_id, card_uid, user_id, amount, status, transaction_type) " +
            "VALUES ($1, $2, $3, $4, $5, 'approved', 'single')",
            [txId, pending.terminal_id, cardUid, pending.user_id, pending.amount]
        );

        // 7. Retornar resultado
        var newBalance = ctx.db.queryOne(
            "SELECT balance FROM users WHERE id = $1", [pending.user_id]
        );

        return {
            status: "approved",
            transaction_id: txId,
            user_balance: newBalance ? newBalance.balance : null
        };
    },

    // ============================================================
    // cleanupExpired: Borra pre-aprobaciones expiradas
    // ============================================================
    cleanupExpired: function(ctx) {
        ctx.db.execute("DELETE FROM nfc_midriver_pending WHERE expires_at < NOW()");
    }
};
