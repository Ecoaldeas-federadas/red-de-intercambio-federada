package federation

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FederationPairing manages the 4-option verification flow for federation joining.
// A new node initiates a pairing request, and the sponsoring node (padrino)
// must choose the correct code from 4 options, proving out-of-band communication.
type FederationPairing struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	NodeLevels *NodeLevels
}

func NewFederationPairing(pool *pgxpool.Pool, nodeDomain string, nodeLevels *NodeLevels) *FederationPairing {
	return &FederationPairing{Pool: pool, NodeDomain: nodeDomain, NodeLevels: nodeLevels}
}

// FederationPairingRequest represents a federation pairing request
type FederationPairingRequest struct {
	ID                  uuid.UUID  `json:"id"`
	RequestingDomain    string     `json:"requesting_domain"`
	RequestingPublicKey string     `json:"requesting_public_key"`
	RequestingEndpoint  string     `json:"requesting_endpoint"`
	PairingCode         string     `json:"pairing_code"`
	Status              string     `json:"status"`
	SponsorDomain       string     `json:"sponsor_domain"`
	ExpiresAt           time.Time  `json:"expires_at"`
	ConfirmedAt         *time.Time `json:"confirmed_at"`
	FailedAttempts      int        `json:"failed_attempts"`
	CreatedAt           time.Time  `json:"created_at"`
}

