package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SystemHandler maneja auditoria, configuracion del nodo, niveles de miembro y moneda
type SystemHandler struct {
	Pool *pgxpool.Pool
	Auth *AuthMiddleware
}

func (h *SystemHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Auditoria
	r.With(am.RequireAuth).Get("/api/audit", h.listAudit)

	// Configuracion del nodo (moneda, nombre, etc)
	r.With(am.RequireAuth).Get("/api/config", h.getConfig)
	r.With(am.RequirePermission("config.manage")).Put("/api/config", h.updateConfig)

	// Niveles de miembro (CRUD completo)
	r.With(am.RequireAuth).Get("/api/member-levels", h.listMemberLevels)
	r.With(am.RequirePermission("config.manage")).Post("/api/member-levels", h.createMemberLevel)
	r.With(am.RequirePermission("config.manage")).Put("/api/member-levels/{id}", h.updateMemberLevel)

	// Tarifa energetica
	r.With(am.RequireAuth).Get("/api/calculator/tariff", h.getTariff)
	r.With(am.RequirePermission("config.manage")).Put("/api/calculator/tariff", h.updateTariff)

	// Productos - editar y aprobar
	r.With(am.RequireAuth).Get("/api/products", h.listProducts)
	r.With(am.RequireAuth).Get("/api/products/{id}", h.getProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products", h.createProduct)
	r.With(am.RequirePermission("products.manage")).Put("/api/products/{id}", h.updateProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/approve", h.approveProduct)

	// Productores
	r.With(am.RequireAuth).Get("/api/products/{id}/producers", h.listProducers)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/producers", h.addProducer)
	r.With(am.RequirePermission("products.manage")).Delete("/api/products/producers/{pid}", h.removeProducer)

	// Historial de precios
	r.With(am.RequireAuth).Get("/api/products/{id}/price-history", h.getPriceHistory)

	// Fondo comunitario
	r.With(am.RequireAuth).Get("/api/fund/balance", h.getFundBalance)

	// Auto-ascenso de nivel
	r.With(am.RequireAuth).Post("/api/member-levels/auto-upgrade", h.autoUpgradeLevel)
}

// ===== AUDITORIA =====

func (h *SystemHandler) listAudit(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	actorID := r.URL.Query().Get("actor_id")
	fromDate := r.URL.Query().Get("from")
	toDate := r.URL.Query().Get("to")
	limit := 100

	query := `SELECT id, actor_id, action, target_id, details, ip_address, user_agent, created_at
		FROM audit_log WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if action != "" {
		query += ` AND action = $` + itoa(argIdx)
		args = append(args, action)
		argIdx++
	}
	if actorID != "" {
		query += ` AND actor_id = $` + itoa(argIdx)
		args = append(args, actorID)
		argIdx++
	}
	if fromDate != "" {
		query += ` AND created_at >= $` + itoa(argIdx)
		args = append(args, fromDate)
		argIdx++
	}
	if toDate != "" {
		query += ` AND created_at <= $` + itoa(argIdx)
		args = append(args, toDate)
		argIdx++
	}
	query += ` ORDER BY created_at DESC LIMIT ` + itoa(limit)

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var entries []map[string]interface{}
	for rows.Next() {
		var id int64
		var actorID *uuid.UUID
		var action string
		var targetID *uuid.UUID
		var details []byte
		var ipAddress *string
		var userAgent *string
		var createdAt time.Time
		if err := rows.Scan(&id, &actorID, &action, &targetID, &details, &ipAddress, &userAgent, &createdAt); err != nil {
			continue
		}

		var detailObj interface{}
		if details != nil {
			json.Unmarshal(details, &detailObj)
		}

		entries = append(entries, map[string]interface{}{
			"id":         id,
			"actor_id":   derefUUID(actorID),
			"action":     action,
			"target_id":  derefUUID(targetID),
			"details":    detailObj,
			"ip_address": deref(ipAddress),
			"user_agent": deref(userAgent),
			"created_at": createdAt,
		})
	}
	if entries == nil {
		entries = []map[string]interface{}{}
	}
	writeJSON(w, 200, entries)
}

// WriteAudit escribe una entrada en el audit log
func (h *SystemHandler) WriteAudit(ctx context.Context, actorID uuid.UUID, action string, targetID *uuid.UUID, details interface{}) {
	var detailBytes []byte
	if details != nil {
		detailBytes, _ = json.Marshal(details)
	}
	h.Pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, target_id, details)
		VALUES ($1, $2, $3, $4)`,
		actorID, action, targetID, detailBytes)
}

// ===== CONFIGURACION DEL NODO =====

func (h *SystemHandler) getConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var nodeName, currencyName, appName string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT node_name, currency_name, app_name FROM node_config WHERE node_domain = $1`,
		nodeDomain).Scan(&nodeName, &currencyName, &appName)
	if err != nil {
		// Defaults
		writeJSON(w, 200, map[string]interface{}{
			"node_name":     nodeDomain,
			"currency_name": "TQ",
			"app_name":      "Red de Intercambio",
			"node_domain":   nodeDomain,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":     nodeName,
		"currency_name": currencyName,
		"app_name":      appName,
		"node_domain":   nodeDomain,
	})
}

type UpdateNodeConfigRequest struct {
	NodeName     string `json:"node_name"`
	CurrencyName string `json:"currency_name"`
	AppName      string `json:"app_name"`
}

func (h *SystemHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateNodeConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE node_config SET node_name = $1, currency_name = $2, app_name = $3 WHERE node_domain = $4`,
		req.NodeName, req.CurrencyName, req.AppName, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":     req.NodeName,
		"currency_name": req.CurrencyName,
		"app_name":      req.AppName,
		"message":       "Configuracion actualizada",
	})
}

