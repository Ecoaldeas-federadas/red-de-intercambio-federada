package external

import (
	"context"
	"fmt"
	"strings"
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
	ID               uuid.UUID  `json:"id"`
	NodeDomain       string     `json:"node_domain"`
	OwnerID          *uuid.UUID `json:"owner_id"`
	OwnerName        string     `json:"owner_name"`
	ProductID        *uuid.UUID `json:"product_id"`
	ProductName      string     `json:"product_name"`
	Description      string     `json:"description"`
	ParentCategory   string     `json:"parent_category"`
	Category         string     `json:"category"`
	Subcategory      string     `json:"subcategory"`
	Origin           string     `json:"origin"`
	Unit             string     `json:"unit"`
	QuantityPerUnit  float64    `json:"quantity_per_unit"`
	PriceTrueque     float64    `json:"price_trueque"`
	BasePrice        float64    `json:"base_price"`
	ExtraCosts       float64    `json:"extra_costs"`
	FinalPrice       float64    `json:"final_price"`
	ExtraDescription string     `json:"extra_description"`
	Stock            int64      `json:"stock"`
	IsActive         bool       `json:"is_active"`
	ExternalOpID     *uuid.UUID `json:"external_op_id"`
	ImageURL         string     `json:"image_url"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type AddStoreItemParams struct {
	OwnerID          *uuid.UUID
	ProductID        *uuid.UUID
	ProductName      string
	Description      string
	ParentCategory   string
	Category         string
	Subcategory      string
	Origin           string
	Unit             string
	QuantityPerUnit  float64
	PriceTrueque     float64
	BasePrice        float64
	ExtraCosts       float64
	FinalPrice       float64
	ExtraDescription string
	Stock            int64
	ExternalOpID     *uuid.UUID
}

func (s *Store) AddItem(ctx context.Context, p AddStoreItemParams) (*StoreItem, error) {
	var item StoreItem
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO store_items (node_domain, owner_id, product_id, product_name, description, parent_category, category, subcategory, origin,
								 unit, quantity_per_unit, price_trueque, base_price, extra_costs, final_price, extra_description,
								 stock, is_active, external_op_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true, $18)
		RETURNING id, node_domain, owner_id, product_id, product_name, description, parent_category, category, subcategory, origin,
				  unit, quantity_per_unit, price_trueque, base_price, extra_costs, final_price, extra_description,
				  stock, is_active, external_op_id, created_at, updated_at`,
		s.NodeDomain, p.OwnerID, p.ProductID, p.ProductName, p.Description, p.ParentCategory, p.Category, p.Subcategory, p.Origin,
		p.Unit, p.QuantityPerUnit, p.PriceTrueque, p.BasePrice, p.ExtraCosts, p.FinalPrice, p.ExtraDescription,
		p.Stock, p.ExternalOpID,
	).Scan(&item.ID, &item.NodeDomain, &item.OwnerID, &item.ProductID, &item.ProductName, &item.Description,
		&item.ParentCategory, &item.Category, &item.Subcategory, &item.Origin, &item.Unit, &item.QuantityPerUnit, &item.PriceTrueque,
		&item.BasePrice, &item.ExtraCosts, &item.FinalPrice, &item.ExtraDescription,
		&item.Stock, &item.IsActive, &item.ExternalOpID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("adding store item: %w", err)
	}
	return &item, nil
}

func (s *Store) ListItems(ctx context.Context, category string) ([]StoreItem, error) {
	query := `SELECT si.id, si.node_domain, si.owner_id, si.product_id, si.product_name, si.description, si.parent_category, si.category, si.subcategory, si.origin,
			  si.unit, si.quantity_per_unit, si.price_trueque, si.base_price, si.extra_costs, si.final_price, si.extra_description,
			  si.stock, si.is_active, si.external_op_id, si.created_at, si.updated_at,
			  COALESCE(u.username, '') as owner_name,
			  COALESCE(p.image_url, '') as image_url
			  FROM store_items si
			  LEFT JOIN users u ON si.owner_id = u.id
			  LEFT JOIN products p ON si.product_id = p.id
			  WHERE si.node_domain = $1 AND si.is_active = true`
	args := []interface{}{s.NodeDomain}
	if category != "" {
		query += ` AND (si.parent_category = $2 OR si.category = $2)`
		args = append(args, category)
	}
	query += ` ORDER BY si.product_name ASC`

	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing store items: %w", err)
	}
	defer rows.Close()

	var items []StoreItem
	for rows.Next() {
		var item StoreItem
		err := rows.Scan(&item.ID, &item.NodeDomain, &item.OwnerID, &item.ProductID, &item.ProductName, &item.Description,
			&item.ParentCategory, &item.Category, &item.Subcategory, &item.Origin, &item.Unit, &item.QuantityPerUnit, &item.PriceTrueque,
			&item.BasePrice, &item.ExtraCosts, &item.FinalPrice, &item.ExtraDescription,
			&item.Stock, &item.IsActive, &item.ExternalOpID, &item.CreatedAt, &item.UpdatedAt, &item.OwnerName, &item.ImageURL)
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
		SELECT id, node_domain, product_name, description, parent_category, category, subcategory, origin,
			  unit, quantity_per_unit, price_trueque, base_price, extra_costs, final_price, extra_description,
			  stock, is_active, external_op_id, created_at, updated_at
		FROM store_items WHERE id = $1`,
		id,
	).Scan(&item.ID, &item.NodeDomain, &item.ProductName, &item.Description,
		&item.ParentCategory, &item.Category, &item.Subcategory, &item.Origin, &item.Unit, &item.QuantityPerUnit,
		&item.PriceTrueque, &item.BasePrice, &item.ExtraCosts, &item.FinalPrice, &item.ExtraDescription,
		&item.Stock, &item.IsActive, &item.ExternalOpID, &item.CreatedAt, &item.UpdatedAt)
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
	ID          uuid.UUID `json:"id"`
	StoreItemID uuid.UUID `json:"store_item_id"`
	BuyerID     uuid.UUID `json:"buyer_id"`
	Quantity    int64     `json:"quantity"`
	TotalPrice  int64     `json:"total_price"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
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

	// Verificar que todos los componentes del producto compuesto esten aprobados en este nodo
	// Un producto compuesto solo se puede comprar si todos sus materiales estan aprobados localmente
	rows, err := s.Pool.Query(ctx, `
		SELECT pc.component_product_id, pc.component_name
		FROM product_compositions pc
		WHERE pc.product_id = $1 AND pc.product_type = 'store_item'
		  AND pc.component_product_id IS NOT NULL`,
		itemID)
	if err == nil {
		defer rows.Close()
		var unapproved []string
		for rows.Next() {
			var componentID uuid.UUID
			var componentName string
			_ = rows.Scan(&componentID, &componentName)
			var isApproved bool
			err := s.Pool.QueryRow(ctx, `SELECT is_approved FROM products WHERE id = $1`, componentID).Scan(&isApproved)
			if err != nil || !isApproved {
				unapproved = append(unapproved, componentName)
			}
		}
		if len(unapproved) > 0 {
			return nil, fmt.Errorf("no se puede comprar: los siguientes componentes no estan aprobados en este nodo: %s", strings.Join(unapproved, ", "))
		}
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
