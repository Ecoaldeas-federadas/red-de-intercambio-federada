package federation

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Protocol struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func New(pool *pgxpool.Pool, nodeDomain string) *Protocol {
	return &Protocol{Pool: pool, NodeDomain: nodeDomain}
}

type MessageType string

const (
	MsgTypeTransfer        MessageType = "Transfer"
	MsgTypeLimitQuery      MessageType = "LimitQuery"
	MsgTypeBalanceSync     MessageType = "BalanceSync"
	MsgTypeBilateralSync   MessageType = "BilateralSync"
	MsgTypeCardLookup      MessageType = "CardLookup"
	MsgTypeProductProposal MessageType = "ProductProposal"
)

type Message struct {
	Type      MessageType `json:"type"`
	FromNode  string      `json:"from_node"`
	ToNode    string      `json:"to_node"`
	Payload   interface{} `json:"payload"`
	Signature string      `json:"signature"`
	Timestamp string      `json:"timestamp"`
}

type TransferPayload struct {
	TransactionID string `json:"transaction_id"`
	SenderID      string `json:"sender_id"`
	ReceiverID    string `json:"receiver_id"`
	Amount        int64  `json:"amount"`
	TaxAmount     int64  `json:"tax_amount"`
}

type ProductProposalPayload struct {
	SourceProductID string      `json:"source_product_id"`
	Name            string      `json:"name"`
	ParentCategory  string      `json:"parent_category"`
	Category        string      `json:"category"`
	Subcategory     string      `json:"subcategory"`
	Unit            string      `json:"unit"`
	Description     string      `json:"description"`
	Badge           string      `json:"badge"`
	ImageURL        string      `json:"image_url"`
	PricePerUnit    float64     `json:"price_per_unit"`
	IsComposite     bool        `json:"is_composite"`
	Composition     interface{} `json:"composition"`
}

type LimitQueryPayload struct {
	QueryingNode string `json:"querying_node"`
}

type LimitResponse struct {
	GlobalCreditLimit    int64 `json:"global_credit_limit"`
	GlobalDebitLimit     int64 `json:"global_debit_limit"`
	BilateralCreditLimit int64 `json:"bilateral_credit_limit"`
	BilateralDebitLimit  int64 `json:"bilateral_debit_limit"`
	IsCustomized         bool  `json:"is_customized"`
}

func (p *Protocol) GetNodeInfo(ctx context.Context) (map[string]interface{}, error) {
	var nodeCount int
	err := p.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM node_balance`).Scan(&nodeCount)
	if err != nil {
		return nil, fmt.Errorf("getting node info: %w", err)
	}

	// Obtener numero de nodo (para SIP/VoIP federado)
	var nodeNumber *int
	_ = p.Pool.QueryRow(ctx, `SELECT node_number FROM node_config LIMIT 1`).Scan(&nodeNumber)

	info := map[string]interface{}{
		"node_domain": p.NodeDomain,
		"known_nodes": nodeCount,
		"protocol":    "fmc/1.0",
	}
	if nodeNumber != nil {
		info["node_number"] = *nodeNumber
	}

	return info, nil
}

func (p *Protocol) QueryRemoteLimits(ctx context.Context, remoteNode string) (*LimitResponse, error) {
	var resp LimitResponse
	err := p.Pool.QueryRow(ctx, `
		SELECT credit_limit, debit_limit, is_customized
		FROM bilateral_limits
		WHERE local_node = $1 AND remote_node = $2 AND is_active = true`,
		p.NodeDomain, remoteNode,
	).Scan(&resp.BilateralCreditLimit, resp.BilateralDebitLimit, resp.IsCustomized)
	if err != nil {
		return nil, fmt.Errorf("querying bilateral limits: %w", err)
	}

	var globalCredit, globalDebit int64
	err = p.Pool.QueryRow(ctx, `
		SELECT node_global_credit_limit, node_global_debit_limit
		FROM federation_global_config ORDER BY id DESC LIMIT 1`,
	).Scan(&globalCredit, &globalDebit)
	if err != nil {
		return nil, fmt.Errorf("querying global limits: %w", err)
	}

	resp.GlobalCreditLimit = globalCredit
	resp.GlobalDebitLimit = globalDebit

	return &resp, nil
}

type BilateralProposal struct {
	LocalNode   string `json:"local_node"`
	RemoteNode  string `json:"remote_node"`
	CreditLimit int64  `json:"credit_limit"`
	DebitLimit  int64  `json:"debit_limit"`
	ProposedBy  string `json:"proposed_by"`
}

type CardLookupPayload struct {
	CardUID  string `json:"card_uid"`
	FromNode string `json:"from_node"`
}

type CardLookupResponse struct {
	Found       bool   `json:"found"`
	UserID      string `json:"user_id,omitempty"`
	Username    string `json:"username,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Balance     int64  `json:"balance,omitempty"`
	IsActive    bool   `json:"is_active,omitempty"`
	NodeDomain  string `json:"node_domain,omitempty"`
}

func (p *Protocol) HandleCardLookup(ctx context.Context, payload *CardLookupPayload) (*CardLookupResponse, error) {
	var userID string
	var username, displayName string
	var balance int64
	var isActive bool

	err := p.Pool.QueryRow(ctx, `
		SELECT c.user_id, u.username, u.display_name, u.balance, c.is_active
		FROM nfc_cards c
		JOIN users u ON c.user_id = u.id
		WHERE c.card_uid = $1`,
		payload.CardUID,
	).Scan(&userID, &username, &displayName, &balance, &isActive)
	if err != nil {
		return &CardLookupResponse{Found: false}, nil
	}

	return &CardLookupResponse{
		Found:       true,
		UserID:      userID,
		Username:    username,
		DisplayName: displayName,
		Balance:     balance,
		IsActive:    isActive,
		NodeDomain:  p.NodeDomain,
	}, nil
}

