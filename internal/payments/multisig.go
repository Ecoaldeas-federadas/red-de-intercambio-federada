package payments

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// MultiSigPayments maneja pagos pendientes que requieren multiples firmas.
// Cuando una cuenta de organizacion tiene required_signatures > 1, los pagos
// desde esa cuenta quedan pendientes hasta que todos los firmantes autorizados
// confirmen (con su tarjeta NFC + PIN, o via web).
type MultiSigPayments struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewMultiSigPayments(pool *pgxpool.Pool, nodeDomain string) *MultiSigPayments {
	return &MultiSigPayments{Pool: pool, NodeDomain: nodeDomain}
}

// PendingMultiSigPayment representa un pago multi-firma pendiente
type PendingMultiSigPayment struct {
	ID                  uuid.UUID                `json:"id"`
	NodeDomain          string                   `json:"node_domain"`
	PaymentType         string                   `json:"payment_type"` // transfer, nfc, pos_qr
	FromAccount         uuid.UUID                `json:"from_account"`
	ToAccount           uuid.UUID                `json:"to_account"`
	Amount              int64                    `json:"amount"`
	RequiredSignatures  int                      `json:"required_signatures"`
	AuthorizedSigners   []uuid.UUID              `json:"authorized_signers"`
	CollectedSignatures []map[string]interface{} `json:"collected_signatures"`
	Status              string                   `json:"status"` // pending, executed, expired, cancelled
	PaymentMethod       string                   `json:"payment_method"`
	TerminalID          *uuid.UUID               `json:"terminal_id,omitempty"`
	PosChargeID         *uuid.UUID               `json:"pos_charge_id,omitempty"`
	Description         string                   `json:"description"`
	Metadata            map[string]interface{}   `json:"metadata,omitempty"`
	ExpiresAt           time.Time                `json:"expires_at"`
	CreatedAt           time.Time                `json:"created_at"`
	ExecutedAt          *time.Time               `json:"executed_at,omitempty"`
}

// CheckAccountMultiSig verifica si una cuenta requiere multi-firma.
// Retorna required_signatures y authorized_signers.
// Si required_signatures <= 1, no requiere multi-firma.
func (m *MultiSigPayments) CheckAccountMultiSig(ctx context.Context, accountID uuid.UUID) (int, []uuid.UUID, error) {
	var reqSigs int
	var signers []uuid.UUID
	err := m.Pool.QueryRow(ctx, `
		SELECT COALESCE(required_signatures, 1), COALESCE(authorized_signers, ARRAY[]::uuid[])
		FROM users WHERE id = $1`,
		accountID,
	).Scan(&reqSigs, &signers)
	if err != nil {
		return 1, nil, fmt.Errorf("checking account multi-sig: %w", err)
	}
	return reqSigs, signers, nil
}

// CreatePendingPayment crea un pago multi-firma pendiente.
// Se llama cuando una cuenta con required_signatures > 1 intenta pagar.
func (m *MultiSigPayments) CreatePendingPayment(ctx context.Context, params CreatePendingPaymentParams) (*PendingMultiSigPayment, error) {
	reqSigs, signers, err := m.CheckAccountMultiSig(ctx, params.FromAccount)
	if err != nil {
		return nil, err
	}
	if reqSigs <= 1 {
		return nil, fmt.Errorf("account does not require multi-sig")
	}

	var p PendingMultiSigPayment
	metadataJSON, _ := json.Marshal(params.Metadata)
	err = m.Pool.QueryRow(ctx, `
		INSERT INTO pending_multisig_payments
			(node_domain, payment_type, from_account, to_account, amount,
			 required_signatures, authorized_signers, status, payment_method,
			 terminal_id, pos_charge_id, description, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12)
		RETURNING id, node_domain, payment_type, from_account, to_account, amount,
			required_signatures, authorized_signers, collected_signatures, status,
			payment_method, terminal_id, pos_charge_id, description, metadata,
			expires_at, created_at, executed_at`,
		m.NodeDomain, params.PaymentType, params.FromAccount, params.ToAccount, params.Amount,
		reqSigs, signers, params.PaymentMethod,
		params.TerminalID, params.PosChargeID, params.Description, metadataJSON,
	).Scan(&p.ID, &p.NodeDomain, &p.PaymentType, &p.FromAccount, &p.ToAccount, &p.Amount,
		&p.RequiredSignatures, &p.AuthorizedSigners, &p.CollectedSignatures, &p.Status,
		&p.PaymentMethod, &p.TerminalID, &p.PosChargeID, &p.Description, &p.Metadata,
		&p.ExpiresAt, &p.CreatedAt, &p.ExecutedAt)
	if err != nil {
		return nil, fmt.Errorf("creating pending multi-sig payment: %w", err)
	}
	return &p, nil
}