// ===== NIVELES DE MIEMBRO =====

func (h *SystemHandler) listMemberLevels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, level, has_voice, has_vote, counts_in_quorum,
			   credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit,
			   tax_rate, auto_upgrade_after_days, upgrade_to,
			   can_create_organization, can_cross_node_trade, can_receive_nfc_card,
			   can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase, is_system
		FROM member_levels WHERE node_domain = $1 AND is_active = true ORDER BY level`,
		nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing member levels")
		return
	}
	defer rows.Close()

	var levels []map[string]interface{}
	for rows.Next() {
		var id, name, description string
		var level int
		var hasVoice, hasVote, countsInQuorum bool
		var creditLimit, debitLimit int64
		var perTxLimit, dailyLimit, monthlyLimit *int64
		var taxRate *float64
		var autoUpgradeDays *int
		var upgradeTo *string
		var canCreateOrg, canCrossNode, canNFC, canAudit, canBridge bool
		var maxOrgs int
		var canRequestLimit bool
		var isSystem bool

		if err := rows.Scan(&id, &name, &description, &level, &hasVoice, &hasVote, &countsInQuorum,
			&creditLimit, &debitLimit, &perTxLimit, &dailyLimit, &monthlyLimit,
			&taxRate, &autoUpgradeDays, &upgradeTo,
			&canCreateOrg, &canCrossNode, &canNFC, &canAudit, &canBridge, &maxOrgs, &canRequestLimit, &isSystem); err != nil {
			continue
		}

		levels = append(levels, map[string]interface{}{
			"id":                         id,
			"name":                       name,
			"description":                description,
			"level":                      level,
			"has_voice":                  hasVoice,
			"has_vote":                   hasVote,
			"counts_in_quorum":           countsInQuorum,
			"credit_limit":               creditLimit,
			"debit_limit":                debitLimit,
			"per_transaction_limit":      perTxLimit,
			"daily_limit":                dailyLimit,
			"monthly_limit":              monthlyLimit,
			"tax_rate":                   taxRate,
			"auto_upgrade_after_days":    autoUpgradeDays,
			"upgrade_to":                 deref(upgradeTo),
			"can_create_organization":    canCreateOrg,
			"can_cross_node_trade":       canCrossNode,
			"can_receive_nfc_card":       canNFC,
			"can_view_audit":             canAudit,
			"can_use_external_bridge":    canBridge,
			"max_organizations":          maxOrgs,
			"can_request_limit_increase": canRequestLimit,
			"is_system":                  isSystem,
		})
	}
	if levels == nil {
		levels = []map[string]interface{}{}
	}
	writeJSON(w, 200, levels)
}

type CreateMemberLevelRequest struct {
	Name                    string   `json:"name"`
	Description             string   `json:"description"`
	Level                   int      `json:"level"`
	HasVoice                bool     `json:"has_voice"`
	HasVote                 bool     `json:"has_vote"`
	CountsInQuorum          bool     `json:"counts_in_quorum"`
	CreditLimit             int64    `json:"credit_limit"`
	DebitLimit              int64    `json:"debit_limit"`
	PerTransactionLimit     *int64   `json:"per_transaction_limit"`
	DailyLimit              *int64   `json:"daily_limit"`
	MonthlyLimit            *int64   `json:"monthly_limit"`
	TaxRate                 *float64 `json:"tax_rate"`
	AutoUpgradeAfterDays    *int     `json:"auto_upgrade_after_days"`
	UpgradeTo               *string  `json:"upgrade_to"`
	CanCreateOrganization   bool     `json:"can_create_organization"`
	CanCrossNodeTrade       bool     `json:"can_cross_node_trade"`
	CanReceiveNFCCard       bool     `json:"can_receive_nfc_card"`
	CanViewAudit            bool     `json:"can_view_audit"`
	CanUseExternalBridge    bool     `json:"can_use_external_bridge"`
	MaxOrganizations        int      `json:"max_organizations"`
	CanRequestLimitIncrease bool     `json:"can_request_limit_increase"`
}

func (h *SystemHandler) createMemberLevel(w http.ResponseWriter, r *http.Request) {
	var req CreateMemberLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	id := req.Name
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
			credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit,
			tax_rate, auto_upgrade_after_days, upgrade_to,
			can_create_organization, can_cross_node_trade, can_receive_nfc_card,
			can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
		id, nodeDomain, req.Name, req.Description, req.Level, req.HasVoice, req.HasVote, req.CountsInQuorum,
		req.CreditLimit, req.DebitLimit, req.PerTransactionLimit, req.DailyLimit, req.MonthlyLimit,
		req.TaxRate, req.AutoUpgradeAfterDays, req.UpgradeTo,
		req.CanCreateOrganization, req.CanCrossNodeTrade, req.CanReceiveNFCCard,
		req.CanViewAudit, req.CanUseExternalBridge, req.MaxOrganizations, req.CanRequestLimitIncrease)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":      id,
		"name":    req.Name,
		"message": "Nivel creado",
	})
}

func (h *SystemHandler) updateMemberLevel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CreateMemberLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE member_levels SET
			name = $1, description = $2, level = $3, has_voice = $4, has_vote = $5, counts_in_quorum = $6,
			credit_limit = $7, debit_limit = $8, per_transaction_limit = $9, daily_limit = $10, monthly_limit = $11,
			tax_rate = $12, auto_upgrade_after_days = $13, upgrade_to = $14,
			can_create_organization = $15, can_cross_node_trade = $16, can_receive_nfc_card = $17,
			can_view_audit = $18, can_use_external_bridge = $19, max_organizations = $20, can_request_limit_increase = $21
		WHERE id = $22`,
		req.Name, req.Description, req.Level, req.HasVoice, req.HasVote, req.CountsInQuorum,
		req.CreditLimit, req.DebitLimit, req.PerTransactionLimit, req.DailyLimit, req.MonthlyLimit,
		req.TaxRate, req.AutoUpgradeAfterDays, req.UpgradeTo,
		req.CanCreateOrganization, req.CanCrossNodeTrade, req.CanReceiveNFCCard,
		req.CanViewAudit, req.CanUseExternalBridge, req.MaxOrganizations, req.CanRequestLimitIncrease, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Nivel actualizado"})
}

