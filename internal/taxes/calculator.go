package taxes

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Calculator struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Calculator {
	return &Calculator{Pool: pool}
}

func (c *Calculator) GetTaxRate(ctx context.Context, userID uuid.UUID) (float64, error) {
	var taxRate float64
	var memberLevelID *string
	err := c.Pool.QueryRow(ctx, `SELECT tax_rate, member_level_id FROM users WHERE id = $1`, userID).Scan(&taxRate, &memberLevelID)
	if err != nil {
		return 0, fmt.Errorf("getting user tax rate: %w", err)
	}

	if taxRate > 0 {
		return taxRate, nil
	}

	if memberLevelID != nil {
		var levelTaxRate *float64
		err = c.Pool.QueryRow(ctx, `SELECT tax_rate FROM member_levels WHERE id = $1`, *memberLevelID).Scan(&levelTaxRate)
		if err == nil && levelTaxRate != nil {
			return *levelTaxRate, nil
		}
	}

	return 0, nil
}

func (c *Calculator) CalculateTax(amount int64, rate float64) int64 {
	return int64(float64(amount) * rate)
}

func (c *Calculator) GetFundAccount(ctx context.Context, nodeDomain string) (*uuid.UUID, error) {
	var fundID uuid.UUID
	err := c.Pool.QueryRow(ctx,
		`SELECT id FROM users WHERE node_domain = $1 AND username = 'asamblea'`,
		nodeDomain,
	).Scan(&fundID)
	if err != nil {
		return nil, fmt.Errorf("getting fund account (asamblea): %w", err)
	}
	return &fundID, nil
}