type CreatePendingPaymentParams struct {
	PaymentType   string
	FromAccount   uuid.UUID
	ToAccount     uuid.UUID
	Amount        int64
	PaymentMethod string
	TerminalID    *uuid.UUID
	PosChargeID   *uuid.UUID
	Description   string
	Metadata      map[string]interface{}
}

// SignPendingPayment agrega una firma de un firmante autorizado al pago pendiente.
// Si se alcanzan las firmas requeridas, el pago queda en estado 'ready' para ejecucion.
// Retorna el numero de firmas restantes (0 = listo para ejecutar).
func (m *MultiSigPayments) SignPendingPayment(ctx context.Context, paymentID, signerID uuid.UUID, method, cardUID string, pinVerified, idDocVerified bool) (int, *PendingMultiSigPayment, error) {
	// Verificar que el pago existe y esta pendiente
	var p PendingMultiSigPayment
	var collected []map[string]interface{}
	var signers []uuid.UUID
	err := m.Pool.QueryRow(ctx, `
		SELECT id, from_account, to_account, amount, required_signatures, authorized_signers,
		       collected_signatures, status, expires_at
		FROM pending_multisig_payments WHERE id = $1 AND status = 'pending'`,
		paymentID,
	).Scan(&p.ID, &p.FromAccount, &p.ToAccount, &p.Amount, &p.RequiredSignatures, &signers,
		&collected, &p.Status, &p.ExpiresAt)
	if err != nil {
		return 0, nil, fmt.Errorf("pending payment not found or not pending: %w", err)
	}

	// Verificar que no ha expirado
	if time.Now().After(p.ExpiresAt) {
		m.Pool.Exec(ctx, `UPDATE pending_multisig_payments SET status = 'expired' WHERE id = $1`, paymentID)
		return 0, nil, fmt.Errorf("payment has expired")
	}

	// Verificar que el firmante esta autorizado
	authorized := false
	for _, s := range signers {
		if s == signerID {
			authorized = true
			break
		}
	}
	if !authorized {
		return 0, nil, fmt.Errorf("signer not authorized for this account")
	}

	// Verificar que el firmante no ha firmado ya
	for _, sig := range collected {
		if sid, ok := sig["signer_id"].(string); ok && sid == signerID.String() {
			return 0, nil, fmt.Errorf("signer already signed this payment")
		}
	}

	// Agregar firma
	sigEntry := map[string]interface{}{
		"signer_id":            signerID.String(),
		"method":               method,
		"card_uid":             cardUID,
		"pin_verified":         pinVerified,
		"id_document_verified": idDocVerified,
		"timestamp":            time.Now().UTC(),
	}
	collected = append(collected, sigEntry)

	// Registrar firma individual para auditoria
	m.Pool.Exec(ctx, `
		INSERT INTO multisig_payment_signatures (pending_payment_id, signer_id, method, card_uid, pin_verified, id_document_verified)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (pending_payment_id, signer_id) DO NOTHING`,
		paymentID, signerID, method, cardUID, pinVerified, idDocVerified)

	remaining := p.RequiredSignatures - len(collected)
	status := "pending"
	if remaining <= 0 {
		status = "ready"
		remaining = 0
	}

	_, err = m.Pool.Exec(ctx, `
		UPDATE pending_multisig_payments SET collected_signatures = $2, status = $3, updated_at = NOW()
		WHERE id = $1`,
		paymentID, collected, status)
	if err != nil {
		return 0, nil, fmt.Errorf("updating pending payment: %w", err)
	}

	p.CollectedSignatures = collected
	p.Status = status
	return remaining, &p, nil
}