// ===== TARIFA ENERGETICA =====

func (h *SystemHandler) getTariff(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	row := h.Pool.QueryRow(r.Context(), `
		SELECT vital_food, vital_water, vital_domestic, vital_services,
			   effort_admin, effort_technical, effort_agricultural,
			   work_hours_per_day, work_days_per_month
		FROM energy_tariff WHERE node_domain = $1`, nodeDomain)

	var vitalFood, vitalWater, vitalDomestic, vitalServices float64
	var effortAdmin, effortTech, effortAgri float64
	var workHours, workDays int
	err := row.Scan(&vitalFood, &vitalWater, &vitalDomestic, &vitalServices,
		&effortAdmin, &effortTech, &effortAgri, &workHours, &workDays)
	if err != nil {
		// Defaults
		writeJSON(w, 200, map[string]interface{}{
			"vital_food":          800,
			"vital_water":         150,
			"vital_domestic":      350,
			"vital_services":      200,
			"effort_admin":        1.0,
			"effort_technical":    1.15,
			"effort_agricultural": 1.3,
			"work_hours_per_day":  6,
			"work_days_per_month": 24,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"vital_food":          vitalFood,
		"vital_water":         vitalWater,
		"vital_domestic":      vitalDomestic,
		"vital_services":      vitalServices,
		"effort_admin":        effortAdmin,
		"effort_technical":    effortTech,
		"effort_agricultural": effortAgri,
		"work_hours_per_day":  workHours,
		"work_days_per_month": workDays,
	})
}

type UpdateTariffRequest struct {
	VitalFood          float64 `json:"vital_food"`
	VitalWater         float64 `json:"vital_water"`
	VitalDomestic      float64 `json:"vital_domestic"`
	VitalServices      float64 `json:"vital_services"`
	EffortAdmin        float64 `json:"effort_admin"`
	EffortTechnical    float64 `json:"effort_technical"`
	EffortAgricultural float64 `json:"effort_agricultural"`
	WorkHoursPerDay    int     `json:"work_hours_per_day"`
	WorkDaysPerMonth   int     `json:"work_days_per_month"`
}

func (h *SystemHandler) updateTariff(w http.ResponseWriter, r *http.Request) {
	var req UpdateTariffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO energy_tariff (node_domain, vital_food, vital_water, vital_domestic, vital_services,
			effort_admin, effort_technical, effort_agricultural, work_hours_per_day, work_days_per_month)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (node_domain) DO UPDATE SET
			vital_food = $2, vital_water = $3, vital_domestic = $4, vital_services = $5,
			effort_admin = $6, effort_technical = $7, effort_agricultural = $8,
			work_hours_per_day = $9, work_days_per_month = $10`,
		nodeDomain, req.VitalFood, req.VitalWater, req.VitalDomestic, req.VitalServices,
		req.EffortAdmin, req.EffortTechnical, req.EffortAgricultural, req.WorkHoursPerDay, req.WorkDaysPerMonth)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Tarifa actualizada"})
}

// ===== PRODUCTOS =====

func (h *SystemHandler) listProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, category, unit, price_per_unit, is_approved, origin
		FROM products ORDER BY category, name LIMIT 200`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var products []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, description, category, unit string
		var price float64
		var isApproved bool
		var origin string
		if err := rows.Scan(&id, &name, &description, &category, &unit, &price, &isApproved, &origin); err != nil {
			continue
		}
		products = append(products, map[string]interface{}{
			"id":          id.String(),
			"name":        name,
			"description": description,
			"category":    category,
			"unit":        unit,
			"price":       price,
			"is_approved": isApproved,
			"origin":      origin,
		})
	}
	if products == nil {
		products = []map[string]interface{}{}
	}
	writeJSON(w, 200, products)
}

