package external

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DEX struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewDEX(pool *pgxpool.Pool, nodeDomain string) *DEX {
	return &DEX{Pool: pool, NodeDomain: nodeDomain}
}

type ConversionFactor struct {
	ID              int64       `json:"id"`
	NodeDomain      string      `json:"node_domain"`
	Factor          float64     `json:"factor"`
	ExternalCPI     float64     `json:"external_cpi"`
	LocalEnergyCost float64     `json:"local_energy_cost"`
	CalculatedAt    time.Time   `json:"calculated_at"`
	ApprovedBy      []uuid.UUID `json:"approved_by"`
}

func (d *DEX) CalculateFC(ctx context.Context, externalCPI, localEnergyCost float64) (float64, error) {
	if localEnergyCost <= 0 {
		return 0, fmt.Errorf("local energy cost must be positive")
	}
	if externalCPI <= 0 {
		return 0, fmt.Errorf("external CPI must be positive")
	}

	fc := externalCPI / localEnergyCost
	return fc, nil
}

func (d *DEX) StoreFC(ctx context.Context, factor, externalCPI, localEnergyCost float64, approvedBy []uuid.UUID) (*ConversionFactor, error) {
	var cf ConversionFactor
	err := d.Pool.QueryRow(ctx, `
		INSERT INTO conversion_factor (node_domain, factor, external_cpi, local_energy_cost, approved_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, node_domain, factor, external_cpi, local_energy_cost, calculated_at, approved_by`,
		d.NodeDomain, factor, externalCPI, localEnergyCost, approvedBy,
	).Scan(&cf.ID, &cf.NodeDomain, &cf.Factor, &cf.ExternalCPI, &cf.LocalEnergyCost, &cf.CalculatedAt, &cf.ApprovedBy)
	if err != nil {
		return nil, fmt.Errorf("storing conversion factor: %w", err)
	}
	return &cf, nil
}

func (d *DEX) GetCurrentFC(ctx context.Context) (*ConversionFactor, error) {
	var cf ConversionFactor
	err := d.Pool.QueryRow(ctx, `
		SELECT id, node_domain, factor, external_cpi, local_energy_cost, calculated_at, approved_by
		FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`,
		d.NodeDomain,
	).Scan(&cf.ID, &cf.NodeDomain, &cf.Factor, &cf.ExternalCPI, &cf.LocalEnergyCost, &cf.CalculatedAt, &cf.ApprovedBy)
	if err != nil {
		return nil, fmt.Errorf("no conversion factor found: %w", err)
	}
	return &cf, nil
}

type ExternalOperation struct {
	ID               uuid.UUID   `json:"id"`
	NodeDomain       string      `json:"node_domain"`
	OperationType    string      `json:"operation_type"`
	ProductName      string      `json:"product_name"`
	Quantity         int64       `json:"quantity"`
	InternalValue    int64       `json:"internal_value"`
	ExternalPriceUSD float64     `json:"external_value_usd"`
	FCUsed           float64     `json:"fc_applied"`
	BuyerSeller      string      `json:"buyer_seller"`
	Notes            string      `json:"notes"`
	Status           string      `json:"status"`
	ApprovedBy       []uuid.UUID `json:"approved_by"`
	CreatedAt        time.Time   `json:"created_at"`
	CompletedAt      *time.Time  `json:"completed_at"`
}

type CreateOperationParams struct {
	OperationType     string
	ProductName       string
	Quantity          int64
	ExternalPriceUSD  float64
	LocalPriceTrueque float64
	LogisticsPct      float64
	ExternalTaxRate   float64
	RequestedBy       uuid.UUID
}

