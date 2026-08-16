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
	MsgTypeTransfer      MessageType = "Transfer"
	MsgTypeLimitQuery    MessageType = "LimitQuery"
	MsgTypeBalanceSync   MessageType = "BalanceSync"
	MsgTypeBilateralSync MessageType = "BilateralSync"
	MsgTypeCardLookup    MessageType = "CardLookup"
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

	return map[string]interface{}{
		"node_domain": p.NodeDomain,
		"known_nodes": nodeCount,
		"protocol":    "fmc/1.0",
	}, nil
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