func (h *SystemHandler) getProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var name, description, category, unit string
	var price float64
	var isApproved bool
	var origin string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT name, description, category, unit, price_per_unit, is_approved, origin
		FROM products WHERE id = $1`, id).Scan(&name, &description, &category, &unit, &price, &isApproved, &origin)
	if err != nil {
		writeError(w, 404, "product not found")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":          id.String(),
		"name":        name,
		"description": description,
		"category":    category,
		"unit":        unit,
		"price":       price,
		"is_approved": isApproved,
		"origin":      origin,
	})
}

type CreateSystemProductRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Unit        string  `json:"unit"`
	Price       float64 `json:"price"`
	Origin      string  `json:"origin"`
}

func (h *SystemHandler) createProduct(w http.ResponseWriter, r *http.Request) {
	var req CreateSystemProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}
	if req.Origin == "" {
		req.Origin = "internal"
	}
	if req.Unit == "" {
		req.Unit = "unidad"
	}

	id := uuid.New()
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO products (id, name, description, category, unit, price_per_unit, origin, is_approved)
		VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
		id, req.Name, req.Description, req.Category, req.Unit, req.Price, req.Origin)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":          id.String(),
		"name":        req.Name,
		"price":       req.Price,
		"is_approved": false,
		"message":     "Producto creado. Pendiente de aprobacion de la asamblea.",
	})
}

func (h *SystemHandler) updateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var req CreateSystemProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE products SET name = $1, description = $2, category = $3, unit = $4, price_per_unit = $5, origin = $6
		WHERE id = $7`,
		req.Name, req.Description, req.Category, req.Unit, req.Price, req.Origin, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Producto actualizado"})
}