func (d *DEX) CreateOperation(ctx context.Context, p CreateOperationParams) (*ExternalOperation, error) {
	cf, err := d.GetCurrentFC(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting FC for operation: %w", err)
	}

	externalCost := p.ExternalPriceUSD * float64(p.Quantity)
	logisticsCost := externalCost * p.LogisticsPct / 100
	taxCost := externalCost * p.ExternalTaxRate / 100
	totalExternal := externalCost + logisticsCost + taxCost
	totalTrueque := int64(totalExternal * cf.Factor)

	var op ExternalOperation
	err = d.Pool.QueryRow(ctx, `
		INSERT INTO external_bridge_operations
		(node_domain, operation_type, product_name, quantity, internal_value, external_value_usd,
		 fc_applied, status, buyer_seller, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
		RETURNING id, node_domain, operation_type, product_name, quantity, internal_value, external_value_usd,
				  fc_applied, buyer_seller, notes, status, approved_by, created_at, completed_at`,
		d.NodeDomain, p.OperationType, p.ProductName, p.Quantity, totalTrueque,
		p.ExternalPriceUSD, cf.Factor, p.RequestedBy.String(), "",
	).Scan(&op.ID, &op.NodeDomain, &op.OperationType, &op.ProductName, &op.Quantity,
		&op.InternalValue, &op.ExternalPriceUSD, &op.FCUsed, &op.BuyerSeller,
		&op.Notes, &op.Status, &op.ApprovedBy, &op.CreatedAt, &op.CompletedAt)
	if err != nil {
		return nil, fmt.Errorf("creating external operation: %w", err)
	}

	return &op, nil
}

func (d *DEX) ApproveOperation(ctx context.Context, opID, approverID uuid.UUID) error {
	_, err := d.Pool.Exec(ctx, `
		UPDATE external_bridge_operations 
		SET status = 'approved', approved_at = NOW(),
			approved_by = array_append(COALESCE(approved_by, ARRAY[]::uuid[]), $2)
		WHERE id = $1 AND status = 'pending'`,
		opID, approverID,
	)
	if err != nil {
		return fmt.Errorf("approving operation: %w", err)
	}
	return nil
}

func (d *DEX) RejectOperation(ctx context.Context, opID uuid.UUID, reason string) error {
	_, err := d.Pool.Exec(ctx, `
		UPDATE external_bridge_operations SET status = 'rejected' WHERE id = $1 AND status = 'pending'`,
		opID,
	)
	if err != nil {
		return fmt.Errorf("rejecting operation: %w", err)
	}
	return nil
}

func (d *DEX) ListOperations(ctx context.Context, status string) ([]ExternalOperation, error) {
	query := `SELECT id, node_domain, operation_type, product_name, quantity, internal_value, external_value_usd,
			  fc_applied, COALESCE(buyer_seller, ''), COALESCE(notes, ''), status, COALESCE(approved_by, ARRAY[]::uuid[]), created_at, completed_at
			  FROM external_bridge_operations WHERE node_domain = $1`
	args := []interface{}{d.NodeDomain}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := d.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing operations: %w", err)
	}
	defer rows.Close()

	var ops []ExternalOperation
	for rows.Next() {
		var op ExternalOperation
		err := rows.Scan(&op.ID, &op.NodeDomain, &op.OperationType, &op.ProductName, &op.Quantity,
			&op.InternalValue, &op.ExternalPriceUSD, &op.FCUsed, &op.BuyerSeller,
			&op.Notes, &op.Status, &op.ApprovedBy, &op.CreatedAt, &op.CompletedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning operation: %w", err)
		}
		ops = append(ops, op)
	}
	return ops, nil
}

func (d *DEX) GetOperation(ctx context.Context, opID uuid.UUID) (*ExternalOperation, error) {
	var op ExternalOperation
	err := d.Pool.QueryRow(ctx, `
		SELECT id, node_domain, operation_type, product_name, quantity, internal_value, external_value_usd,
			  fc_applied, COALESCE(buyer_seller, ''), COALESCE(notes, ''), status, COALESCE(approved_by, ARRAY[]::uuid[]), created_at, completed_at
		FROM external_bridge_operations WHERE id = $1`,
		opID,
	).Scan(&op.ID, &op.NodeDomain, &op.OperationType, &op.ProductName, &op.Quantity,
		&op.InternalValue, &op.ExternalPriceUSD, &op.FCUsed, &op.BuyerSeller,
		&op.Notes, &op.Status, &op.ApprovedBy, &op.CreatedAt, &op.CompletedAt)
	if err != nil {
		return nil, fmt.Errorf("getting operation: %w", err)
	}
	return &op, nil
}