// InitiateFederationPairing creates a pairing request from a new node.
// The new node generates a 6-digit code and sends its public key.
func (fp *FederationPairing) InitiateFederationPairing(ctx context.Context, requestingDomain, requestingPublicKey, requestingEndpoint string) (string, error) {
	if requestingDomain == "" {
		return "", fmt.Errorf("requesting_domain is required")
	}
	if requestingPublicKey == "" || len(requestingPublicKey) != 64 {
		return "", fmt.Errorf("requesting_public_key must be 64 hex chars (32 bytes)")
	}

	// Rate limiting: max 3 requests per domain in 10 minutes
	var recentCount int
	_ = fp.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM federation_pairing_requests
		WHERE requesting_domain = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
		requestingDomain,
	).Scan(&recentCount)
	if recentCount >= 3 {
		return "", fmt.Errorf("demasiadas solicitudes. Espere 10 minutos.")
	}

	// Generate unique 6-digit code
	var pairingCode string
	for attempts := 0; attempts < 10; attempts++ {
		code, err := generateFederationPairingCode()
		if err != nil {
			return "", fmt.Errorf("generating pairing code: %w", err)
		}
		var exists bool
		_ = fp.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM federation_pairing_requests
			WHERE pairing_code = $1 AND status = 'pending')`, code,
		).Scan(&exists)
		if !exists {
			pairingCode = code
			break
		}
	}
	if pairingCode == "" {
		return "", fmt.Errorf("no se pudo generar un codigo unico, intente nuevamente")
	}

	_, err := fp.Pool.Exec(ctx, `
		INSERT INTO federation_pairing_requests
			(requesting_domain, requesting_public_key, requesting_endpoint, pairing_code, status, expires_at)
		VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '60 seconds')`,
		requestingDomain, requestingPublicKey, requestingEndpoint, pairingCode,
	)
	if err != nil {
		return "", fmt.Errorf("creating federation pairing request: %w", err)
	}

	return pairingCode, nil
}

// GetFederationPairingOptions returns 4 codes: the correct one + 3 random, in random order.
// The sponsor (padrino) must choose the correct one.
func (fp *FederationPairing) GetFederationPairingOptions(ctx context.Context, code string) ([]string, error) {
	// Verify the code exists and is pending
	var status string
	var expiresAt time.Time
	err := fp.Pool.QueryRow(ctx, `
		SELECT status, expires_at FROM federation_pairing_requests
		WHERE pairing_code = $1`, code,
	).Scan(&status, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("codigo no encontrado")
	}
	if status != "pending" {
		return nil, fmt.Errorf("la solicitud ya fue procesada (estado: %s)", status)
	}
	// Allow during grace period (30s after expiry)
	if time.Now().After(expiresAt.Add(30 * time.Second)) {
		fp.Pool.Exec(ctx, `UPDATE federation_pairing_requests SET status = 'expired' WHERE pairing_code = $1`, code)
		return nil, fmt.Errorf("el codigo ya expiro")
	}

	// Generate 3 random decoy codes
	options := []string{code}
	for len(options) < 4 {
		decoy, err := generateFederationPairingCode()
		if err != nil {
			continue
		}
		// Ensure decoy is different from existing options
		duplicate := false
		for _, o := range options {
			if o == decoy {
				duplicate = true
				break
			}
		}
		if !duplicate {
			options = append(options, decoy)
		}
	}

	// Shuffle the options
	shuffleStrings(options)

	return options, nil
}

// ConfirmFederationPairing confirms a pairing request by selecting the correct code.
// The sponsor (padrino) must choose the correct code from the 4 options.
// If correct, the new node is registered as a peer and given level 1 membership.
func (fp *FederationPairing) ConfirmFederationPairing(ctx context.Context, code, selectedCode, sponsorDomain string) (*FederationPairingResult, error) {
	// Get the request
	var req FederationPairingRequest
	err := fp.Pool.QueryRow(ctx, `
		SELECT id, requesting_domain, requesting_public_key, requesting_endpoint,
		       pairing_code, status, expires_at, failed_attempts
		FROM federation_pairing_requests
		WHERE pairing_code = $1 AND status = 'pending'`, code,
	).Scan(&req.ID, &req.RequestingDomain, &req.RequestingPublicKey, &req.RequestingEndpoint,
		&req.PairingCode, &req.Status, &req.ExpiresAt, &req.FailedAttempts)
	if err != nil {
		return nil, fmt.Errorf("codigo no encontrado o ya procesado")
	}

	// Check expiry (with grace period)
	if time.Now().After(req.ExpiresAt.Add(30 * time.Second)) {
		fp.Pool.Exec(ctx, `UPDATE federation_pairing_requests SET status = 'expired' WHERE id = $1`, req.ID)
		return nil, fmt.Errorf("el codigo ya expiro")
	}

	// Rate limit failed attempts
	if req.FailedAttempts >= 5 {
		fp.Pool.Exec(ctx, `UPDATE federation_pairing_requests SET status = 'expired' WHERE id = $1`, req.ID)
		return nil, fmt.Errorf("demasiados intentos fallidos. Solicitud expirada.")
	}

	// Verify the selected code matches the actual code
	if selectedCode != req.PairingCode {
		// Increment failed attempts
		fp.Pool.Exec(ctx, `UPDATE federation_pairing_requests SET failed_attempts = failed_attempts + 1 WHERE id = $1`, req.ID)
		return nil, fmt.Errorf("codigo incorrecto")
	}

	// Code is correct! Verify the sponsor is level 2+ with can_sponsor
	canSponsor, reason, err := fp.canSponsor(ctx, sponsorDomain)
	if err != nil || !canSponsor {
		return nil, fmt.Errorf("el sponsor no puede patrocinar: %s", reason)
	}

	// Get the new node's level 1 limit
	level1, err := fp.NodeLevels.GetLevel(ctx, "new")
	if err != nil {
		return nil, fmt.Errorf("error obteniendo nivel 1: %w", err)
	}

	// Check sponsor has enough limit
	sponsorEffectiveLimit, err := fp.NodeLevels.GetEffectiveLimit(ctx, sponsorDomain)
	if err != nil {
		return nil, fmt.Errorf("error obteniendo limite del sponsor: %w", err)
	}
	if sponsorEffectiveLimit-level1.GlobalCreditLimit <= 0 {
		return nil, fmt.Errorf("el sponsor no tiene limite suficiente para patrocinar (efectivo: %d, necesario: %d)", sponsorEffectiveLimit, level1.GlobalCreditLimit)
	}

	// Register the new node as a peer in node_federation_keys
	_, err = fp.Pool.Exec(ctx, `
		INSERT INTO node_federation_keys (peer_domain, peer_public_key, peer_endpoint, status, mutual_verified, created_at, updated_at)
		VALUES ($1, $2, $3, 'active', false, NOW(), NOW())
		ON CONFLICT (peer_domain) DO UPDATE SET peer_public_key = $2, peer_endpoint = $3, status = 'active', updated_at = NOW()`,
		req.RequestingDomain, req.RequestingPublicKey, req.RequestingEndpoint,
	)
	if err != nil {
		return nil, fmt.Errorf("error registrando peer: %w", err)
	}

	// Create sponsorship and membership
	err = fp.NodeLevels.SponsorNewNode(ctx, sponsorDomain, req.RequestingDomain, level1.GlobalCreditLimit)
	if err != nil {
		return nil, fmt.Errorf("error creando patrocinio: %w", err)
	}

	// Mark the pairing request as confirmed
	_, err = fp.Pool.Exec(ctx, `
		UPDATE federation_pairing_requests
		SET status = 'confirmed', sponsor_domain = $2, confirmed_at = NOW()
		WHERE id = $1`,
		req.ID, sponsorDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("error confirmando pairing: %w", err)
	}

	return &FederationPairingResult{
		RequestingDomain: req.RequestingDomain,
		SponsorDomain:    sponsorDomain,
		Status:           "confirmed",
		Level:            "new",
		Limit:            level1.GlobalCreditLimit,
		Message:          "Nodo ingresado a la federacion como nivel 1 (Nodo Nuevo). El sponsor es responsable.",
	}, nil
}

// FederationPairingResult is the result of confirming a federation pairing
type FederationPairingResult struct {
	RequestingDomain string `json:"requesting_domain"`
	SponsorDomain    string `json:"sponsor_domain"`
	Status           string `json:"status"`
	Level            string `json:"level"`
	Limit            int64  `json:"limit"`
	Message          string `json:"message"`
}

// canSponsor checks if a node can sponsor new nodes (level 2+ with can_sponsor)
func (fp *FederationPairing) canSponsor(ctx context.Context, sponsorDomain string) (bool, string, error) {
	membership, err := fp.NodeLevels.GetMembership(ctx, sponsorDomain)
	if err != nil {
		return false, "el sponsor no esta en la federacion", nil
	}

	level, err := fp.NodeLevels.GetLevel(ctx, membership.LevelID)
	if err != nil {
		return false, "error obteniendo nivel del sponsor", nil
	}

	if !level.CanSponsor {
		return false, fmt.Sprintf("el nivel %s no puede patrocinar nodos nuevos", level.Name), nil
	}

	return true, "", nil
}

// generateFederationPairingCode generates a random 6-digit code
func generateFederationPairingCode() (string, error) {
	bytes := make([]byte, 3)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	num := int(bytes[0])<<16 | int(bytes[1])<<8 | int(bytes[2])
	code := num % 1000000
	return fmt.Sprintf("%06d", code), nil
}

// shuffleStrings shuffles a slice of strings in place
func shuffleStrings(s []string) {
	for i := len(s) - 1; i > 0; i-- {
		b := make([]byte, 1)
		rand.Read(b)
		j := int(b[0]) % (i + 1)
		s[i], s[j] = s[j], s[i]
	}
}

// ============================================
// Metodos basados en request_id (UUID)
// El frontend nunca recibe el pairing_code real.
// ============================================

// ListPendingFederationPairings lista las solicitudes de federacion pendientes.
// NUNCA devuelve pairing_code — el frontend solo recibe el request_id (UUID).
func (fp *FederationPairing) ListPendingFederationPairings(ctx context.Context) ([]FederationPairingRequest, error) {
	// Expirar las que ya vencieron
	_, _ = fp.Pool.Exec(ctx, `
		UPDATE federation_pairing_requests SET status = 'expired'
		WHERE status = 'pending' AND expires_at < NOW()`)

	rows, err := fp.Pool.Query(ctx, `
		SELECT id, requesting_domain, requesting_public_key, requesting_endpoint,
		       pairing_code, status, sponsor_domain, expires_at, confirmed_at, failed_attempts, created_at
		FROM federation_pairing_requests
		WHERE status = 'pending'
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing pending federation pairings: %w", err)
	}
	defer rows.Close()

	var requests []FederationPairingRequest
	for rows.Next() {
		var r FederationPairingRequest
		var sponsorDomain sql.NullString
		var confirmedAt sql.NullTime
		if err := rows.Scan(&r.ID, &r.RequestingDomain, &r.RequestingPublicKey, &r.RequestingEndpoint,
			&r.PairingCode, &r.Status, &sponsorDomain, &r.ExpiresAt, &confirmedAt, &r.FailedAttempts, &r.CreatedAt); err != nil {
			continue
		}
		r.SponsorDomain = sponsorDomain.String
		if confirmedAt.Valid {
			r.ConfirmedAt = &confirmedAt.Time
		}
		// NUNCA enviar el pairing_code al frontend
		r.PairingCode = ""
		requests = append(requests, r)
	}
	return requests, nil
}