func (h *SystemHandler) approveProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	_, err = h.Pool.Exec(r.Context(), `UPDATE products SET is_approved = true, approved_by = $1 WHERE id = $2`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Registrar en historial
	h.Pool.Exec(r.Context(), `
		INSERT INTO product_price_history (product_id, old_price, new_price, change_reason, approved_by)
		SELECT $1, price_per_unit, price_per_unit, 'Aprobacion inicial', $2 FROM products WHERE id = $1`,
		id, userID)

	writeJSON(w, 200, map[string]interface{}{"message": "Producto aprobado"})
}

// ===== PRODUCTORES =====

func (h *SystemHandler) listProducers(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT pp.id, pp.producer_id, u.username, u.display_name,
			   pp.energy_direct, pp.energy_human, pp.energy_inputs, pp.energy_amortization,
			   pp.price_per_unit, pp.is_active
		FROM product_producers pp
		JOIN users u ON u.id = pp.producer_id
		WHERE pp.product_id = $1 AND pp.is_active = true`, productID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var producers []map[string]interface{}
	for rows.Next() {
		var id, producerID uuid.UUID
		var username string
		var displayName *string
		var energyDirect, energyHuman, energyInputs, energyAmortization float64
		var pricePerUnit float64
		var isActive bool
		if err := rows.Scan(&id, &producerID, &username, &displayName, &energyDirect, &energyHuman, &energyInputs, &energyAmortization, &pricePerUnit, &isActive); err != nil {
			continue
		}
		producers = append(producers, map[string]interface{}{
			"id":                  id.String(),
			"producer_id":         producerID.String(),
			"username":            username,
			"display_name":        deref(displayName),
			"energy_direct":       energyDirect,
			"energy_human":        energyHuman,
			"energy_inputs":       energyInputs,
			"energy_amortization": energyAmortization,
			"price_per_unit":      pricePerUnit,
			"is_active":           isActive,
		})
	}
	if producers == nil {
		producers = []map[string]interface{}{}
	}
	writeJSON(w, 200, producers)
}

type AddProducerRequest struct {
	ProducerID         string  `json:"producer_id"`
	EnergyDirect       float64 `json:"energy_direct"`
	EnergyHuman        float64 `json:"energy_human"`
	EnergyInputs       float64 `json:"energy_inputs"`
	EnergyAmortization float64 `json:"energy_amortization"`
}

func (h *SystemHandler) addProducer(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}

	var req AddProducerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	producerID, err := uuid.Parse(req.ProducerID)
	if err != nil {
		// Buscar por username
		err = h.Pool.QueryRow(r.Context(), `SELECT id FROM users WHERE username = $1`, req.ProducerID).Scan(&producerID)
		if err != nil {
			writeError(w, 404, "producer not found")
			return
		}
	}

	// Calcular precio total
	totalEnergy := req.EnergyDirect + req.EnergyHuman + req.EnergyInputs + req.EnergyAmortization

	id := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO product_producers (id, product_id, producer_id, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_unit, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
		ON CONFLICT (product_id, producer_id) DO UPDATE SET
			energy_direct = $4, energy_human = $5, energy_inputs = $6, energy_amortization = $7, price_per_unit = $8, is_active = true`,
		id, productID, producerID, req.EnergyDirect, req.EnergyHuman, req.EnergyInputs, req.EnergyAmortization, totalEnergy)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":             id.String(),
		"producer_id":    producerID.String(),
		"price_per_unit": totalEnergy,
		"message":        "Productor agregado",
	})
}

func (h *SystemHandler) removeProducer(w http.ResponseWriter, r *http.Request) {
	pid, err := uuid.Parse(chi.URLParam(r, "pid"))
	if err != nil {
		writeError(w, 400, "invalid producer id")
		return
	}
	_, err = h.Pool.Exec(r.Context(), `UPDATE product_producers SET is_active = false WHERE id = $1`, pid)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "removed"})
}

// ===== HISTORIAL DE PRECIOS =====