// ExecutePendingPayment ejecuta un pago multi-firma que tiene todas las firmas.
// Debita de from_account y acredita a to_account.
func (m *MultiSigPayments) ExecutePendingPayment(ctx context.Context, paymentID uuid.UUID) error {
	var p PendingMultiSigPayment
	var collected []map[string]interface{}
	err := m.Pool.QueryRow(ctx, `
		SELECT id, from_account, to_account, amount, required_signatures, collected_signatures, status
		FROM pending_multisig_payments WHERE id = $1`,
		paymentID,
	).Scan(&p.ID, &p.FromAccount, &p.ToAccount, &p.Amount, &p.RequiredSignatures, &collected, &p.Status)
	if err != nil {
		return fmt.Errorf("payment not found: %w", err)
	}

	if p.Status != "ready" {
		return fmt.Errorf("payment not ready: status=%s, collected=%d, required=%d",
			p.Status, len(collected), p.RequiredSignatures)
	}

	// Verificar saldo
	var balance int64
	err = m.Pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, p.FromAccount).Scan(&balance)
	if err != nil {
		return fmt.Errorf("getting balance: %w", err)
	}
	if balance-p.Amount < -50000 {
		// Marcar como cancelado por saldo insuficiente
		m.Pool.Exec(ctx, `UPDATE pending_multisig_payments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, paymentID)
		return fmt.Errorf("saldo insuficiente")
	}

	// Debitar y acreditar
	tx, err := m.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`,
		p.FromAccount, p.Amount)
	if err != nil {
		return fmt.Errorf("debiting from_account: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE users SET balance = balance + $2, updated_at = NOW() WHERE id = $1`,
		p.ToAccount, p.Amount)
	if err != nil {
		return fmt.Errorf("crediting to_account: %w", err)
	}

	// Registrar transaccion
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (tx_type, sender_id, receiver_id, amount, status)
		VALUES ($1, $2, $3, $4, 'completed')`,
		"multisig_"+p.PaymentType, p.FromAccount, p.ToAccount, p.Amount)
	if err != nil {
		// No fatal
	}

	// Marcar como ejecutado
	_, err = tx.Exec(ctx, `
		UPDATE pending_multisig_payments SET status = 'executed', executed_at = NOW(), updated_at = NOW()
		WHERE id = $1`, paymentID)
	if err != nil {
		return fmt.Errorf("marking as executed: %w", err)
	}

	return tx.Commit(ctx)
}

// GetPendingPayment obtiene un pago pendiente por ID
func (m *MultiSigPayments) GetPendingPayment(ctx context.Context, paymentID uuid.UUID) (*PendingMultiSigPayment, error) {
	var p PendingMultiSigPayment
	var collected []map[string]interface{}
	var signers []uuid.UUID
	err := m.Pool.QueryRow(ctx, `
		SELECT id, node_domain, payment_type, from_account, to_account, amount,
		       required_signatures, authorized_signers, collected_signatures, status,
		       payment_method, terminal_id, pos_charge_id, description, metadata,
		       expires_at, created_at, executed_at
		FROM pending_multisig_payments WHERE id = $1`,
		paymentID,
	).Scan(&p.ID, &p.NodeDomain, &p.PaymentType, &p.FromAccount, &p.ToAccount, &p.Amount,
		&p.RequiredSignatures, &signers, &collected, &p.Status,
		&p.PaymentMethod, &p.TerminalID, &p.PosChargeID, &p.Description, &p.Metadata,
		&p.ExpiresAt, &p.CreatedAt, &p.ExecutedAt)
	if err != nil {
		return nil, fmt.Errorf("payment not found: %w", err)
	}
	p.AuthorizedSigners = signers
	p.CollectedSignatures = collected
	return &p, nil
}

// ListPendingPayments lista los pagos pendientes para una cuenta
func (m *MultiSigPayments) ListPendingPayments(ctx context.Context, accountID uuid.UUID) ([]PendingMultiSigPayment, error) {
	rows, err := m.Pool.Query(ctx, `
		SELECT id, node_domain, payment_type, from_account, to_account, amount,
		       required_signatures, authorized_signers, collected_signatures, status,
		       payment_method, terminal_id, pos_charge_id, description, metadata,
		       expires_at, created_at, executed_at
		FROM pending_multisig_payments
		WHERE (from_account = $1 OR to_account = $1) AND status IN ('pending', 'ready')
		ORDER BY created_at DESC`,
		accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing pending payments: %w", err)
	}
	defer rows.Close()

	var payments []PendingMultiSigPayment
	for rows.Next() {
		var p PendingMultiSigPayment
		var collected []map[string]interface{}
		var signers []uuid.UUID
		if err := rows.Scan(&p.ID, &p.NodeDomain, &p.PaymentType, &p.FromAccount, &p.ToAccount, &p.Amount,
			&p.RequiredSignatures, &signers, &collected, &p.Status,
			&p.PaymentMethod, &p.TerminalID, &p.PosChargeID, &p.Description, &p.Metadata,
			&p.ExpiresAt, &p.CreatedAt, &p.ExecutedAt); err != nil {
			return nil, fmt.Errorf("scanning payment: %w", err)
		}
		p.AuthorizedSigners = signers
		p.CollectedSignatures = collected
		payments = append(payments, p)
	}
	return payments, nil
}

// CancelPendingPayment cancela un pago pendiente
func (m *MultiSigPayments) CancelPendingPayment(ctx context.Context, paymentID uuid.UUID) error {
	_, err := m.Pool.Exec(ctx, `
		UPDATE pending_multisig_payments SET status = 'cancelled', updated_at = NOW()
		WHERE id = $1 AND status IN ('pending', 'ready')`, paymentID)
	if err != nil {
		return fmt.Errorf("cancelling payment: %w", err)
	}
	return nil
}

// MultisigSignPayload es el payload para firmar un pago multi-sig con tarjeta NFC
type MultisigSignPayload struct {
	PendingPaymentID string `json:"pending_payment_id"`
	CardUID          string `json:"card_uid"`
	PIN              string `json:"pin"`
	IDDocumentType   string `json:"id_document_type,omitempty"`
	IDDocumentNumber string `json:"id_document_number,omitempty"`
	Timestamp        int64  `json:"timestamp"`
	Nonce            string `json:"nonce"`
}

// SignMultisigPaymentWithCard permite a un firmante autorizado firmar un pago
// multi-firma pendiente usando su tarjeta NFC + PIN.
// El pago se ejecuta automaticamente cuando se recolectan todas las firmas.
func (nt *NFCTerminals) SignMultisigPaymentWithCard(ctx context.Context, terminalID string, payload MultisigSignPayload) (*NFCPaymentResult, error) {
	pendingID, err := uuid.Parse(payload.PendingPaymentID)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "id de pago pendiente invalido"}, nil
	}

	// Verificar que el terminal existe y esta activo
	var termDBID uuid.UUID
	err = nt.Pool.QueryRow(ctx, `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
		terminalID,
	).Scan(&termDBID)
	if err != nil {
		return nil, fmt.Errorf("terminal not found or inactive")
	}

	// Obtener el pago pendiente
	pending, err := nt.getPendingPaymentInternal(ctx, pendingID)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "pago pendiente no encontrado"}, nil
	}
	if pending.Status != "pending" && pending.Status != "ready" {
		return &NFCPaymentResult{Status: "rejected", Message: "pago no esta pendiente (estado: " + pending.Status + ")"}, nil
	}

	// Buscar la tarjeta del firmante
	card, err := nt.lookupCard(ctx, payload.CardUID)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "tarjeta no encontrada o inactiva"}, nil
	}

	// Verificar PIN
	if card.PinHash != nil {
		blocked, _ := nt.checkCardBlocked(ctx, payload.CardUID)
		if blocked {
			return &NFCPaymentResult{Status: "rejected", Message: "tarjeta bloqueada por intentos de PIN"}, nil
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*card.PinHash), []byte(payload.PIN)); err != nil {
			nt.incrementCardAttempt(ctx, payload.CardUID)
			return &NFCPaymentResult{Status: "rejected", Message: "PIN incorrecto"}, nil
		}
		nt.resetCardAttempts(ctx, payload.CardUID)
	}

	// Verificacion de documento de identidad para tarjetas UID-only
	if card.CardType == "uid_only" {
		requireDoc, err := nt.checkRequireIDDocument(ctx)
		if err == nil && requireDoc {
			if payload.IDDocumentNumber == "" {
				return &NFCPaymentResult{Status: "rejected", Message: "se requiere documento de identidad para esta tarjeta"}, nil
			}
			matched, err := nt.verifyIDDocument(ctx, card.UserID, payload.IDDocumentType, payload.IDDocumentNumber)
			if err != nil || !matched {
				return &NFCPaymentResult{Status: "rejected", Message: "documento de identidad no coincide"}, nil
			}
		}
	}

	// Firmar el pago pendiente
	msig := NewMultiSigPayments(nt.Pool, nt.NodeDomain)
	remaining, _, err := msig.SignPendingPayment(ctx, pendingID, card.UserID, "nfc_card", payload.CardUID, true, payload.IDDocumentNumber != "")
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "error firmando pago: " + err.Error()}, nil
	}

	// Si todas las firmas estan completas, ejecutar el pago
	if remaining == 0 {
		if err := msig.ExecutePendingPayment(ctx, pendingID); err != nil {
			return &NFCPaymentResult{
				Status:        "pending_multisig",
				TransactionID: pendingID.String(),
				Message:       "Firma registrada. Error al ejecutar: " + err.Error(),
			}, nil
		}
		// Obtener el nuevo balance del comprador
		var buyerBalance int64
		_ = nt.Pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, pending.FromAccount).Scan(&buyerBalance)
		return &NFCPaymentResult{
			Status:        "approved",
			TransactionID: pendingID.String(),
			Message:       "Pago multi-firma completado y ejecutado",
			UserBalance:   &buyerBalance,
		}, nil
	}

	return &NFCPaymentResult{
		Status:        "pending_multisig",
		TransactionID: pendingID.String(),
		Message:       fmt.Sprintf("Firma registrada. Faltan %d firma(s).", remaining),
	}, nil
}

// getPendingPaymentInternal obtiene un pago pendiente (uso interno)
func (nt *NFCTerminals) getPendingPaymentInternal(ctx context.Context, paymentID uuid.UUID) (*PendingMultiSigPayment, error) {
	var p PendingMultiSigPayment
	var collected []map[string]interface{}
	var signers []uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, node_domain, payment_type, from_account, to_account, amount,
		       required_signatures, authorized_signers, collected_signatures, status,
		       payment_method, terminal_id, pos_charge_id, description, metadata,
		       expires_at, created_at, executed_at
		FROM pending_multisig_payments WHERE id = $1`,
		paymentID,
	).Scan(&p.ID, &p.NodeDomain, &p.PaymentType, &p.FromAccount, &p.ToAccount, &p.Amount,
		&p.RequiredSignatures, &signers, &collected, &p.Status,
		&p.PaymentMethod, &p.TerminalID, &p.PosChargeID, &p.Description, &p.Metadata,
		&p.ExpiresAt, &p.CreatedAt, &p.ExecutedAt)
	if err != nil {
		return nil, err
	}
	p.AuthorizedSigners = signers
	p.CollectedSignatures = collected
	return &p, nil
}
