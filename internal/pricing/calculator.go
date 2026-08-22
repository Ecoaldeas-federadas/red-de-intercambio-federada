package pricing

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Pricing struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Pricing {
	return &Pricing{Pool: pool}
}

type Product struct {
	ID                 uuid.UUID `json:"id"`
	NodeDomain         string    `json:"node_domain"`
	Name               string    `json:"name"`
	Category           string    `json:"category"`
	Origin             string    `json:"origin"`
	Unit               string    `json:"unit"`
	QuantityPerBatch   int       `json:"quantity_per_batch"`
	EnergyDirect       float64   `json:"energy_direct"`
	EnergyHuman        float64   `json:"energy_human"`
	EnergyInputs       float64   `json:"energy_inputs"`
	EnergyAmortization float64   `json:"energy_amortization"`
	EnergyTotal        float64   `json:"energy_total"`
	PricePerUnit       float64   `json:"price_per_unit"`
	ExternalPriceUSD   *float64  `json:"external_price_usd"`
	ExternalTaxRate    float64   `json:"external_tax_rate"`
	IsApproved         bool      `json:"is_approved"`
	Description        string    `json:"description"`
	IsActive           bool      `json:"is_active"`
	IsSystem           bool      `json:"is_system"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type EnergyTariff struct {
	VitalFood          float64 `json:"vital_food"`
	VitalWater         float64 `json:"vital_water"`
	VitalDomestic      float64 `json:"vital_domestic"`
	VitalServices      float64 `json:"vital_services"`
	WorkHoursPerDay    int     `json:"work_hours_per_day"`
	WorkDaysPerMonth   int     `json:"work_days_per_month"`
	EffortAdmin        float64 `json:"effort_admin"`
	EffortTechnical    float64 `json:"effort_technical"`
	EffortAgricultural float64 `json:"effort_agricultural"`
}

func (p *Pricing) GetTariff(ctx context.Context, nodeDomain string) (*EnergyTariff, error) {
	var t EnergyTariff
	err := p.Pool.QueryRow(ctx, `
		SELECT vital_food, vital_water, vital_domestic, vital_services,
			   work_hours_per_day, work_days_per_month,
			   effort_admin, effort_technical, effort_agricultural
		FROM energy_tariff WHERE node_domain = $1`,
		nodeDomain,
	).Scan(&t.VitalFood, &t.VitalWater, &t.VitalDomestic, &t.VitalServices,
		&t.WorkHoursPerDay, &t.WorkDaysPerMonth,
		&t.EffortAdmin, &t.EffortTechnical, &t.EffortAgricultural)
	if err != nil {
		return nil, fmt.Errorf("getting energy tariff: %w", err)
	}
	return &t, nil
}

func (t *EnergyTariff) BaseRatePerHour() float64 {
	total := t.VitalFood + t.VitalWater + t.VitalDomestic + t.VitalServices
	if t.WorkHoursPerDay == 0 {
		return 0
	}
	return total / float64(t.WorkHoursPerDay)
}

func (t *EnergyTariff) RateForLaborType(laborType string) float64 {
	base := t.BaseRatePerHour()
	switch laborType {
	case "admin":
		return base * t.EffortAdmin
	case "technical":
		return base * t.EffortTechnical
	case "agricultural":
		return base * t.EffortAgricultural
	default:
		return base
	}
}

func (t *EnergyTariff) MonthlySalary(laborType string, hoursPerMonth int) float64 {
	rate := t.RateForLaborType(laborType)
	return rate * float64(hoursPerMonth)
}

type CalculateInternalParams struct {
	Quantity           int     `json:"quantity"`
	EnergyDirect       float64 `json:"energy_direct"`
	HoursHuman         float64 `json:"hours_human"`
	LaborType          string  `json:"labor_type"`
	EnergyInputs       float64 `json:"energy_inputs"`
	EnergyAmortization float64 `json:"energy_amortization"`
}

type CalculationResult struct {
	EnergyDirect       float64 `json:"energy_direct"`
	EnergyHuman        float64 `json:"energy_human"`
	EnergyInputs       float64 `json:"energy_inputs"`
	EnergyAmortization float64 `json:"energy_amortization"`
	EnergyTotal        float64 `json:"energy_total"`
	PricePerUnit       float64 `json:"price_per_unit"`
	Quantity           int     `json:"quantity"`
}

func (p *Pricing) CalculateInternal(ctx context.Context, nodeDomain string, params CalculateInternalParams) (*CalculationResult, error) {
	tariff, err := p.GetTariff(ctx, nodeDomain)
	if err != nil {
		return nil, err
	}

	humanEnergy := params.HoursHuman * tariff.RateForLaborType(params.LaborType)

	total := params.EnergyDirect + humanEnergy + params.EnergyInputs + params.EnergyAmortization

	var pricePerUnit float64
	if params.Quantity > 0 {
		pricePerUnit = total / float64(params.Quantity)
	}

	return &CalculationResult{
		EnergyDirect:       params.EnergyDirect,
		EnergyHuman:        humanEnergy,
		EnergyInputs:       params.EnergyInputs,
		EnergyAmortization: params.EnergyAmortization,
		EnergyTotal:        total,
		PricePerUnit:       pricePerUnit,
		Quantity:           params.Quantity,
	}, nil
}

type CalculateExternalParams struct {
	ExternalPriceUSD float64 `json:"external_price_usd"`
	LogisticsPct     float64 `json:"logistics_pct"`
	ExternalTaxRate  float64 `json:"external_tax_rate"`
}

type ExternalCalcResult struct {
	ConversionFactor  float64 `json:"conversion_factor"`
	BasePriceTrueques float64 `json:"base_price_trueques"`
	TaxAmount         float64 `json:"tax_amount"`
	FinalPrice        float64 `json:"final_price"`
}

func (p *Pricing) GetActiveConversionFactor(ctx context.Context, nodeDomain string) (float64, float64, error) {
	var factor, taxRate float64
	err := p.Pool.QueryRow(ctx, `
		SELECT factor, external_tax_rate FROM conversion_factor
		WHERE node_domain = $1 AND is_active = true ORDER BY calculated_at DESC LIMIT 1`,
		nodeDomain,
	).Scan(&factor, &taxRate)
	if err != nil {
		return 0, 0, fmt.Errorf("getting conversion factor: %w", err)
	}
	return factor, taxRate, nil
}

func (p *Pricing) CalculateExternal(ctx context.Context, nodeDomain string, params CalculateExternalParams) (*ExternalCalcResult, error) {
	fc, defaultTax, err := p.GetActiveConversionFactor(ctx, nodeDomain)
	if err != nil {
		return nil, err
	}

	taxRate := params.ExternalTaxRate
	if taxRate == 0 {
		taxRate = defaultTax
	}

	priceWithLogistics := params.ExternalPriceUSD * (1 + params.LogisticsPct/100)
	basePrice := priceWithLogistics * fc
	taxAmount := basePrice * taxRate / 100
	finalPrice := basePrice + taxAmount

	return &ExternalCalcResult{
		ConversionFactor:  fc,
		BasePriceTrueques: basePrice,
		TaxAmount:         taxAmount,
		FinalPrice:        finalPrice,
	}, nil
}

func (p *Pricing) ListProducts(ctx context.Context, nodeDomain, category, origin string) ([]Product, error) {
	query := `SELECT id, node_domain, name, category, origin, unit, quantity_per_batch,
			  energy_direct, energy_human, energy_inputs, energy_amortization, energy_total,
			  price_per_unit, external_price_usd, external_tax_rate, is_approved,
			  COALESCE(description, ''), is_active, is_system, created_at, updated_at
			  FROM products WHERE node_domain = $1 AND is_active = true`
	args := []interface{}{nodeDomain}
	argIdx := 2

	if category != "" {
		query += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, category)
		argIdx++
	}
	if origin != "" {
		query += fmt.Sprintf(` AND origin = $%d`, argIdx)
		args = append(args, origin)
		argIdx++
	}
	query += ` ORDER BY category, name`

	rows, err := p.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing products: %w", err)
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var prod Product
		err := rows.Scan(&prod.ID, &prod.NodeDomain, &prod.Name, &prod.Category, &prod.Origin,
			&prod.Unit, &prod.QuantityPerBatch, &prod.EnergyDirect, &prod.EnergyHuman,
			&prod.EnergyInputs, &prod.EnergyAmortization, &prod.EnergyTotal,
			&prod.PricePerUnit, &prod.ExternalPriceUSD, &prod.ExternalTaxRate, &prod.IsApproved,
			&prod.Description, &prod.IsActive, &prod.IsSystem, &prod.CreatedAt, &prod.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning product: %w", err)
		}
		products = append(products, prod)
	}
	return products, nil
}

func (p *Pricing) GetProduct(ctx context.Context, id uuid.UUID) (*Product, error) {
	var prod Product
	err := p.Pool.QueryRow(ctx, `
		SELECT id, node_domain, name, category, origin, unit, quantity_per_batch,
			   energy_direct, energy_human, energy_inputs, energy_amortization, energy_total,
			   price_per_unit, external_price_usd, external_tax_rate, is_approved,
			   COALESCE(description, ''), is_active, is_system, created_at, updated_at
		FROM products WHERE id = $1`,
		id,
	).Scan(&prod.ID, &prod.NodeDomain, &prod.Name, &prod.Category, &prod.Origin,
		&prod.Unit, &prod.QuantityPerBatch, &prod.EnergyDirect, &prod.EnergyHuman,
		&prod.EnergyInputs, &prod.EnergyAmortization, &prod.EnergyTotal,
		&prod.PricePerUnit, &prod.ExternalPriceUSD, &prod.ExternalTaxRate, &prod.IsApproved,
		&prod.Description, &prod.IsActive, &prod.IsSystem, &prod.CreatedAt, &prod.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("getting product: %w", err)
	}
	return &prod, nil
}

type CreateProductParams struct {
	NodeDomain         string
	Name               string
	Category           string
	Origin             string
	Unit               string
	QuantityPerBatch   int
	EnergyDirect       float64
	EnergyHuman        float64
	EnergyInputs       float64
	EnergyAmortization float64
	PricePerUnit       float64
	PricePerKg         float64
	WeightKg           float64
	ExternalPriceUSD   *float64
	ExternalTaxRate    float64
	Description        string
	CreatedBy          uuid.UUID
}

func (p *Pricing) CreateProduct(ctx context.Context, params CreateProductParams) (*Product, error) {
	var prod Product
	err := p.Pool.QueryRow(ctx, `
		INSERT INTO products (node_domain, name, category, origin, unit, quantity_per_batch,
							  energy_direct, energy_human, energy_inputs, energy_amortization,
							  price_per_unit, price_per_kg, weight_kg,
							  external_price_usd, external_tax_rate, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, node_domain, name, category, origin, unit, quantity_per_batch,
				  energy_direct, energy_human, energy_inputs, energy_amortization, energy_total,
				  price_per_unit, external_price_usd, external_tax_rate, is_approved,
				  COALESCE(description, ''), is_active, is_system, created_at, updated_at`,
		params.NodeDomain, params.Name, params.Category, params.Origin, params.Unit, params.QuantityPerBatch,
		params.EnergyDirect, params.EnergyHuman, params.EnergyInputs, params.EnergyAmortization,
		params.PricePerUnit, params.PricePerKg, params.WeightKg,
		params.ExternalPriceUSD, params.ExternalTaxRate, params.Description, params.CreatedBy,
	).Scan(&prod.ID, &prod.NodeDomain, &prod.Name, &prod.Category, &prod.Origin,
		&prod.Unit, &prod.QuantityPerBatch, &prod.EnergyDirect, &prod.EnergyHuman,
		&prod.EnergyInputs, &prod.EnergyAmortization, &prod.EnergyTotal,
		&prod.PricePerUnit, &prod.ExternalPriceUSD, &prod.ExternalTaxRate, &prod.IsApproved,
		&prod.Description, &prod.IsActive, &prod.IsSystem, &prod.CreatedAt, &prod.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating product: %w", err)
	}
	return &prod, nil
}
