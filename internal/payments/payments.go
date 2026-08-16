package payments

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Payments struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func New(pool *pgxpool.Pool, nodeDomain string) *Payments {
	return &Payments{Pool: pool, NodeDomain: nodeDomain}
}

type PaymentRequest struct {
	Protocol    string    `json:"protocol"`
	Type        string    `json:"type"`
	Node        string    `json:"node"`
	User        string    `json:"user"`
	UserID      string    `json:"user_id"`
	DisplayName string    `json:"display_name"`
	Account     string    `json:"account"`
	Amount      *int64    `json:"amount"`
	Label       string    `json:"label,omitempty"`
	Nonce       string    `json:"nonce"`
	Timestamp   time.Time `json:"timestamp"`
}

type GenerateQRParams struct {
	UserID      uuid.UUID
	Username    string
	DisplayName string
	Amount      *int64
	Label       string
}

func (p *Payments) GenerateQR(ctx context.Context, params GenerateQRParams) (*PaymentRequest, string, error) {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return nil, "", fmt.Errorf("generating nonce: %w", err)
	}

	req := PaymentRequest{
		Protocol:    "fmc/1.0",
		Type:        "PaymentRequest",
		Node:        p.NodeDomain,
		User:        fmt.Sprintf("@%s@%s", params.Username, p.NodeDomain),
		UserID:      params.UserID.String(),
		DisplayName: params.DisplayName,
		Account:     fmt.Sprintf("%s@%s", params.Username, p.NodeDomain),
		Amount:      params.Amount,
		Label:       params.Label,
		Nonce:       base64.RawURLEncoding.EncodeToString(nonce),
		Timestamp:   time.Now().UTC(),
	}

	data, err := json.Marshal(req)
	if err != nil {
		return nil, "", fmt.Errorf("marshaling QR data: %w", err)
	}

	qrBase64 := base64.StdEncoding.EncodeToString(data)

	return &req, qrBase64, nil
}

func (p *Payments) ParseQR(qrBase64 string) (*PaymentRequest, error) {
	data, err := base64.StdEncoding.DecodeString(qrBase64)
	if err != nil {
		return nil, fmt.Errorf("decoding QR base64: %w", err)
	}

	var req PaymentRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("parsing QR JSON: %w", err)
	}

	if req.Protocol != "fmc/1.0" {
		return nil, fmt.Errorf("unsupported protocol: %s", req.Protocol)
	}

	if req.Type != "PaymentRequest" {
		return nil, fmt.Errorf("unexpected QR type: %s", req.Type)
	}

	return &req, nil
}

type NFCCard struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`
	CardUID       string     `json:"card_uid"`
	IsActive      bool       `json:"is_active"`
	IssuedAt      time.Time  `json:"issued_at"`
	DeactivatedAt *time.Time `json:"deactivated_at"`
}

func (p *Payments) IssueNFCCard(ctx context.Context, userID uuid.UUID, cardUID string) (*NFCCard, error) {
	var card NFCCard
	err := p.Pool.QueryRow(ctx, `
		INSERT INTO nfc_cards (user_id, card_uid, is_active)
		VALUES ($1, $2, true)
		RETURNING id, user_id, card_uid, is_active, issued_at, deactivated_at`,
		userID, cardUID,
	).Scan(&card.ID, &card.UserID, &card.CardUID, &card.IsActive, &card.IssuedAt, &card.DeactivatedAt)
	if err != nil {
		return nil, fmt.Errorf("issuing NFC card: %w", err)
	}
	return &card, nil
}

func (p *Payments) DeactivateNFCCard(ctx context.Context, cardUID string) error {
	_, err := p.Pool.Exec(ctx, `
		UPDATE nfc_cards SET is_active = false, deactivated_at = NOW()
		WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	)
	if err != nil {
		return fmt.Errorf("deactivating NFC card: %w", err)
	}
	return nil
}

func (p *Payments) LookupNFCCard(ctx context.Context, cardUID string) (*NFCCard, error) {
	var card NFCCard
	err := p.Pool.QueryRow(ctx, `
		SELECT id, user_id, card_uid, is_active, issued_at, deactivated_at
		FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	).Scan(&card.ID, &card.UserID, &card.CardUID, &card.IsActive, &card.IssuedAt, &card.DeactivatedAt)
	if err != nil {
		return nil, fmt.Errorf("NFC card not found or inactive")
	}
	return &card, nil
}

func (p *Payments) ListNFCCards(ctx context.Context, userID uuid.UUID) ([]NFCCard, error) {
	rows, err := p.Pool.Query(ctx, `
		SELECT id, user_id, card_uid, is_active, issued_at, deactivated_at
		FROM nfc_cards WHERE user_id = $1 ORDER BY issued_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing NFC cards: %w", err)
	}
	defer rows.Close()

	var cards []NFCCard
	for rows.Next() {
		var card NFCCard
		err := rows.Scan(&card.ID, &card.UserID, &card.CardUID, &card.IsActive, &card.IssuedAt, &card.DeactivatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning NFC card: %w", err)
		}
		cards = append(cards, card)
	}
	return cards, nil
}

type ManualPaymentParams struct {
	SenderID   uuid.UUID
	ReceiverID uuid.UUID
	Amount     int64
	Reference  string
}

func (p *Payments) ManualPayment(ctx context.Context, params ManualPaymentParams) error {
	if params.Amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	if params.SenderID == params.ReceiverID {
		return fmt.Errorf("cannot send to self")
	}

	var receiverExists bool
	err := p.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND membership_status = 'active')`,
		params.ReceiverID,
	).Scan(&receiverExists)
	if err != nil {
		return fmt.Errorf("checking receiver: %w", err)
	}
	if !receiverExists {
		return fmt.Errorf("receiver not found or not active")
	}

	return nil
}

func (p *Payments) ValidatePaymentRequest(req *PaymentRequest) error {
	maxAge := 24 * time.Hour
	if time.Since(req.Timestamp) > maxAge {
		return fmt.Errorf("payment request expired (older than %v)", maxAge)
	}

	if req.Amount != nil && *req.Amount <= 0 {
		return fmt.Errorf("amount must be positive if specified")
	}

	return nil
}

func (p *Payments) IsLocalNode(req *PaymentRequest) bool {
	return req.Node == p.NodeDomain
}

func ParseNodeFromCardUID(cardUID string) string {
	if len(cardUID) < 4 {
		return ""
	}
	parts := strings.SplitN(cardUID, ":", 2)
	if len(parts) == 2 {
		return parts[0]
	}
	return ""
}

func IsLocalCard(cardUID, nodeDomain string) bool {
	node := ParseNodeFromCardUID(cardUID)
	return node == nodeDomain
}

func GenerateCardUID(nodeDomain string) string {
	shortCode := strings.ReplaceAll(nodeDomain, ".", "")
	if len(shortCode) > 8 {
		shortCode = shortCode[:8]
	}
	random := make([]byte, 8)
	rand.Read(random)
	return fmt.Sprintf("%s:%s", shortCode, hex.EncodeToString(random))
}