func (h *SystemHandler) getPriceHistory(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, old_price, new_price, change_reason, approved_by, created_at
		FROM product_price_history
		WHERE product_id = $1
		ORDER BY created_at DESC LIMIT 50`, productID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var oldPrice, newPrice float64
		var changeReason *string
		var approvedBy *uuid.UUID
		var createdAt time.Time
		if err := rows.Scan(&id, &oldPrice, &newPrice, &changeReason, &approvedBy, &createdAt); err != nil {
			continue
		}
		history = append(history, map[string]interface{}{
			"id":            id.String(),
			"old_price":     oldPrice,
			"new_price":     newPrice,
			"change_reason": deref(changeReason),
			"approved_by":   derefUUID(approvedBy),
			"created_at":    createdAt,
		})
	}
	if history == nil {
		history = []map[string]interface{}{}
	}
	writeJSON(w, 200, history)
}

// ===== FONDO COMUNITARIO =====

func (h *SystemHandler) getFundBalance(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// Buscar cuenta del fondo
	var fundID uuid.UUID
	var balance int64
	var username string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id, balance, username FROM users WHERE node_domain = $1 AND account_type = 'fund' AND is_active = true LIMIT 1`,
		nodeDomain).Scan(&fundID, &balance, &username)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"fund_account": nil,
			"balance":      0,
			"message":      "No hay cuenta de fondo comunitario. Crea una cuenta tipo 'fund' para acumular impuestos.",
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"fund_account": fundID.String(),
		"username":     username,
		"balance":      balance,
	})
}

// ===== AUTO-ASCENSO DE NIVEL =====

func (h *SystemHandler) autoUpgradeLevel(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// Obtener nivel actual del usuario y cuando fue creado
	var currentLevelID string
	var createdAt time.Time
	err = h.Pool.QueryRow(r.Context(), `
		SELECT member_level_id, created_at FROM users WHERE id = $1`, userID).Scan(&currentLevelID, &createdAt)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}

	// Obtener configuracion del nivel actual
	var autoUpgradeDays *int
	var upgradeTo *string
	var levelName string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT auto_upgrade_after_days, upgrade_to, name
		FROM member_levels WHERE id = $1 AND node_domain = $2`,
		currentLevelID, nodeDomain).Scan(&autoUpgradeDays, &upgradeTo, &levelName)
	if err != nil {
		writeError(w, 500, "error getting current level")
		return
	}

	if autoUpgradeDays == nil || *autoUpgradeDays <= 0 || upgradeTo == nil || *upgradeTo == "" {
		writeJSON(w, 200, map[string]interface{}{
			"upgraded": false,
			"message":  "Tu nivel actual no tiene auto-ascenso configurado.",
			"level":    levelName,
		})
		return
	}

	// Verificar si ya paso el tiempo requerido
	daysSinceCreation := int(time.Since(createdAt).Hours() / 24)
	if daysSinceCreation < *autoUpgradeDays {
		remaining := *autoUpgradeDays - daysSinceCreation
		writeJSON(w, 200, map[string]interface{}{
			"upgraded":  false,
			"message":   "Aun no puedes ascender.",
			"level":     levelName,
			"days_left": remaining,
			"required":  *autoUpgradeDays,
		})
		return
	}

	// Verificar que el nivel destino existe
	var newLevelID string
	var newLevelName string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT id, name FROM member_levels WHERE id = $1 AND node_domain = $2 AND is_active = true`,
		*upgradeTo, nodeDomain).Scan(&newLevelID, &newLevelName)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"upgraded": false,
			"message":  "El nivel destino no existe. Contacta al administrador.",
		})
		return
	}

	// Obtener limites del nuevo nivel
	var newCreditLimit, newDebitLimit int64
	h.Pool.QueryRow(r.Context(), `SELECT credit_limit, debit_limit FROM member_levels WHERE id = $1`, newLevelID).Scan(&newCreditLimit, &newDebitLimit)

	// Ascender
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE users SET member_level_id = $1, credit_limit = $2, debit_limit = $3 WHERE id = $4`,
		newLevelID, newCreditLimit, newDebitLimit, userID)
	if err != nil {
		writeError(w, 500, "error upgrading level")
		return
	}

	// Registrar en historial
	h.Pool.Exec(r.Context(), `
		INSERT INTO membership_history (user_id, old_level, new_level, new_status, reason, approved_by)
		VALUES ($1, $2, $3, 'active', 'Auto-ascenso despues de dias', $4)`,
		userID, currentLevelID, newLevelID, userID)

	// Audit log
	details, _ := json.Marshal(map[string]interface{}{"old_level": currentLevelID, "new_level": newLevelID, "days": daysSinceCreation})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, details) VALUES ($1, 'level_upgrade', $2)`,
		userID, details)

	writeJSON(w, 200, map[string]interface{}{
		"upgraded":   true,
		"message":    "Felicidades! Has ascendido de nivel.",
		"old_level":  levelName,
		"new_level":  newLevelName,
		"new_credit": newCreditLimit,
		"new_debit":  newDebitLimit,
	})
}

// ===== HELPER =====

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
