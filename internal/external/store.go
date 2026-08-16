package external

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewStore(pool *pgxpool.Pool, nodeDomain string) *Store {
	return &Store{Pool: pool, NodeDomain: nodeDomain}
}

type StoreItem struct {
	ID           uuid.UUID  `json:"id"`
	NodeDomain   string     `json:"node_domain"`
	ProductName  string     `json:"product_name"`
	Description  string     `json:"description"`
	Category     string     `json:"category"`
	Origin       string     `json:"origin"`
	PriceTrueque int64      `json:"price_trueque"`
	Stock        int64      `json:"stock"`
	IsActive     bool       `json:"is_active"`
	ExternalOpID *uuid.UUID `json:"external_op_id"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type AddStoreItemParams struct {
	ProductName  string
	Description  string
	Category     string
	Origin       string
	PriceTrueque int64
	Stock        int64
	ExternalOpID *uuid.UUID
}

func (s *Store) AddItem(ctx context.Context, p AddStoreItemParams) (*StoreItem, error) {
	var item StoreItem
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO store_items (node_domain, product_name, description, category, origin,
								 price_trueque, stock, is_active, external_op_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
		RETURNING id, node_domain, product_name, description, category, origin,
				  price_trueque, stock, is_active, external_op_id, created_at, updated_at`,
		s.NodeDomain, p.ProductName, p.Description, p.Category, p.Origin,
		p.PriceTrueque, p.Stock, p.ExternalOpID,
	).Scan(&item.ID, &item.NodeDomain, &item.ProductName, &item.Description, &item.Category,
		&item.Origin, &item.PriceTrueque, &item.Stock, &item.IsActive, &item.ExternalOpID,
		&item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("adding store item: %w", err)
	}
	return &item, nil
}

func (s *Store) ListItems(ctx context.Context, category string) ([]StoreItem, error) {
	query := `SELECT id, node_domain, product_name, description, category, origin,
			  price_trueque, stock, is_active, external_op_id, created_at, updated_at
			  FROM store_items WHERE node_domain = $1 AND is_active = true`
	args := []interface{}{s.NodeDomain}
	if category != "" {
		query += ` AND category = $2`
		args = append(args, category)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing store items: %w", err)
	}
	defer rows.Close()

	var items []StoreItem
	for rows.Next() {
		var item StoreItem
		err := rows.Scan(&item.ID, &item.NodeDomain, &item.ProductName, &item.Description,
			&item.Category, &item.Origin, &item.PriceTrueque, &item.Stock, &item.IsActive,
			&item.ExternalOpID, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning store item: %w", err)
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (*StoreItem, error) {
	var item StoreItem
	err := s.Pool.QueryRow(ctx, `
		SELECT id, node_domain, product_name, description, category, origin,
			  price_trueque, stock, is_active, external_op_id, created_at, updated_at
		FROM store_items WHERE id = $1`,
		id,
	).Scan(&item.ID, &item.NodeDomain, &item.ProductName, &item.Description,
		&item.Category, &item.Origin, &item.PriceTrueque, &item.Stock, &item.IsActive,
		&item.ExternalOpID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("getting store item: %w", err)
	}
	return &item, nil
}

func (s *Store) UpdateStock(ctx context.Context, id uuid.UUID, delta int64) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE store_items SET stock = stock + $2, updated_at = NOW() WHERE id = $1`,
		id, delta,
	)
	if err != nil {
		return fmt.Errorf("updating stock: %w", err)
	}
	return nil
}

func (s *Store) UpdatePrice(ctx context.Context, id uuid.UUID, newPrice int64) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE store_items SET price_trueque = $2, updated_at = NOW() WHERE id = $1`,
		id, newPrice,
	)
	if err != nil {
		return fmt.Errorf("updating price: %w", err)
	}
	return nil
}

func (s *Store) DeactivateItem(ctx context.Context, id uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE store_items SET is_active = false, updated_at = NOW() WHERE id = $1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("deactivating store item: %w", err)
	}
	return nil
}

type StorePurchase struct {
	ID         uuid.UUID `json:"id"`
	StoreItemID uuid.UUID `json:"store_item_id"`
	BuyerID    uuid.UUID `json:"buyer_id"`
	Quantity   int64     `json:"quantity"`
	TotalPrice int64     `json:"total_price"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

func (s *Store) Purchase(ctx context.Context, itemID, buyerID uuid.UUID, quantity int64) (*StorePurchase, error) {
	if quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}

	var stock, price int64
	err := s.Pool.QueryRow(ctx,
		`SELECT stock, price_trueque FROM store_items WHERE id = $1 AND is_active = true`,
		itemID,
	).Scan(&stock, &price)
	if err != nil {
		return nil, fmt.Errorf("getting store item: %w", err)
	}

	if stock < quantity {
		return nil, fmt.Errorf("insufficient stock: have %d, want %d", stock, quantity)
	}

	totalPrice := price * quantity

	var purchase StorePurchase
	err = s.Pool.QueryRow(ctx, `
		INSERT INTO store_purchases (store_item_id, buyer_id, quantity, total_price, status)
		VALUES ($1, $2, $3, $4, 'completed')
		RETURNING id, store_item_id, buyer_id, quantity, total_price, status, created_at`,
		itemID, buyerID, quantity, totalPrice,
	).Scan(&purchase.ID, &purchase.StoreItemID, &purchase.BuyerID, &purchase.Quantity,
		&purchase.TotalPrice, &purchase.Status, &purchase.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating purchase: %w", err)
	}

	_, err = s.Pool.Exec(ctx, `
		UPDATE store_items SET stock = stock - $2, updated_at = NOW() WHERE id = $1`,
		itemID, quantity)
	if err != nil {
		return nil, fmt.Errorf("reducing stock: %w", err)
	}

	return &purchase, nil
}