// GetFederationPairingOptionsByReqID returns 4 options for a request identified by UUID.
func (fp *FederationPairing) GetFederationPairingOptionsByReqID(ctx context.Context, reqID uuid.UUID) ([]string, error) {
	var code string
	var status string
	var expiresAt time.Time
	err := fp.Pool.QueryRow(ctx, `
		SELECT pairing_code, status, expires_at FROM federation_pairing_requests
		WHERE id = $1`, reqID,
	).Scan(&code, &status, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("solicitud no encontrada")
	}
	if status != "pending" {
		return nil, fmt.Errorf("la solicitud ya fue procesada (estado: %s)", status)
	}
	if time.Now().After(expiresAt.Add(30 * time.Second)) {
		fp.Pool.Exec(ctx, `UPDATE federation_pairing_requests SET status = 'expired' WHERE id = $1`, reqID)
		return nil, fmt.Errorf("el codigo ya expiro")
	}
	return fp.GetFederationPairingOptions(ctx, code)
}

// ConfirmFederationPairingByReqID confirma una solicitud por UUID.
// El selectedCode es validado contra el codigo real internamente.
func (fp *FederationPairing) ConfirmFederationPairingByReqID(ctx context.Context, reqID uuid.UUID, selectedCode, sponsorDomain string) (*FederationPairingResult, error) {
	var code string
	var status string
	err := fp.Pool.QueryRow(ctx, `
		SELECT pairing_code, status FROM federation_pairing_requests WHERE id = $1`,
		reqID,
	).Scan(&code, &status)
	if err != nil {
		return nil, fmt.Errorf("solicitud no encontrada")
	}
	if status != "pending" {
		return nil, fmt.Errorf("la solicitud ya fue procesada (estado: %s)", status)
	}
	return fp.ConfirmFederationPairing(ctx, code, selectedCode, sponsorDomain)
}

// RejectFederationPairingByReqID rechaza una solicitud por UUID.
func (fp *FederationPairing) RejectFederationPairingByReqID(ctx context.Context, reqID uuid.UUID) error {
	_, err := fp.Pool.Exec(ctx, `
		UPDATE federation_pairing_requests SET status = 'rejected'
		WHERE id = $1 AND status = 'pending'`, reqID)
	if err != nil {
		return fmt.Errorf("error rechazando solicitud: %w", err)
	}
	return nil
}