// UserLookupPayload es la solicitud de lookup de usuario por username.
type UserLookupPayload struct {
	Username string `json:"username"`
	FromNode string `json:"from_node"`
}

// UserLookupResponse es la respuesta del lookup de usuario remoto.
type UserLookupResponse struct {
	Found            bool     `json:"found"`
	UserID           string   `json:"user_id,omitempty"`
	CardType         string   `json:"card_type,omitempty"`
	RequiresDocument bool     `json:"requires_document"`
	RequiredDocType  string   `json:"required_doc_type,omitempty"`
	DocumentTypes    []string `json:"document_types,omitempty"`
	DisplayName      string   `json:"display_name,omitempty"`
	Message          string   `json:"message,omitempty"`
}

// HandleUserLookup busca un usuario local por username para un nodo remoto.
// Retorna el tipo de tarjeta y si requiere documento de identidad.
func (p *Protocol) HandleUserLookup(ctx context.Context, payload *UserLookupPayload) (*UserLookupResponse, error) {
	var userID string
	var displayName string
	err := p.Pool.QueryRow(ctx,
		`SELECT id::text, display_name FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
		payload.Username, p.NodeDomain,
	).Scan(&userID, &displayName)
	if err != nil {
		return &UserLookupResponse{Found: false, Message: "usuario no encontrado"}, nil
	}

	// Buscar tarjeta activa
	var cardType string
	var hasDynamicCerts bool
	var requiredDocType *string
	err = p.Pool.QueryRow(ctx, `
		SELECT card_type, has_dynamic_certs, required_doc_type FROM nfc_cards
		WHERE user_id = $1::uuid AND is_active = true
		ORDER BY has_dynamic_certs DESC, issued_at DESC LIMIT 1`,
		userID,
	).Scan(&cardType, &hasDynamicCerts, &requiredDocType)
	if err != nil {
		return &UserLookupResponse{Found: false, Message: "no se encontro tarjeta activa"}, nil
	}

	respType := cardType
	if respType == "" {
		respType = "uid_only"
	}
	requiresDoc := hasDynamicCerts || respType == "classic"

	// Tipos de documento del usuario
	var docTypes []string
	rows, err := p.Pool.Query(ctx,
		`SELECT document_type_code FROM user_documents WHERE user_id = $1::uuid ORDER BY document_type_code`,
		userID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dt string
			if err := rows.Scan(&dt); err == nil {
				docTypes = append(docTypes, dt)
			}
		}
	}

	resp := &UserLookupResponse{
		Found:            true,
		UserID:           userID,
		CardType:         respType,
		RequiresDocument: requiresDoc,
		DocumentTypes:    docTypes,
		DisplayName:      displayName,
	}
	if requiredDocType != nil && *requiredDocType != "" {
		resp.RequiredDocType = *requiredDocType
	}
	return resp, nil
}

func (p *Protocol) ProposeBilateralLimit(ctx context.Context, remoteNode string, creditLimit, debitLimit int64) error {
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO bilateral_limits (local_node, remote_node, credit_limit, debit_limit, is_customized, local_approved)
		VALUES ($1, $2, $3, $4, true, false)
		ON CONFLICT (local_node, remote_node)
		DO UPDATE SET credit_limit = $3, debit_limit = $4, is_customized = true, local_approved = false,
					  remote_confirmed = false, updated_at = NOW()`,
		p.NodeDomain, remoteNode, creditLimit, debitLimit,
	)
	if err != nil {
		return fmt.Errorf("proposing bilateral limit: %w", err)
	}
	return nil
}

func (p *Protocol) ConfirmBilateralLimit(ctx context.Context, remoteNode string) error {
	_, err := p.Pool.Exec(ctx, `
		UPDATE bilateral_limits
		SET remote_confirmed = true, remote_approved_at = NOW(), updated_at = NOW()
		WHERE local_node = $1 AND remote_node = $2`,
		p.NodeDomain, remoteNode,
	)
	if err != nil {
		return fmt.Errorf("confirming bilateral limit: %w", err)
	}
	return nil
}

func (p *Protocol) GetEffectiveBilateralLimit(ctx context.Context, remoteNode string) (int64, int64, error) {
	var localCredit, localDebit int64
	var localApproved, remoteConfirmed bool
	err := p.Pool.QueryRow(ctx, `
		SELECT credit_limit, debit_limit, local_approved, remote_confirmed
		FROM bilateral_limits
		WHERE local_node = $1 AND remote_node = $2 AND is_active = true`,
		p.NodeDomain, remoteNode,
	).Scan(&localCredit, &localDebit, &localApproved, &remoteConfirmed)
	if err != nil {
		return 0, 0, fmt.Errorf("getting bilateral limit: %w", err)
	}

	if !localApproved || !remoteConfirmed {
		var baseLimit int64
		err = p.Pool.QueryRow(ctx,
			`SELECT node_bilateral_base_limit FROM federation_global_config ORDER BY id DESC LIMIT 1`,
		).Scan(&baseLimit)
		if err != nil {
			return 0, 0, fmt.Errorf("getting base limit: %w", err)
		}
		return baseLimit, baseLimit, nil
	}

	return localCredit, localDebit, nil
}
