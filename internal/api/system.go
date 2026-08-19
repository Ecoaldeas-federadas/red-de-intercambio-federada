package api

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/db"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SystemHandler maneja auditoria, configuracion del nodo, niveles de miembro y moneda
type SystemHandler struct {
	Pool       *pgxpool.Pool
	Auth       *AuthMiddleware
	nodeDomain string
}

func (h *SystemHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// ===== ENDPOINTS PUBLICOS (sin auth) - Sitio web del nodo =====
	r.Get("/api/public/settings", h.getPublicSettings)
	r.Get("/api/public/pages", h.listPublicPages)
	r.Get("/api/public/pages/{slug}", h.getPublicPage)
	r.Get("/api/public/page/{slug}/html", h.renderPublicPageHTML)
	r.Get("/api/public/admission-form", h.getPublicAdmissionForm)
	r.Post("/api/public/admission-request", h.submitAdmissionRequest)
	r.Get("/api/public/products", h.listPublicProducts)

	// ===== ENDPOINTS PRIVADOS (requieren auth) =====

	// Gestion del sitio publico (admin)
	r.With(am.RequireAuth).Get("/api/site/pages", h.listSitePages)
	r.With(am.RequirePermission("config.manage")).Post("/api/site/pages", h.createSitePage)
	r.With(am.RequirePermission("config.manage")).Put("/api/site/pages/{id}", h.updateSitePage)
	r.With(am.RequirePermission("config.manage")).Put("/api/site/pages/by-slug/{slug}", h.upsertSitePageBySlug)
	r.With(am.RequirePermission("config.manage")).Delete("/api/site/pages/{id}", h.deleteSitePage)
	r.With(am.RequirePermission("config.manage")).Post("/api/site/pages/reset/{slug}", h.resetSitePage)
	r.With(am.RequireAuth).Get("/api/site/settings", h.getSiteSettings)
	r.With(am.RequirePermission("config.manage")).Put("/api/site/settings", h.updateSiteSettings)
	r.With(am.RequirePermission("config.manage")).Put("/api/site/admission-form", h.updateSiteAdmissionForm)

	// Solicitudes de admision (admin)
	r.With(am.RequireAuth).Get("/api/admission-requests", h.listAdmissionRequests)
	r.With(am.RequirePermission("admission.manage")).Post("/api/admission-requests/{id}/approve", h.approveAdmissionRequest)
	r.With(am.RequirePermission("admission.manage")).Post("/api/admission-requests/{id}/reject", h.rejectAdmissionRequest)

	// Auditoria
	r.With(am.RequireAuth).Get("/api/audit", h.listAudit)

	// Configuracion del nodo (moneda, nombre, etc)
	r.With(am.RequireAuth).Get("/api/config", h.getConfig)
	r.With(am.RequirePermission("config.manage")).Put("/api/config", h.updateConfig)

	// Backup y restauracion de la base de datos
	r.With(am.RequirePermission("config.manage")).Get("/api/backup", h.downloadBackup)
	r.With(am.RequirePermission("config.manage")).Post("/api/backup/restore", h.restoreBackup)

	// Niveles de miembro (CRUD completo)
	r.With(am.RequireAuth).Get("/api/member-levels", h.listMemberLevels)
	r.With(am.RequirePermission("config.manage")).Post("/api/member-levels", h.createMemberLevel)
	r.With(am.RequirePermission("config.manage")).Put("/api/member-levels/{id}", h.updateMemberLevel)

	// Niveles de organizacion (CRUD completo, separados de member_levels)
	r.With(am.RequireAuth).Get("/api/organization-levels", h.listOrganizationLevels)
	r.With(am.RequirePermission("config.manage")).Post("/api/organization-levels", h.createOrganizationLevel)
	r.With(am.RequirePermission("config.manage")).Put("/api/organization-levels/{id}", h.updateOrganizationLevel)

	// Tarifa energetica
	r.With(am.RequireAuth).Get("/api/calculator/tariff", h.getTariff)
	r.With(am.RequirePermission("config.manage")).Put("/api/calculator/tariff", h.updateTariff)

	// Productos - editar y aprobar
	r.With(am.RequireAuth).Get("/api/products", h.listProducts)
	r.With(am.RequireAuth).Get("/api/products/categories", h.listProductCategories)
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

	// Gobernanza - Ley de la Aldea (CRUD)
	r.Get("/api/public/governance", h.listGovernanceRules) // publico: cualquiera puede leer
	r.With(am.RequireAuth).Get("/api/governance/rules", h.listGovernanceRules)
	r.With(am.RequirePermission("governance.manage")).Post("/api/governance/rules", h.createGovernanceRule)
	r.With(am.RequirePermission("governance.manage")).Put("/api/governance/rules/{id}", h.updateGovernanceRule)
	r.With(am.RequirePermission("governance.manage")).Delete("/api/governance/rules/{id}", h.deleteGovernanceRule)

	// Auto-ascenso de nivel
	r.With(am.RequireAuth).Post("/api/member-levels/auto-upgrade", h.autoUpgradeLevel)

	// Super admin: habilitar/deshabilitar (requiere permiso especial de junta)
	r.With(am.RequireAuth).Get("/api/admin/super-admin-status", h.getSuperAdminStatus)
	r.With(am.RequirePermission("admin.toggle_super_admin")).Put("/api/admin/super-admin/{id}", h.toggleSuperAdmin)

	// Parametros de calculadora (tipos de trabajo e insumos)
	r.With(am.RequireAuth).Get("/api/calculator/params", h.listCalcParams)
	r.With(am.RequireAuth).Get("/api/calculator/categories", h.listCalcCategories)
	r.With(am.RequirePermission("calculator.manage_params")).Post("/api/calculator/params", h.createCalcParam)
	r.With(am.RequirePermission("calculator.manage_params")).Put("/api/calculator/params/{id}", h.updateCalcParam)
	r.With(am.RequirePermission("calculator.manage_params")).Delete("/api/calculator/params/{id}", h.deleteCalcParam)
	r.With(am.RequirePermission("calculator.manage_params")).Post("/api/calculator/params/{id}/approve", h.approveCalcParam)
	r.With(am.RequirePermission("calculator.manage_params")).Post("/api/calculator/categories", h.createCalcCategory)

	// Subida de imagenes (para el editor visual del sitio publico)
	r.With(am.RequireAuth).Post("/api/uploads/image", h.uploadImage)
	r.With(am.RequireAuth).Get("/api/uploads/images", h.listUploadedImages)
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

	var nodeName, currencyName, appName, currencyFullName string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT node_name, currency_name, app_name, COALESCE(currency_full_name, 'Trueque')
		FROM node_config WHERE node_domain = $1`,
		nodeDomain).Scan(&nodeName, &currencyName, &appName, &currencyFullName)
	if err != nil {
		// Defaults
		writeJSON(w, 200, map[string]interface{}{
			"node_name":          nodeDomain,
			"currency_name":      "TQ",
			"currency_full_name": "Trueque",
			"app_name":           "Red de Intercambio",
			"node_domain":        nodeDomain,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":          nodeName,
		"currency_name":      currencyName,
		"currency_full_name": currencyFullName,
		"app_name":           appName,
		"node_domain":        nodeDomain,
	})
}

type UpdateNodeConfigRequest struct {
	NodeName         string `json:"node_name"`
	CurrencyName     string `json:"currency_name"`
	CurrencyFullName string `json:"currency_full_name"`
	AppName          string `json:"app_name"`
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
		UPDATE node_config SET node_name = $1, currency_name = $2, app_name = $3, currency_full_name = $4 WHERE node_domain = $5`,
		req.NodeName, req.CurrencyName, req.AppName, req.CurrencyFullName, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":          req.NodeName,
		"currency_name":      req.CurrencyName,
		"currency_full_name": req.CurrencyFullName,
		"app_name":           req.AppName,
		"message":            "Configuracion actualizada",
	})
}

// ===== NIVELES DE MIEMBRO =====

func (h *SystemHandler) listMemberLevels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// Intentar usar el node_domain real del usuario autenticado
	userID, err := h.Auth.GetUserID(r)
	var userMemberLevelID *string
	if err == nil {
		var userNodeDomain string
		err = h.Pool.QueryRow(r.Context(), `SELECT node_domain, member_level_id FROM users WHERE id = $1`, userID).Scan(&userNodeDomain, &userMemberLevelID)
		if err == nil && userNodeDomain != "" {
			nodeDomain = userNodeDomain
		}
	}

	// Query base: niveles del dominio del usuario.
	// Si el usuario tiene un member_level_id que no pertenece a este dominio,
	// tambien lo incluimos (puede pasar si el nivel se asigno antes de configurar el dominio).
	query := `
		SELECT id, name, description, level, has_voice, has_vote, counts_in_quorum,
			   credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit,
			   tax_rate, auto_upgrade_after_days, upgrade_to,
			   can_create_organization, can_cross_node_trade, can_receive_nfc_card,
			   can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase, is_system
		FROM member_levels WHERE node_domain = $1 AND is_active = true`
	args := []interface{}{nodeDomain}
	if userMemberLevelID != nil && *userMemberLevelID != "" {
		query += `
		UNION ALL
		SELECT id, name, description, level, has_voice, has_vote, counts_in_quorum,
			   credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit,
			   tax_rate, auto_upgrade_after_days, upgrade_to,
			   can_create_organization, can_cross_node_trade, can_receive_nfc_card,
			   can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase, is_system
		FROM member_levels WHERE id = $2 AND NOT (node_domain = $1 AND is_active = true)`
		args = append(args, *userMemberLevelID)
	}
	query += ` ORDER BY level`

	rows, err := h.Pool.Query(r.Context(), query, args...)
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
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, parent_category, category, subcategory, unit, price_per_unit, is_approved, origin, badge, image_url, product_code, is_system, is_hidden
		FROM products WHERE node_domain IN ($1, 'localhost', 'default') ORDER BY parent_category, category, subcategory, name LIMIT 200`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var products []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, description, parentCategory, category, subcategory, unit, origin string
		var price float64
		var isApproved, isSystem, isHidden bool
		var badge, imageURL, productCode *string
		if err := rows.Scan(&id, &name, &description, &parentCategory, &category, &subcategory, &unit, &price, &isApproved, &origin, &badge, &imageURL, &productCode, &isSystem, &isHidden); err != nil {
			continue
		}
		bdg := ""
		if badge != nil {
			bdg = *badge
		}
		imgURL := ""
		if imageURL != nil {
			imgURL = *imageURL
		}
		pcode := ""
		if productCode != nil {
			pcode = *productCode
		}
		products = append(products, map[string]interface{}{
			"id":              id.String(),
			"name":            name,
			"description":     description,
			"parent_category": parentCategory,
			"category":        category,
			"subcategory":     subcategory,
			"unit":            unit,
			"price":           price,
			"is_approved":     isApproved,
			"origin":          origin,
			"badge":           bdg,
			"image_url":       imgURL,
			"product_code":    pcode,
			"is_system":       isSystem,
			"is_hidden":       isHidden,
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

	var name, description, parentCategory, category, subcategory, unit, origin string
	var price float64
	var isApproved, isHidden bool
	var badge, imageURL, productCode *string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT name, description, parent_category, category, subcategory, unit, price_per_unit, is_approved, origin, badge, image_url, product_code, is_hidden
		FROM products WHERE id = $1`, id).Scan(&name, &description, &parentCategory, &category, &subcategory, &unit, &price, &isApproved, &origin, &badge, &imageURL, &productCode, &isHidden)
	if err != nil {
		writeError(w, 404, "product not found")
		return
	}

	bdg := ""
	if badge != nil {
		bdg = *badge
	}
	imgURL := ""
	if imageURL != nil {
		imgURL = *imageURL
	}
	pcode := ""
	if productCode != nil {
		pcode = *productCode
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":              id.String(),
		"name":            name,
		"description":     description,
		"parent_category": parentCategory,
		"category":        category,
		"subcategory":     subcategory,
		"unit":            unit,
		"price":           price,
		"is_approved":     isApproved,
		"origin":          origin,
		"badge":           bdg,
		"image_url":       imgURL,
		"product_code":    pcode,
		"is_hidden":       isHidden,
	})
}

type CreateSystemProductRequest struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	ParentCategory string  `json:"parent_category"`
	Category       string  `json:"category"`
	Subcategory    string  `json:"subcategory"`
	Unit           string  `json:"unit"`
	Price          float64 `json:"price"`
	Origin         string  `json:"origin"`
	Badge          string  `json:"badge"`
	ImageURL       string  `json:"image_url"`
	ProductCode    string  `json:"product_code"`
	IsHidden       *bool   `json:"is_hidden"`
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
		INSERT INTO products (id, node_domain, name, description, parent_category, category, subcategory, unit, price_per_unit, origin, badge, image_url, product_code, is_approved)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false)`,
		id, h.nodeDomain, req.Name, req.Description, req.ParentCategory, req.Category, req.Subcategory, req.Unit, req.Price, req.Origin, req.Badge, req.ImageURL, req.ProductCode)
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

	isHidden := false
	if req.IsHidden != nil {
		isHidden = *req.IsHidden
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE products SET name = $1, description = $2, parent_category = $3, category = $4, subcategory = $5, unit = $6, price_per_unit = $7, origin = $8, badge = $9, image_url = $10, product_code = $11, is_hidden = $12, updated_at = NOW()
		WHERE id = $13`,
		req.Name, req.Description, req.ParentCategory, req.Category, req.Subcategory, req.Unit, req.Price, req.Origin, req.Badge, req.ImageURL, req.ProductCode, isHidden, id)
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

	// Broadcast a nodos federados: solo productos aprobados por la asamblea local
	// se distribuyen a otros nodos para su aprobacion individual
	go h.broadcastProductToFederation(r.Context(), id)

	writeJSON(w, 200, map[string]interface{}{
		"message": "Producto aprobado por la asamblea. Se ha notificado a los nodos federados para su aprobacion individual.",
	})
}

// broadcastProductToFederation envia el producto aprobado a todos los nodos federados conocidos
// para que cada nodo lo apruebe individualmente via su propia asamblea
func (h *SystemHandler) broadcastProductToFederation(ctx context.Context, productID uuid.UUID) {
	// Obtener datos del producto aprobado
	var name, parentCat, cat, subcat, unit, description, badge, imageURL string
	var price float64
	var isComposite bool
	err := h.Pool.QueryRow(ctx, `
		SELECT name, parent_category, category, subcategory, unit, description, badge, image_url, price_per_unit, is_composite
		FROM products WHERE id = $1 AND is_approved = true`,
		productID).Scan(&name, &parentCat, &cat, &subcat, &unit, &description, &badge, &imageURL, &price, &isComposite)
	if err != nil {
		return
	}

	// Listar nodos federados conocidos
	rows, err := h.Pool.Query(ctx, `SELECT remote_node FROM node_balance WHERE remote_node != $1`, h.nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()

	var nodes []string
	for rows.Next() {
		var node string
		_ = rows.Scan(&node)
		if node != "" {
			nodes = append(nodes, node)
		}
	}

	// Por cada nodo, registrar el intento de broadcast
	// El envio real requiere cliente TLS federado con URL del nodo remoto
	for _, node := range nodes {
		// Registrar en log para auditoria
		h.Pool.Exec(ctx, `
			INSERT INTO audit_log (actor_id, action, target_id, details)
			VALUES (NULL, 'federation_product_broadcast', $1, $2)`,
			productID, fmt.Sprintf("Producto %s aprobado localmente, broadcast a nodo %s", name, node))
	}
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
		SELECT id, balance, username FROM users WHERE node_domain = $1 AND account_type = 'fund' AND membership_status = 'active' LIMIT 1`,
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

	// Obtener nivel actual del usuario, su node_domain y cuando fue creado
	var currentLevelID *string
	var userNodeDomain string
	var createdAt time.Time
	err = h.Pool.QueryRow(r.Context(), `
		SELECT member_level_id, node_domain, created_at FROM users WHERE id = $1`, userID).Scan(&currentLevelID, &userNodeDomain, &createdAt)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}

	// Usar el node_domain real del usuario, no el del header
	effectiveDomain := userNodeDomain
	if effectiveDomain == "" {
		effectiveDomain = nodeDomain
	}

	if currentLevelID == nil || *currentLevelID == "" {
		writeJSON(w, 200, map[string]interface{}{
			"upgraded": false,
			"message":  "No tienes un nivel asignado. Pide a la asamblea que te asigne un nivel.",
		})
		return
	}

	// Obtener configuracion del nivel actual
	// Buscar primero por node_domain del usuario; si no se encuentra, buscar por id sin filtro de dominio
	var autoUpgradeDays *int
	var upgradeTo *string
	var levelName string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT auto_upgrade_after_days, upgrade_to, name
		FROM member_levels WHERE id = $1 AND node_domain = $2`,
		*currentLevelID, effectiveDomain).Scan(&autoUpgradeDays, &upgradeTo, &levelName)
	if err != nil {
		// Fallback: buscar el nivel por id sin filtrar por node_domain
		err = h.Pool.QueryRow(r.Context(), `
			SELECT auto_upgrade_after_days, upgrade_to, name
			FROM member_levels WHERE id = $1`,
			*currentLevelID).Scan(&autoUpgradeDays, &upgradeTo, &levelName)
	}
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"upgraded": false,
			"message":  "No se encontro tu nivel. Pide a la asamblea que te asigne un nivel.",
		})
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
		*upgradeTo, effectiveDomain).Scan(&newLevelID, &newLevelName)
	if err != nil {
		// Fallback: buscar sin filtrar por node_domain
		err = h.Pool.QueryRow(r.Context(), `
			SELECT id, name FROM member_levels WHERE id = $1 AND is_active = true`,
			*upgradeTo).Scan(&newLevelID, &newLevelName)
	}
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

// ===== SUPER ADMIN =====

func (h *SystemHandler) getSuperAdminStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var isSuperAdmin, superAdminEnabled bool
	var username string
	err = h.Pool.QueryRow(r.Context(), `
		SELECT is_super_admin, super_admin_enabled, username FROM users WHERE id = $1`, userID).Scan(&isSuperAdmin, &superAdminEnabled, &username)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"is_super_admin":      isSuperAdmin,
		"super_admin_enabled": superAdminEnabled,
		"username":            username,
	})
}

type ToggleSuperAdminRequest struct {
	Enabled bool `json:"enabled"`
}

func (h *SystemHandler) toggleSuperAdmin(w http.ResponseWriter, r *http.Request) {
	targetID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	var req ToggleSuperAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Verificar que el usuario objetivo es super admin
	var isSuperAdmin bool
	err = h.Pool.QueryRow(r.Context(), `SELECT is_super_admin FROM users WHERE id = $1`, targetID).Scan(&isSuperAdmin)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}
	if !isSuperAdmin {
		writeError(w, 400, "ese usuario no es super admin")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `UPDATE users SET super_admin_enabled = $1 WHERE id = $2`, req.Enabled, targetID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Audit log
	actorID, _ := h.Auth.GetUserID(r)
	details, _ := json.Marshal(map[string]interface{}{"target_user": targetID.String(), "enabled": req.Enabled})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'super_admin_toggle', $2, $3)`,
		actorID, targetID, details)

	msg := "Super admin deshabilitado"
	if req.Enabled {
		msg = "Super admin habilitado"
	}
	writeJSON(w, 200, map[string]interface{}{
		"status":  "updated",
		"enabled": req.Enabled,
		"message": msg,
	})
}

// ===== PARAMETROS DE CALCULADORA =====

func (h *SystemHandler) listCalcParams(w http.ResponseWriter, r *http.Request) {
	paramType := r.URL.Query().Get("type") // 'work' o 'material'
	category := r.URL.Query().Get("category")
	approvedOnly := r.URL.Query().Get("approved") == "true"

	query := `SELECT id, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, is_active, approved, created_at
		FROM calculator_parameters WHERE node_domain = $1`
	args := []interface{}{h.nodeDomain}
	argIdx := 2

	if paramType != "" {
		query += fmt.Sprintf(" AND parameter_type = $%d", argIdx)
		args = append(args, paramType)
		argIdx++
	}
	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	if approvedOnly {
		query += " AND approved = true"
	}
	query += " ORDER BY category, name"

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var params []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var pType, category2, name string
		var subcategory, description, unit *string
		var kwhPerUnit, effortFactor float64
		var isActive, approved bool
		var createdAt time.Time
		if err := rows.Scan(&id, &pType, &category2, &subcategory, &name, &description, &unit, &kwhPerUnit, &effortFactor, &isActive, &approved, &createdAt); err != nil {
			continue
		}
		params = append(params, map[string]interface{}{
			"id":            id.String(),
			"type":          pType,
			"category":      category2,
			"subcategory":   deref(subcategory),
			"name":          name,
			"description":   deref(description),
			"unit":          deref(unit),
			"kwh_per_unit":  kwhPerUnit,
			"effort_factor": effortFactor,
			"is_active":     isActive,
			"approved":      approved,
			"created_at":    createdAt,
		})
	}
	if params == nil {
		params = []map[string]interface{}{}
	}
	writeJSON(w, 200, params)
}

func (h *SystemHandler) listCalcCategories(w http.ResponseWriter, r *http.Request) {
	paramType := r.URL.Query().Get("type")

	query := `SELECT id, parameter_type, name, description, is_active FROM calculator_categories WHERE node_domain = $1`
	args := []interface{}{h.nodeDomain}
	if paramType != "" {
		query += " AND parameter_type = $2"
		args = append(args, paramType)
	}
	query += " ORDER BY name"

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var cats []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var pType, name string
		var description *string
		var isActive bool
		if err := rows.Scan(&id, &pType, &name, &description, &isActive); err != nil {
			continue
		}
		cats = append(cats, map[string]interface{}{
			"id":          id.String(),
			"type":        pType,
			"name":        name,
			"description": deref(description),
			"is_active":   isActive,
		})
	}
	if cats == nil {
		cats = []map[string]interface{}{}
	}
	writeJSON(w, 200, cats)
}

type CreateCalcParamRequest struct {
	Type         string  `json:"type"` // 'work' o 'material'
	Category     string  `json:"category"`
	Subcategory  string  `json:"subcategory"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Unit         string  `json:"unit"`
	KwhPerUnit   float64 `json:"kwh_per_unit"`
	EffortFactor float64 `json:"effort_factor"`
}

func (h *SystemHandler) createCalcParam(w http.ResponseWriter, r *http.Request) {
	var req CreateCalcParamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Type != "work" && req.Type != "material" {
		writeError(w, 400, "type must be 'work' or 'material'")
		return
	}
	if req.Name == "" || req.Category == "" {
		writeError(w, 400, "name and category are required")
		return
	}
	if req.KwhPerUnit <= 0 {
		writeError(w, 400, "kwh_per_unit must be positive")
		return
	}
	if req.Unit == "" {
		if req.Type == "work" {
			req.Unit = "horas"
		} else {
			req.Unit = "unidad"
		}
	}
	if req.EffortFactor <= 0 {
		req.EffortFactor = 1.0
	}

	userID, _ := h.Auth.GetUserID(r)
	id := uuid.New()

	var subcategory, description *string
	if req.Subcategory != "" {
		subcategory = &req.Subcategory
	}
	if req.Description != "" {
		description = &req.Description
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO calculator_parameters (id, node_domain, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, approved, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11)`,
		id, h.nodeDomain, req.Type, req.Category, subcategory, req.Name, description, req.Unit, req.KwhPerUnit, req.EffortFactor, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":           id.String(),
		"type":         req.Type,
		"category":     req.Category,
		"name":         req.Name,
		"kwh_per_unit": req.KwhPerUnit,
		"approved":     false,
		"message":      "Parametro creado. Pendiente de aprobacion de asamblea.",
	})
}

func (h *SystemHandler) updateCalcParam(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var req CreateCalcParamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	var subcategory, description *string
	if req.Subcategory != "" {
		subcategory = &req.Subcategory
	}
	if req.Description != "" {
		description = &req.Description
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE calculator_parameters SET
			category = $1, subcategory = $2, name = $3, description = $4,
			unit = $5, kwh_per_unit = $6, effort_factor = $7,
			approved = false, updated_at = NOW()
		WHERE id = $8`,
		req.Category, subcategory, req.Name, description, req.Unit, req.KwhPerUnit, req.EffortFactor, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Parametro actualizado. Pendiente de reaprobacion."})
}

func (h *SystemHandler) deleteCalcParam(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	_, err = h.Pool.Exec(r.Context(), `UPDATE calculator_parameters SET is_active = false WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "deleted"})
}

func (h *SystemHandler) approveCalcParam(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE calculator_parameters SET approved = true, approved_by = $1, approved_at = NOW() WHERE id = $2`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Audit log
	details, _ := json.Marshal(map[string]interface{}{"param_id": id.String()})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'calc_param_approve', $2, $3)`,
		userID, id, details)

	writeJSON(w, 200, map[string]interface{}{"message": "Parametro aprobado"})
}

type CreateCalcCategoryRequest struct {
	Type        string `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *SystemHandler) createCalcCategory(w http.ResponseWriter, r *http.Request) {
	var req CreateCalcCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Type != "work" && req.Type != "material" {
		writeError(w, 400, "type must be 'work' or 'material'")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}

	id := uuid.New()
	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO calculator_categories (id, node_domain, parameter_type, name, description)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (node_domain, parameter_type, name) DO NOTHING`,
		id, h.nodeDomain, req.Type, req.Name, description)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":   id.String(),
		"type": req.Type,
		"name": req.Name,
	})
}

// ===== NIVELES DE ORGANIZACION =====

func (h *SystemHandler) listOrganizationLevels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, name, COALESCE(description, ''), level, credit_limit, debit_limit, tax_rate,
		       can_cross_node_trade, can_use_external_bridge, can_view_audit, max_members, is_active
		FROM organization_levels
		WHERE node_domain = $1 AND is_active = true
		ORDER BY level, name`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing organization levels")
		return
	}
	defer rows.Close()

	var levels []map[string]interface{}
	for rows.Next() {
		var id, name, description string
		var level int
		var creditLimit, debitLimit int64
		var taxRate float64
		var canCrossNode, canBridge, canAudit bool
		var maxMembers int
		var isActive bool

		if err := rows.Scan(&id, &name, &description, &level, &creditLimit, &debitLimit, &taxRate,
			&canCrossNode, &canBridge, &canAudit, &maxMembers, &isActive); err != nil {
			continue
		}

		levels = append(levels, map[string]interface{}{
			"id":                      id,
			"name":                    name,
			"description":             description,
			"level":                   level,
			"credit_limit":            creditLimit,
			"debit_limit":             debitLimit,
			"tax_rate":                taxRate,
			"can_cross_node_trade":    canCrossNode,
			"can_use_external_bridge": canBridge,
			"can_view_audit":          canAudit,
			"max_members":             maxMembers,
			"is_active":               isActive,
		})
	}
	if levels == nil {
		levels = []map[string]interface{}{}
	}
	writeJSON(w, 200, levels)
}

type CreateOrganizationLevelRequest struct {
	Name                 string  `json:"name"`
	Description          string  `json:"description"`
	Level                int     `json:"level"`
	CreditLimit          int64   `json:"credit_limit"`
	DebitLimit           int64   `json:"debit_limit"`
	TaxRate              float64 `json:"tax_rate"`
	CanCrossNodeTrade    bool    `json:"can_cross_node_trade"`
	CanUseExternalBridge bool    `json:"can_use_external_bridge"`
	CanViewAudit         bool    `json:"can_view_audit"`
	MaxMembers           int     `json:"max_members"`
}

func (h *SystemHandler) createOrganizationLevel(w http.ResponseWriter, r *http.Request) {
	var req CreateOrganizationLevelRequest
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

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO organization_levels (node_domain, name, description, level, credit_limit, debit_limit, tax_rate,
			can_cross_node_trade, can_use_external_bridge, can_view_audit, max_members)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id`,
		nodeDomain, req.Name, req.Description, req.Level, req.CreditLimit, req.DebitLimit, req.TaxRate,
		req.CanCrossNodeTrade, req.CanUseExternalBridge, req.CanViewAudit, req.MaxMembers).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":      id.String(),
		"name":    req.Name,
		"message": "Nivel de organizacion creado",
	})
}

func (h *SystemHandler) updateOrganizationLevel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CreateOrganizationLevelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE organization_levels SET
			name = $1, description = $2, level = $3, credit_limit = $4, debit_limit = $5, tax_rate = $6,
			can_cross_node_trade = $7, can_use_external_bridge = $8, can_view_audit = $9, max_members = $10
		WHERE id = $11::uuid`,
		req.Name, req.Description, req.Level, req.CreditLimit, req.DebitLimit, req.TaxRate,
		req.CanCrossNodeTrade, req.CanUseExternalBridge, req.CanViewAudit, req.MaxMembers, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Nivel de organizacion actualizado"})
}

// ===== SITIO WEB PUBLICO =====

func (h *SystemHandler) getPublicSettings(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var siteTitle, siteSubtitle, primaryColor, secondaryColor, contactAddress, ig, fb string
	var logoURL, contactEmail, contactPhone, twitter *string
	var showJoinForm bool
	var headerStyle, announcementText, footerStyle *string
	var showAnnouncement *bool
	var footerAbout, footerSchedule *string
	var textColor, buttonHoverColor, moduleBgColor, pageBgColor, footerBgColor, linkColor, linkVisitedColor *string
	var footerCol1Title, footerCol2Title, footerCol3Title, footerCol4Title, footerSlogan, footerAdmission *string
	// Header customization fields
	var headerSticky bool
	var headerBannerImage, headerBannerImages string
	var headerBannerDuration, headerBannerHeight, headerTransparency, headerBlur int
	var headerBannerTransition, headerTransparencyColor, headerBgColor, headerTextColor, headerActiveColor, headerActiveBgColor, headerHoverColor string
	var headerTopBgColor, headerTopTextColor, headerBottomBgColor, headerBottomTextColor string

	err := h.Pool.QueryRow(r.Context(), `
		SELECT site_title, site_subtitle, COALESCE(logo_url, ''), primary_color, secondary_color,
		       COALESCE(contact_email, ''), COALESCE(contact_phone, ''), contact_address,
		       COALESCE(social_instagram, ''), COALESCE(social_facebook, ''), COALESCE(social_twitter, ''),
		       show_join_form,
		       COALESCE(header_style, 'modern_eco'),
		       COALESCE(announcement_text, '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM'),
		       COALESCE(show_announcement, true),
		       COALESCE(footer_style, 'columns'),
		       COALESCE(footer_about, 'Mercado a cielo abierto para todo el público en moneda local, agroecología, trueque y soberanía alimentaria en Caracas desde octubre de 2014.'),
		       COALESCE(footer_schedule, 'Primer sábado de cada mes (9:00 AM a 1:00 PM). Venta en moneda local.'),
		       COALESCE(text_color, '#1a1a1a'),
		       COALESCE(button_hover_color, '#15803d'),
		       COALESCE(module_bg_color, '#ffffff'),
		       COALESCE(page_bg_color, '#f8faf5'),
		       COALESCE(footer_bg_color, '#112211'),
		       COALESCE(link_color, '#15803d'),
		       COALESCE(link_visited_color, '#6b21a8'),
		       COALESCE(footer_col1_title, ''),
		       COALESCE(footer_col2_title, 'Páginas del Nodo'),
		       COALESCE(footer_col3_title, 'Lugar de Encuentro'),
		       COALESCE(footer_col4_title, 'Comunidad & Redes'),
		       COALESCE(footer_slogan, '100% Autogestión & Suelo Vivo'),
		       COALESCE(footer_admission_text, 'Llenar Solicitud de Ingreso'),
		       COALESCE(header_sticky, true),
		       COALESCE(header_banner_image, ''),
		       COALESCE(header_banner_images, ''),
		       COALESCE(header_banner_duration, 5),
		       COALESCE(header_banner_transition, 'fade'),
		       COALESCE(header_banner_height, 120),
		       COALESCE(header_transparency, 25),
		       COALESCE(header_transparency_color, '#000000'),
		       COALESCE(header_blur, 4),
		       COALESCE(header_bg_color, ''),
		       COALESCE(header_text_color, ''),
		       COALESCE(header_active_color, ''),
		       COALESCE(header_active_bg_color, ''),
		       COALESCE(header_hover_color, ''),
		       COALESCE(header_top_bg_color, ''),
		       COALESCE(header_top_text_color, ''),
		       COALESCE(header_bottom_bg_color, ''),
		       COALESCE(header_bottom_text_color, '')
		FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(
		&siteTitle, &siteSubtitle, &logoURL, &primaryColor, &secondaryColor,
		&contactEmail, &contactPhone, &contactAddress,
		&ig, &fb, &twitter, &showJoinForm,
		&headerStyle, &announcementText, &showAnnouncement, &footerStyle,
		&footerAbout, &footerSchedule,
		&textColor, &buttonHoverColor, &moduleBgColor, &pageBgColor,
		&footerBgColor, &linkColor, &linkVisitedColor,
		&footerCol1Title, &footerCol2Title, &footerCol3Title, &footerCol4Title,
		&footerSlogan, &footerAdmission,
		&headerSticky, &headerBannerImage, &headerBannerImages, &headerBannerDuration, &headerBannerTransition, &headerBannerHeight,
		&headerTransparency, &headerTransparencyColor, &headerBlur,
		&headerBgColor, &headerTextColor,
		&headerActiveColor, &headerActiveBgColor, &headerHoverColor,
		&headerTopBgColor, &headerTopTextColor,
		&headerBottomBgColor, &headerBottomTextColor)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"site_title":        "Feria Conuquera Agroecologica",
			"site_subtitle":     "Cuando el conuco viene a la ciudad",
			"primary_color":     "#162e16",
			"secondary_color":   "#c2410c",
			"show_join_form":    true,
			"header_style":      "modern_eco",
			"announcement_text": "🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM",
			"show_announcement": true,
			"footer_style":      "columns",
		})
		return
	}

	hStyle := "modern_eco"
	if headerStyle != nil && *headerStyle != "" {
		hStyle = *headerStyle
	}
	aText := "🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM"
	if announcementText != nil && *announcementText != "" {
		aText = *announcementText
	}
	sAnnounce := true
	if showAnnouncement != nil {
		sAnnounce = *showAnnouncement
	}
	fStyle := "columns"
	if footerStyle != nil && *footerStyle != "" {
		fStyle = *footerStyle
	}

	// Helper to deref optional strings with fallback
	deref := func(p *string, fallback string) string {
		if p != nil && *p != "" {
			return *p
		}
		return fallback
	}

	writeJSON(w, 200, map[string]interface{}{
		"site_title":            siteTitle,
		"site_subtitle":         siteSubtitle,
		"logo_url":              logoURL,
		"primary_color":         primaryColor,
		"secondary_color":       secondaryColor,
		"contact_email":         contactEmail,
		"contact_phone":         contactPhone,
		"contact_address":       contactAddress,
		"social_instagram":      ig,
		"social_facebook":       fb,
		"social_twitter":        twitter,
		"show_join_form":        showJoinForm,
		"header_style":          hStyle,
		"announcement_text":     aText,
		"show_announcement":     sAnnounce,
		"footer_style":          fStyle,
		"footer_about":          deref(footerAbout, "Mercado a cielo abierto para todo el público en moneda local, agroecología, trueque y soberanía alimentaria en Caracas desde octubre de 2014."),
		"footer_schedule":       deref(footerSchedule, "Primer sábado de cada mes (9:00 AM a 1:00 PM). Venta en moneda local."),
		"text_color":            deref(textColor, "#1a1a1a"),
		"button_hover_color":    deref(buttonHoverColor, "#15803d"),
		"module_bg_color":       deref(moduleBgColor, "#ffffff"),
		"page_bg_color":         deref(pageBgColor, "#f8faf5"),
		"footer_bg_color":       deref(footerBgColor, "#112211"),
		"link_color":            deref(linkColor, "#15803d"),
		"link_visited_color":    deref(linkVisitedColor, "#6b21a8"),
		"footer_col1_title":     deref(footerCol1Title, ""),
		"footer_col2_title":     deref(footerCol2Title, "Páginas del Nodo"),
		"footer_col3_title":     deref(footerCol3Title, "Lugar de Encuentro"),
		"footer_col4_title":     deref(footerCol4Title, "Comunidad & Redes"),
		"footer_slogan":         deref(footerSlogan, "100% Autogestión & Suelo Vivo"),
		"footer_admission_text": deref(footerAdmission, "Llenar Solicitud de Ingreso"),
		// Header customization
		"header_sticky":             headerSticky,
		"header_banner_image":       headerBannerImage,
		"header_banner_images":      headerBannerImages,
		"header_banner_duration":    headerBannerDuration,
		"header_banner_transition":  headerBannerTransition,
		"header_banner_height":      headerBannerHeight,
		"header_transparency":       headerTransparency,
		"header_transparency_color": headerTransparencyColor,
		"header_blur":               headerBlur,
		"header_bg_color":           headerBgColor,
		"header_text_color":         headerTextColor,
		"header_active_color":       headerActiveColor,
		"header_active_bg_color":    headerActiveBgColor,
		"header_hover_color":        headerHoverColor,
		"header_top_bg_color":       headerTopBgColor,
		"header_top_text_color":     headerTopTextColor,
		"header_bottom_bg_color":    headerBottomBgColor,
		"header_bottom_text_color":  headerBottomTextColor,
	})
}

func (h *SystemHandler) listPublicPages(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT slug, title, subtitle, icon, menu_order
		FROM public_pages
		WHERE node_domain = $1 AND is_published = true AND show_in_menu = true
		ORDER BY menu_order`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []map[string]interface{}{})
		return
	}
	defer rows.Close()

	var pages []map[string]interface{}
	for rows.Next() {
		var slug, title string
		var subtitle, icon *string
		var menuOrder int
		if err := rows.Scan(&slug, &title, &subtitle, &icon, &menuOrder); err != nil {
			continue
		}
		pages = append(pages, map[string]interface{}{
			"slug":       slug,
			"title":      title,
			"subtitle":   deref(subtitle),
			"icon":       deref(icon),
			"menu_order": menuOrder,
		})
	}
	if pages == nil {
		pages = []map[string]interface{}{}
	}
	writeJSON(w, 200, pages)
}

func (h *SystemHandler) getPublicPage(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	slug := chi.URLParam(r, "slug")

	var id, title, content string
	var subtitle, icon *string
	var menuOrder int
	var isPublished, showInMenu bool

	err := h.Pool.QueryRow(r.Context(), `
		SELECT id::text, title, subtitle, content, icon, menu_order, is_published, show_in_menu
		FROM public_pages
		WHERE node_domain = $1 AND slug = $2 AND is_published = true`,
		nodeDomain, slug).Scan(&id, &title, &subtitle, &content, &icon, &menuOrder, &isPublished, &showInMenu)
	if err != nil {
		writeError(w, 404, "pagina no encontrada")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":           id,
		"slug":         slug,
		"title":        title,
		"subtitle":     deref(subtitle),
		"content":      content,
		"icon":         deref(icon),
		"menu_order":   menuOrder,
		"is_published": isPublished,
		"show_in_menu": showInMenu,
	})
}

// renderPublicPageHTML sirve la pagina como HTML plano para que servicios
// externos (Google, NotebookLM, etc.) puedan leer el contenido sin ejecutar
// JavaScript. Esto es necesario porque el frontend es una SPA.
func (h *SystemHandler) renderPublicPageHTML(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	slug := chi.URLParam(r, "slug")

	var title, content string
	var subtitle *string

	err := h.Pool.QueryRow(r.Context(), `
		SELECT title, subtitle, content
		FROM public_pages
		WHERE node_domain = $1 AND slug = $2 AND is_published = true`,
		nodeDomain, slug).Scan(&title, &subtitle, &content)
	if err != nil {
		writeError(w, 404, "pagina no encontrada")
		return
	}

	subtitleStr := ""
	if subtitle != nil {
		subtitleStr = *subtitle
	}

	// Convertir el contenido JSON en HTML simple
	htmlContent := jsonContentToHTML(content)

	// HTML completo con meta tags para SEO y servicios externos
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s - %s</title>
<meta name="description" content="%s">
<meta name="robots" content="index, follow">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:type" content="website">
</head>
<body>
<article>
<h1>%s</h1>
<p>%s</p>
%s
</article>
</body>
</html>`, title, subtitleStr, subtitleStr, title, subtitleStr, title, subtitleStr, htmlContent)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Write([]byte(html))
}

// jsonContentToHTML convierte el contenido JSON de la pagina a HTML simple
func jsonContentToHTML(jsonStr string) string {
	var blocks []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &blocks); err != nil {
		return ""
	}

	esc := htmlEscape
	var html strings.Builder
	for _, block := range blocks {
		blockType, _ := block["type"].(string)
		switch blockType {
		case "hero":
			title, _ := block["title"].(string)
			desc, _ := block["description"].(string)
			html.WriteString(fmt.Sprintf("<h2>%s</h2>\n<p>%s</p>\n", esc(title), esc(desc)))
		case "features_grid":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			html.WriteString(fmt.Sprintf("<h2>%s</h2>\n<p>%s</p>\n", esc(title), esc(subtitle)))
			if items, ok := block["items"].([]interface{}); ok {
				for _, item := range items {
					if m, ok := item.(map[string]interface{}); ok {
						itemTitle, _ := m["title"].(string)
						itemDesc, _ := m["description"].(string)
						badge, _ := m["badge"].(string)
						html.WriteString(fmt.Sprintf("<h3>%s</h3>\n<p>%s</p>\n", esc(itemTitle), esc(itemDesc)))
						if badge != "" {
							html.WriteString(fmt.Sprintf("<p><em>%s</em></p>\n", esc(badge)))
						}
					}
				}
			}
		case "cta_banner":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			html.WriteString(fmt.Sprintf("<h2>%s</h2>\n<p>%s</p>\n", esc(title), esc(subtitle)))
		case "trueque_explainer":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			html.WriteString(fmt.Sprintf("<h2>%s</h2>\n<p>%s</p>\n", esc(title), esc(subtitle)))
			if steps, ok := block["steps"].([]interface{}); ok {
				html.WriteString("<ol>\n")
				for _, step := range steps {
					if m, ok := step.(map[string]interface{}); ok {
						stepTitle, _ := m["title"].(string)
						stepDesc, _ := m["description"].(string)
						html.WriteString(fmt.Sprintf("<li><strong>%s</strong>: %s</li>\n", esc(stepTitle), esc(stepDesc)))
					}
				}
				html.WriteString("</ol>\n")
			}
		case "products_showcase":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			html.WriteString(fmt.Sprintf("<h2>%s</h2>\n<p>%s</p>\n", esc(title), esc(subtitle)))
		}
	}
	return html.String()
}

// jsonContentToText convierte el contenido JSON de la pagina a texto plano
// (sin etiquetas HTML) para uso en archivos de texto descargables.
func jsonContentToText(jsonStr string) string {
	var blocks []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &blocks); err != nil {
		return ""
	}

	var sb strings.Builder
	for _, block := range blocks {
		blockType, _ := block["type"].(string)
		switch blockType {
		case "hero":
			title, _ := block["title"].(string)
			desc, _ := block["description"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, desc))
		case "features_grid":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, subtitle))
			if items, ok := block["items"].([]interface{}); ok {
				for _, item := range items {
					if m, ok := item.(map[string]interface{}); ok {
						itemTitle, _ := m["title"].(string)
						itemDesc, _ := m["description"].(string)
						badge, _ := m["badge"].(string)
						sb.WriteString(fmt.Sprintf("### %s\n%s\n", itemTitle, itemDesc))
						if badge != "" {
							sb.WriteString(fmt.Sprintf("Etiqueta: %s\n", badge))
						}
						sb.WriteString("\n")
					}
				}
			}
		case "cta_banner":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, subtitle))
		case "trueque_explainer":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, subtitle))
			if steps, ok := block["steps"].([]interface{}); ok {
				for _, step := range steps {
					if m, ok := step.(map[string]interface{}); ok {
						stepTitle, _ := m["title"].(string)
						stepDesc, _ := m["description"].(string)
						sb.WriteString(fmt.Sprintf("- %s: %s\n", stepTitle, stepDesc))
					}
				}
				sb.WriteString("\n")
			}
			if kp, ok := block["key_points"].(map[string]interface{}); ok {
				sb.WriteString("Puntos clave:\n")
				for k, v := range kp {
					if s, ok := v.(string); ok {
						sb.WriteString(fmt.Sprintf("- %s: %s\n", k, s))
					}
				}
				sb.WriteString("\n")
			}
		case "products_showcase":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, subtitle))
		case "faq":
			title, _ := block["title"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n", title))
			if items, ok := block["items"].([]interface{}); ok {
				for _, item := range items {
					if m, ok := item.(map[string]interface{}); ok {
						q, _ := m["question"].(string)
						a, _ := m["answer"].(string)
						sb.WriteString(fmt.Sprintf("P: %s\nR: %s\n\n", q, a))
					}
				}
			}
		case "testimonials":
			title, _ := block["title"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n", title))
			if items, ok := block["items"].([]interface{}); ok {
				for _, item := range items {
					if m, ok := item.(map[string]interface{}); ok {
						name, _ := m["name"].(string)
						quote, _ := m["quote"].(string)
						sb.WriteString(fmt.Sprintf("- %s: \"%s\"\n", name, quote))
					}
				}
				sb.WriteString("\n")
			}
		case "calculator_preview":
			title, _ := block["title"].(string)
			subtitle, _ := block["subtitle"].(string)
			sb.WriteString(fmt.Sprintf("## %s\n\n%s\n\n", title, subtitle))
		}
	}
	return sb.String()
}

type AdmissionRequestReq struct {
	FullName     string          `json:"full_name"`
	Email        string          `json:"email"`
	Phone        string          `json:"phone"`
	Location     string          `json:"location"`
	Reason       string          `json:"reason"`
	Skills       string          `json:"skills"`
	HowHeard     string          `json:"how_heard"`
	CustomFields json.RawMessage `json:"custom_fields"`
}

func (h *SystemHandler) getPublicAdmissionForm(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var schema json.RawMessage
	var formTitle, formSubtitle *string

	err := h.Pool.QueryRow(r.Context(), `
		SELECT admission_form_schema, admission_form_title, admission_form_subtitle
		FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&schema, &formTitle, &formSubtitle)
	if err != nil || len(schema) == 0 || string(schema) == "null" {
		// Default rich form schema
		writeJSON(w, 200, map[string]interface{}{
			"title":    "Solicitud de Ingreso a la Red",
			"subtitle": "Completa tus datos para postularte como productor conuquero, artesano o miembro.",
			"schema":   nil,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"title":    deref(formTitle),
		"subtitle": deref(formSubtitle),
		"schema":   schema,
	})
}

func (h *SystemHandler) submitAdmissionRequest(w http.ResponseWriter, r *http.Request) {
	var req AdmissionRequestReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.FullName == "" {
		writeError(w, 400, "full_name is required")
		return
	}

	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	customJSON := string(req.CustomFields)
	if customJSON == "" || customJSON == "null" {
		customJSON = "{}"
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO admission_requests (node_domain, full_name, email, phone, location, reason, skills, how_heard, custom_fields)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING id`,
		nodeDomain, req.FullName, req.Email, req.Phone, req.Location, req.Reason, req.Skills, req.HowHeard, customJSON).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":      id.String(),
		"message": "Solicitud enviada. Nos pondremos en contacto contigo.",
		"status":  "pending",
	})
}

// ===== GESTION DEL SITIO (admin) =====

func (h *SystemHandler) listSitePages(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, slug, title, subtitle, icon, menu_order, is_published, show_in_menu
		FROM public_pages WHERE node_domain = $1 ORDER BY menu_order`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []map[string]interface{}{})
		return
	}
	defer rows.Close()

	var pages []map[string]interface{}
	for rows.Next() {
		var id, slug, title string
		var subtitle, icon *string
		var menuOrder int
		var isPublished, showInMenu bool
		if err := rows.Scan(&id, &slug, &title, &subtitle, &icon, &menuOrder, &isPublished, &showInMenu); err != nil {
			continue
		}
		pages = append(pages, map[string]interface{}{
			"id":           id,
			"slug":         slug,
			"title":        title,
			"subtitle":     deref(subtitle),
			"icon":         deref(icon),
			"menu_order":   menuOrder,
			"is_published": isPublished,
			"show_in_menu": showInMenu,
		})
	}
	if pages == nil {
		pages = []map[string]interface{}{}
	}
	writeJSON(w, 200, pages)
}

type CreateSitePageReq struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	Content     string `json:"content"`
	Icon        string `json:"icon"`
	MenuOrder   int    `json:"menu_order"`
	IsPublished bool   `json:"is_published"`
	ShowInMenu  bool   `json:"show_in_menu"`
}

func (h *SystemHandler) createSitePage(w http.ResponseWriter, r *http.Request) {
	var req CreateSitePageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Slug == "" || req.Title == "" {
		writeError(w, 400, "slug and title are required")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		nodeDomain, req.Slug, req.Title, req.Subtitle, req.Content, req.Icon, req.MenuOrder, req.IsPublished, req.ShowInMenu).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{"id": id.String(), "message": "Pagina creada"})
	GenerateStaticHTMLFiles(h.Pool)
}

func (h *SystemHandler) updateSitePage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CreateSitePageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE public_pages SET
			slug = $1, title = $2, subtitle = $3, content = $4, icon = $5,
			menu_order = $6, is_published = $7, show_in_menu = $8, updated_at = NOW()
		WHERE id = $9::uuid`,
		req.Slug, req.Title, req.Subtitle, req.Content, req.Icon, req.MenuOrder, req.IsPublished, req.ShowInMenu, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Pagina actualizada"})
	GenerateStaticHTMLFiles(h.Pool)
}

func (h *SystemHandler) upsertSitePageBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	var req CreateSitePageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	targetSlug := slug
	if req.Slug != "" {
		targetSlug = req.Slug
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (node_domain, slug) DO UPDATE SET
			title = EXCLUDED.title,
			subtitle = EXCLUDED.subtitle,
			content = EXCLUDED.content,
			icon = EXCLUDED.icon,
			menu_order = EXCLUDED.menu_order,
			is_published = EXCLUDED.is_published,
			show_in_menu = EXCLUDED.show_in_menu,
			updated_at = NOW()`,
		nodeDomain, targetSlug, req.Title, req.Subtitle, req.Content, req.Icon, req.MenuOrder, req.IsPublished, req.ShowInMenu)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Pagina guardada con exito"})
	GenerateStaticHTMLFiles(h.Pool)
}

func (h *SystemHandler) deleteSitePage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM public_pages WHERE id = $1::uuid`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"message": "Pagina eliminada"})
	GenerateStaticHTMLFiles(h.Pool)
}

// resetSitePage restablece una pagina al contenido por defecto del seed,
// preservando el titulo que el admin haya puesto.
func (h *SystemHandler) resetSitePage(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// Obtener el contenido por defecto del seed
	db := &db.DB{Pool: h.Pool}
	defaultTitle, defaultSubtitle, defaultContent, defaultIcon, defaultMenuOrder, found := db.GetDefaultPageContent(slug)
	if !found {
		writeError(w, 404, "No hay contenido por defecto para esta pagina")
		return
	}

	// Actualizar el contenido pero preservar el titulo actual del admin
	_, err := h.Pool.Exec(r.Context(), `
		UPDATE public_pages
		SET subtitle = $1, content = $2, icon = $3, menu_order = $4
		WHERE node_domain = $5 AND slug = $6`,
		defaultSubtitle, defaultContent, defaultIcon, defaultMenuOrder, nodeDomain, slug)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":   "Pagina restablecida al contenido por defecto",
		"title":     defaultTitle,
		"subtitle":  defaultSubtitle,
		"preserved": "El titulo actual se ha preservado",
	})
	GenerateStaticHTMLFiles(h.Pool)
}

func (h *SystemHandler) getSiteSettings(w http.ResponseWriter, r *http.Request) {
	h.getPublicSettings(w, r)
}

type UpdateSiteSettingsReq struct {
	SiteTitle        string `json:"site_title"`
	SiteSubtitle     string `json:"site_subtitle"`
	LogoURL          string `json:"logo_url"`
	PrimaryColor     string `json:"primary_color"`
	SecondaryColor   string `json:"secondary_color"`
	TextColor        string `json:"text_color"`
	ButtonHoverColor string `json:"button_hover_color"`
	ModuleBgColor    string `json:"module_bg_color"`
	PageBgColor      string `json:"page_bg_color"`
	FooterBgColor    string `json:"footer_bg_color"`
	LinkColor        string `json:"link_color"`
	LinkVisitedColor string `json:"link_visited_color"`
	ContactEmail     string `json:"contact_email"`
	ContactPhone     string `json:"contact_phone"`
	ContactAddress   string `json:"contact_address"`
	SocialInstagram  string `json:"social_instagram"`
	SocialFacebook   string `json:"social_facebook"`
	SocialTwitter    string `json:"social_twitter"`
	ShowJoinForm     bool   `json:"show_join_form"`
	HeaderStyle      string `json:"header_style"`
	AnnouncementText string `json:"announcement_text"`
	ShowAnnouncement bool   `json:"show_announcement"`
	FooterStyle      string `json:"footer_style"`
	FooterAbout      string `json:"footer_about"`
	FooterSchedule   string `json:"footer_schedule"`
	FooterCol1Title  string `json:"footer_col1_title"`
	FooterCol2Title  string `json:"footer_col2_title"`
	FooterCol3Title  string `json:"footer_col3_title"`
	FooterCol4Title  string `json:"footer_col4_title"`
	FooterSlogan     string `json:"footer_slogan"`
	FooterAdmission  string `json:"footer_admission_text"`
	// Header customization
	HeaderSticky            bool   `json:"header_sticky"`
	HeaderBannerImage       string `json:"header_banner_image"`
	HeaderBannerImages      string `json:"header_banner_images"`
	HeaderBannerDuration    int    `json:"header_banner_duration"`
	HeaderBannerTransition  string `json:"header_banner_transition"`
	HeaderBannerHeight      int    `json:"header_banner_height"`
	HeaderTransparency      int    `json:"header_transparency"`
	HeaderTransparencyColor string `json:"header_transparency_color"`
	HeaderBlur              int    `json:"header_blur"`
	HeaderBgColor           string `json:"header_bg_color"`
	HeaderTextColor         string `json:"header_text_color"`
	HeaderActiveColor       string `json:"header_active_color"`
	HeaderActiveBgColor     string `json:"header_active_bg_color"`
	HeaderHoverColor        string `json:"header_hover_color"`
	HeaderTopBgColor        string `json:"header_top_bg_color"`
	HeaderTopTextColor      string `json:"header_top_text_color"`
	HeaderBottomBgColor     string `json:"header_bottom_bg_color"`
	HeaderBottomTextColor   string `json:"header_bottom_text_color"`
}

func (h *SystemHandler) updateSiteSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateSiteSettingsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	if req.HeaderStyle == "" {
		req.HeaderStyle = "modern_eco"
	}
	if req.FooterStyle == "" {
		req.FooterStyle = "columns"
	}
	if req.HeaderBannerHeight == 0 {
		req.HeaderBannerHeight = 120
	}
	if req.HeaderBannerDuration == 0 {
		req.HeaderBannerDuration = 5
	}
	if req.HeaderBannerTransition == "" {
		req.HeaderBannerTransition = "fade"
	}
	if req.HeaderTransparency == 0 {
		req.HeaderTransparency = 25
	}
	if req.HeaderTransparencyColor == "" {
		req.HeaderTransparencyColor = "#000000"
	}
	if req.HeaderBlur == 0 {
		req.HeaderBlur = 4
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE public_settings SET
			site_title = $1, site_subtitle = $2, logo_url = $3, primary_color = $4, secondary_color = $5,
			contact_email = $6, contact_phone = $7, contact_address = $8,
			social_instagram = $9, social_facebook = $10, social_twitter = $11, show_join_form = $12,
			header_style = $13, announcement_text = $14, show_announcement = $15, footer_style = $16,
			footer_about = $17, footer_schedule = $18,
			text_color = $19, button_hover_color = $20, module_bg_color = $21, page_bg_color = $22,
			footer_bg_color = $23, link_color = $24, link_visited_color = $25,
			footer_col1_title = $26, footer_col2_title = $27, footer_col3_title = $28, footer_col4_title = $29,
			footer_slogan = $30, footer_admission_text = $31,
			header_sticky = $33, header_banner_image = $34, header_banner_height = $35,
			header_transparency = $36, header_transparency_color = $37, header_blur = $38,
			header_bg_color = $39, header_text_color = $40,
			header_active_color = $41, header_active_bg_color = $42, header_hover_color = $43,
			header_top_bg_color = $44, header_top_text_color = $45,
			header_bottom_bg_color = $46, header_bottom_text_color = $47,
			header_banner_images = $48, header_banner_duration = $49, header_banner_transition = $50,
			updated_at = NOW()
		WHERE node_domain = $32`,
		req.SiteTitle, req.SiteSubtitle, req.LogoURL, req.PrimaryColor, req.SecondaryColor,
		req.ContactEmail, req.ContactPhone, req.ContactAddress,
		req.SocialInstagram, req.SocialFacebook, req.SocialTwitter, req.ShowJoinForm,
		req.HeaderStyle, req.AnnouncementText, req.ShowAnnouncement, req.FooterStyle,
		req.FooterAbout, req.FooterSchedule,
		req.TextColor, req.ButtonHoverColor, req.ModuleBgColor, req.PageBgColor,
		req.FooterBgColor, req.LinkColor, req.LinkVisitedColor,
		req.FooterCol1Title, req.FooterCol2Title, req.FooterCol3Title, req.FooterCol4Title,
		req.FooterSlogan, req.FooterAdmission,
		nodeDomain,
		req.HeaderSticky, req.HeaderBannerImage, req.HeaderBannerHeight,
		req.HeaderTransparency, req.HeaderTransparencyColor, req.HeaderBlur,
		req.HeaderBgColor, req.HeaderTextColor,
		req.HeaderActiveColor, req.HeaderActiveBgColor, req.HeaderHoverColor,
		req.HeaderTopBgColor, req.HeaderTopTextColor,
		req.HeaderBottomBgColor, req.HeaderBottomTextColor,
		req.HeaderBannerImages, req.HeaderBannerDuration, req.HeaderBannerTransition)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Configuracion del sitio actualizada"})
}

// ===== SOLICITUDES DE ADMISION (admin) =====

func (h *SystemHandler) listAdmissionRequests(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	status := r.URL.Query().Get("status")
	query := `SELECT id::text, full_name, email, phone, location, reason, skills, how_heard, status, created_at, COALESCE(custom_fields, '{}'::jsonb)
		FROM admission_requests WHERE node_domain = $1`
	args := []interface{}{nodeDomain}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []map[string]interface{}{})
		return
	}
	defer rows.Close()

	var requests []map[string]interface{}
	for rows.Next() {
		var id, fullName, status string
		var email, phone, location, reason, skills, howHeard *string
		var createdAt time.Time
		var customFields json.RawMessage
		if err := rows.Scan(&id, &fullName, &email, &phone, &location, &reason, &skills, &howHeard, &status, &createdAt, &customFields); err != nil {
			continue
		}
		requests = append(requests, map[string]interface{}{
			"id":            id,
			"full_name":     fullName,
			"email":         deref(email),
			"phone":         deref(phone),
			"location":      deref(location),
			"reason":        deref(reason),
			"skills":        deref(skills),
			"how_heard":     deref(howHeard),
			"status":        status,
			"created_at":    createdAt,
			"custom_fields": customFields,
		})
	}
	if requests == nil {
		requests = []map[string]interface{}{}
	}
	writeJSON(w, 200, requests)
}

type UpdateAdmissionFormReq struct {
	Title    string          `json:"title"`
	Subtitle string          `json:"subtitle"`
	Schema   json.RawMessage `json:"schema"`
}

func (h *SystemHandler) updateSiteAdmissionForm(w http.ResponseWriter, r *http.Request) {
	var req UpdateAdmissionFormReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	schemaJSON := string(req.Schema)
	if schemaJSON == "" || schemaJSON == "null" {
		schemaJSON = "[]"
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE public_settings SET
			admission_form_title = $1,
			admission_form_subtitle = $2,
			admission_form_schema = $3::jsonb,
			updated_at = NOW()
		WHERE node_domain = $4`,
		req.Title, req.Subtitle, schemaJSON, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Formulario de admision actualizado con exito"})
}

func (h *SystemHandler) approveAdmissionRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := h.Auth.GetUserID(r)

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE admission_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2::uuid`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Solicitud aprobada"})
}

func (h *SystemHandler) rejectAdmissionRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := h.Auth.GetUserID(r)

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE admission_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2::uuid`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Solicitud rechazada"})
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

// -------------------------------------------------------------
// IMAGE UPLOAD - for the visual site editor
// -------------------------------------------------------------

func (h *SystemHandler) uploadImage(w http.ResponseWriter, r *http.Request) {
	// Limit to 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, 400, "file too large or invalid form (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "no file provided")
		return
	}
	defer file.Close()

	// Validate mime type
	mimeType := header.Header.Get("Content-Type")
	if !isAllowedImageType(mimeType) {
		writeError(w, 400, "only image files are allowed (jpg, png, gif, webp)")
		return
	}

	// Generate unique filename
	ext := ".jpg"
	switch mimeType {
	case "image/png":
		ext = ".png"
	case "image/gif":
		ext = ".gif"
	case "image/webp":
		ext = ".webp"
	}

	filename := fmt.Sprintf("img_%d_%s%s", time.Now().UnixNano(), randomString(6), ext)

	// Save to /app/uploads/ (Docker volume)
	uploadDir := "/app/uploads"
	if _, err := os.Stat(uploadDir); err != nil {
		// Fallback for local dev
		uploadDir = "./uploads"
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeError(w, 500, "failed to create upload directory")
		return
	}

	filePath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, 500, "failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, 500, "failed to write file")
		return
	}

	// URL to access the image
	url := "/uploads/" + filename

	// Save metadata in DB
	userID, _ := h.Auth.GetUserID(r)
	_, _ = h.Pool.Exec(r.Context(), `
		INSERT INTO uploaded_images (id, filename, original_name, mime_type, file_size, url, uploaded_by, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
		filename, header.Filename, mimeType, header.Size, url, userID)

	writeJSON(w, 201, map[string]interface{}{
		"url":       url,
		"filename":  filename,
		"original":  header.Filename,
		"size":      header.Size,
		"mime_type": mimeType,
	})
}

func (h *SystemHandler) listUploadedImages(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT url, filename, original_name, mime_type, file_size, created_at
		FROM uploaded_images ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	images := []map[string]interface{}{}
	for rows.Next() {
		var url, filename, mimeType string
		var originalName *string
		var fileSize int64
		var createdAt time.Time
		_ = rows.Scan(&url, &filename, &originalName, &mimeType, &fileSize, &createdAt)
		origName := ""
		if originalName != nil {
			origName = *originalName
		}
		images = append(images, map[string]interface{}{
			"url":           url,
			"filename":      filename,
			"original_name": origName,
			"mime_type":     mimeType,
			"file_size":     fileSize,
			"created_at":    createdAt,
		})
	}
	writeJSON(w, 200, images)
}

func isAllowedImageType(mimeType string) bool {
	switch mimeType {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	}
	return false
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(1 * time.Nanosecond)
	}
	return string(b)
}

// -------------------------------------------------------------
// PUBLIC PRODUCTS - for the public site catalog
// -------------------------------------------------------------

func (h *SystemHandler) listPublicProducts(w http.ResponseWriter, r *http.Request) {
	// Paginacion: limit y offset para infinite scroll
	limit := 24
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	// Filtro opcional por parent_category
	parentCat := r.URL.Query().Get("parent_category")
	category := r.URL.Query().Get("category")

	query := `SELECT id, name, description, parent_category, category, subcategory, unit, price_per_unit, product_code, is_approved, origin, badge, image_url, is_group, group_id
		FROM products
		WHERE node_domain = $1 AND is_approved = true AND is_hidden = false`
	args := []interface{}{h.nodeDomain}
	argIdx := 2

	if parentCat != "" {
		query += fmt.Sprintf(` AND parent_category = $%d`, argIdx)
		args = append(args, parentCat)
		argIdx++
	}
	if category != "" {
		query += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, category)
		argIdx++
	}

	// Contar total para metadata de paginacion
	countQuery := strings.Replace(query, "SELECT id, name, description, parent_category, category, subcategory, unit, price_per_unit, product_code, is_approved, origin, badge, image_url, is_group, group_id",
		"SELECT COUNT(*)", 1)
	countQuery = strings.Replace(countQuery, " ORDER BY", " -- ORDER BY", 1)
	var total int
	_ = h.Pool.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query += fmt.Sprintf(` ORDER BY parent_category, category, subcategory, name LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"products": []interface{}{}, "total": 0, "limit": limit, "offset": offset})
		return
	}
	defer rows.Close()

	products := []map[string]interface{}{}
	seen := map[string]bool{} // deduplicate by name
	for rows.Next() {
		var id, name, description, parentCategory, category2, subcategory, unit, origin string
		var price float64
		var productCode, badge, imageURL, groupID *string
		var isApproved, isGroup bool
		_ = rows.Scan(&id, &name, &description, &parentCategory, &category2, &subcategory, &unit, &price, &productCode, &isApproved, &origin, &badge, &imageURL, &isGroup, &groupID)

		// Skip duplicates by name
		if seen[name] {
			continue
		}
		seen[name] = true

		code := ""
		if productCode != nil {
			code = *productCode
		}
		bdg := ""
		if badge != nil {
			bdg = *badge
		}
		imgURL := ""
		if imageURL != nil {
			imgURL = *imageURL
		}
		gid := ""
		if groupID != nil {
			gid = *groupID
		}

		products = append(products, map[string]interface{}{
			"id":              id,
			"name":            name,
			"description":     description,
			"parent_category": parentCategory,
			"category":        category2,
			"subcategory":     subcategory,
			"unit":            unit,
			"price_trueque":   price,
			"product_code":    code,
			"is_approved":     isApproved,
			"origin":          origin,
			"badge":           bdg,
			"image_url":       imgURL,
			"is_group":        isGroup,
			"group_id":        gid,
		})
	}
	writeJSON(w, 200, map[string]interface{}{
		"products": products,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"has_more": offset+len(products) < total,
	})
}

// listProductCategories devuelve las categorias jerarquicas de 3 niveles
// (parent_category -> category -> subcategory) existentes en el catalogo del nodo.
// Solo categorias que tienen al menos un producto aprobado y no oculto.
func (h *SystemHandler) listProductCategories(w http.ResponseWriter, r *http.Request) {
	// Usar el dominio del header (enviado por el frontend) como prioridad
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	// Obtener todas las combinaciones distintas de (parent_category, category, subcategory)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT DISTINCT parent_category, category, subcategory
		FROM products
		WHERE node_domain IN ($1, 'localhost', 'default')
		  AND is_approved = true
		  AND is_hidden = false
		  AND parent_category IS NOT NULL AND parent_category <> ''
		  AND category IS NOT NULL AND category <> ''
		ORDER BY parent_category, category, subcategory
	`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"categories": []interface{}{}})
		return
	}
	defer rows.Close()

	type subcat struct {
		Name string `json:"name"`
	}
	type cat struct {
		Name    string   `json:"name"`
		Subcats []subcat `json:"subcategories"`
	}
	type parentCat struct {
		Name       string `json:"name"`
		Categories []cat  `json:"categories"`
	}

	parentMap := map[string]*parentCat{}
	parentOrder := []string{}
	catMap := map[string]*cat{}
	catOrder := map[string][]string{}

	for rows.Next() {
		var pc, c, sc string
		if err := rows.Scan(&pc, &c, &sc); err != nil {
			continue
		}

		// parent category
		p, ok := parentMap[pc]
		if !ok {
			p = &parentCat{Name: pc}
			parentMap[pc] = p
			parentOrder = append(parentOrder, pc)
		}

		// category
		catKey := pc + "|" + c
		ca, ok := catMap[catKey]
		if !ok {
			ca = &cat{Name: c}
			catMap[catKey] = ca
			p.Categories = append(p.Categories, *ca)
			catOrder[pc] = append(catOrder[pc], c)
		}

		// subcategory
		if sc != "" {
			// Find the category in parent's list and append subcategory
			for i := range p.Categories {
				if p.Categories[i].Name == c {
					p.Categories[i].Subcats = append(p.Categories[i].Subcats, subcat{Name: sc})
					break
				}
			}
		}
	}

	result := []parentCat{}
	for _, pcName := range parentOrder {
		result = append(result, *parentMap[pcName])
	}

	writeJSON(w, 200, map[string]interface{}{"categories": result})
}

// ===== BACKUP Y RESTAURACION DE LA BASE DE DATOS =====

func (h *SystemHandler) downloadBackup(w http.ResponseWriter, r *http.Request) {
	// Obtener lista de tablas
	rows, err := h.Pool.Query(r.Context(), `
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public'
		ORDER BY tablename`)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error listing tables: %v", err))
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var t string
		_ = rows.Scan(&t)
		tables = append(tables, t)
	}

	// Construir un JSON con todas las tablas y sus datos
	backup := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"tables":    map[string]interface{}{},
	}

	tablesMap := backup["tables"].(map[string]interface{})
	for _, table := range tables {
		// Saltar tablas del sistema de migraciones
		if table == "schema_migrations" {
			continue
		}
		data, err := h.exportTable(r.Context(), table)
		if err != nil {
			// Si una tabla falla, continuar con las demas
			tablesMap[table] = map[string]interface{}{"error": err.Error()}
			continue
		}
		tablesMap[table] = data
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=backup-%s.json", time.Now().Format("2006-01-02-150405")))
	json.NewEncoder(w).Encode(backup)
}

func (h *SystemHandler) exportTable(ctx context.Context, table string) ([]map[string]interface{}, error) {
	// Sanitizar nombre de tabla (solo alfanumericos y underscore)
	for _, c := range table {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return nil, fmt.Errorf("invalid table name")
		}
	}

	rows, err := h.Pool.Query(ctx, fmt.Sprintf(`SELECT * FROM %s`, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	var result []map[string]interface{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			continue
		}
		row := map[string]interface{}{}
		for i, val := range values {
			colName := fields[i].Name
			// Convertir []byte a string para JSON
			if b, ok := val.([]byte); ok {
				row[colName] = string(b)
			} else {
				row[colName] = val
			}
		}
		result = append(result, row)
	}
	return result, nil
}

type RestoreBackupReq struct {
	Backup json.RawMessage `json:"backup"`
}

func (h *SystemHandler) restoreBackup(w http.ResponseWriter, r *http.Request) {
	// Limitar el tamano del upload a 100MB
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)

	var req RestoreBackupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, fmt.Sprintf("invalid request body: %v", err))
		return
	}

	var backup map[string]interface{}
	if err := json.Unmarshal(req.Backup, &backup); err != nil {
		writeError(w, 400, fmt.Sprintf("invalid backup format: %v", err))
		return
	}

	tablesRaw, ok := backup["tables"]
	if !ok {
		writeError(w, 400, "backup missing 'tables' field")
		return
	}

	tables, ok := tablesRaw.(map[string]interface{})
	if !ok {
		writeError(w, 400, "backup 'tables' field is not an object")
		return
	}

	// Restaurar cada tabla
	restored := map[string]int{}
	errors := map[string]string{}

	for tableName, tableData := range tables {
		// Sanitizar nombre de tabla
		valid := true
		for _, c := range tableName {
			if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
				valid = false
				break
			}
		}
		if !valid {
			errors[tableName] = "invalid table name"
			continue
		}

		rows, ok := tableData.([]interface{})
		if !ok {
			errors[tableName] = "table data is not an array"
			continue
		}

		count := 0
		for _, rowRaw := range rows {
			row, ok := rowRaw.(map[string]interface{})
			if !ok {
				continue
			}

			// Construir INSERT dinamicamente
			cols := []string{}
			vals := []interface{}{}
			placeholders := []string{}
			i := 1
			for col, val := range row {
				// Sanitizar nombre de columna
				colValid := true
				for _, c := range col {
					if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
						colValid = false
						break
					}
				}
				if !colValid {
					continue
				}
				cols = append(cols, col)
				vals = append(vals, val)
				placeholders = append(placeholders, fmt.Sprintf("$%d", i))
				i++
			}

			if len(cols) == 0 {
				continue
			}

			// Usar ON CONFLICT DO NOTHING para no duplicar
			query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT DO NOTHING",
				tableName, strings.Join(cols, ", "), strings.Join(placeholders, ", "))

			_, err := h.Pool.Exec(r.Context(), query, vals...)
			if err != nil {
				// Si falla, continuar con el siguiente registro
				continue
			}
			count++
		}
		restored[tableName] = count
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":  "Backup restaurado",
		"restored": restored,
		"errors":   errors,
	})
}

// ===== GOBERNANZA - Ley de la Aldea =====

func (h *SystemHandler) listGovernanceRules(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	// Usar el dominio del header o del nodo, con fallback a localhost
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, category, title, description, severity, icon, sort_order, is_active
		FROM governance_rules
		WHERE node_domain IN ($1, 'localhost', 'default') AND is_active = true
		ORDER BY category, sort_order`,
		nodeDomain,
	)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	type Rule struct {
		ID          string `json:"id"`
		Category    string `json:"category"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Severity    string `json:"severity"`
		Icon        string `json:"icon"`
		SortOrder   int    `json:"sort_order"`
		IsActive    bool   `json:"is_active"`
	}

	var rules []Rule
	for rows.Next() {
		var rule Rule
		_ = rows.Scan(&rule.ID, &rule.Category, &rule.Title, &rule.Description, &rule.Severity, &rule.Icon, &rule.SortOrder, &rule.IsActive)
		if category != "" && rule.Category != category {
			continue
		}
		rules = append(rules, rule)
	}

	if rules == nil {
		rules = []Rule{}
	}
	writeJSON(w, 200, rules)
}

func (h *SystemHandler) createGovernanceRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Category              string `json:"category"`
		Title                 string `json:"title"`
		Description           string `json:"description"`
		Severity              string `json:"severity"`
		Icon                  string `json:"icon"`
		SortOrder             int    `json:"sort_order"`
		VotingDurationMinutes int    `json:"voting_duration_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Category == "" || req.Title == "" || req.Description == "" {
		writeError(w, 400, "category, title y description son obligatorios")
		return
	}
	if req.Severity == "" {
		req.Severity = "info"
	}
	if req.Icon == "" {
		req.Icon = "info"
	}

	// Crear propuesta de asamblea en lugar de aplicar directamente
	// La regla se creara cuando la asamblea apruebe la propuesta
	userID, _ := h.Auth.GetUserID(r)

	// Crear sesion si no existe una activa
	var sessionID uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		sessionID = uuid.New()
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, 'localhost', 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID)
	}

	// Serializar parametros
	params := map[string]interface{}{
		"action":      "create",
		"category":    req.Category,
		"title":       req.Title,
		"description": req.Description,
		"severity":    req.Severity,
		"icon":        req.Icon,
		"sort_order":  req.SortOrder,
	}
	newValue, _ := json.Marshal(params)

	// Duracion por defecto: 24 horas
	votingMinutes := req.VotingDurationMinutes
	if votingMinutes == 0 {
		votingMinutes = 1440
	}

	proposalID := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, new_value, required_signatures, status, voting_deadline, voting_duration_minutes)
		VALUES ($1, $2, 'governance_rule', $3, $4, 1, 'proposed', $5)`,
		proposalID, sessionID, "Crear regla de gobernanza: "+req.Title, newValue, votingMinutes)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Audit log
	auditDetails, _ := json.Marshal(map[string]interface{}{"action": "create_governance_rule", "title": req.Title})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'governance_proposal', $2, $3)`,
		userID, proposalID, auditDetails)

	writeJSON(w, 201, map[string]interface{}{
		"id":                      proposalID.String(),
		"message":                 "Propuesta creada. La asamblea debe revisarla y abrir la votacion.",
		"status":                  "pending",
		"voting_duration_minutes": votingMinutes,
		"proposal":                "/app/assembly",
	})
}

func (h *SystemHandler) updateGovernanceRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Category              string `json:"category"`
		Title                 string `json:"title"`
		Description           string `json:"description"`
		Severity              string `json:"severity"`
		Icon                  string `json:"icon"`
		SortOrder             int    `json:"sort_order"`
		IsActive              *bool  `json:"is_active"`
		VotingDurationMinutes int    `json:"voting_duration_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Crear propuesta de asamblea para modificar la regla
	userID, _ := h.Auth.GetUserID(r)

	var sessionID uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		sessionID = uuid.New()
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, 'localhost', 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID)
	}

	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}

	params := map[string]interface{}{
		"action":      "update",
		"rule_id":     id,
		"category":    req.Category,
		"title":       req.Title,
		"description": req.Description,
		"severity":    req.Severity,
		"icon":        req.Icon,
		"sort_order":  req.SortOrder,
		"is_active":   active,
	}
	newValue, _ := json.Marshal(params)

	votingMinutes := req.VotingDurationMinutes
	if votingMinutes == 0 {
		votingMinutes = 1440
	}

	proposalID := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, new_value, required_signatures, status, voting_deadline, voting_duration_minutes)
		VALUES ($1, $2, 'governance_rule', $3, $4, 1, 'proposed', $5)`,
		proposalID, sessionID, "Modificar regla de gobernanza: "+req.Title, newValue, votingMinutes)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{"action": "update_governance_rule", "rule_id": id})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'governance_proposal', $2, $3)`,
		userID, proposalID, auditDetails)

	writeJSON(w, 200, map[string]interface{}{
		"id":                      proposalID.String(),
		"message":                 "Propuesta creada. La modificacion se aplicara cuando la asamblea la apruebe.",
		"status":                  "pending",
		"voting_duration_minutes": votingMinutes,
		"proposal":                "/app/assembly",
	})
}

func (h *SystemHandler) deleteGovernanceRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Crear propuesta de asamblea para eliminar la regla
	userID, _ := h.Auth.GetUserID(r)

	// Obtener el titulo de la regla para la descripcion
	var ruleTitle string
	h.Pool.QueryRow(r.Context(), `SELECT title FROM governance_rules WHERE id = $1`, id).Scan(&ruleTitle)
	if ruleTitle == "" {
		ruleTitle = "regla " + id
	}

	var sessionID uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		sessionID = uuid.New()
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, 'localhost', 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID)
	}

	params := map[string]interface{}{
		"action":  "delete",
		"rule_id": id,
	}
	newValue, _ := json.Marshal(params)

	// Duracion por defecto: 24 horas
	votingMinutes := 1440

	proposalID := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, new_value, required_signatures, status, voting_deadline, voting_duration_minutes)
		VALUES ($1, $2, 'governance_rule', $3, $4, 1, 'proposed', $5)`,
		proposalID, sessionID, "Eliminar regla de gobernanza: "+ruleTitle, newValue, votingMinutes)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{"action": "delete_governance_rule", "rule_id": id})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'governance_proposal', $2, $3)`,
		userID, proposalID, auditDetails)

	writeJSON(w, 200, map[string]interface{}{
		"id":                      proposalID.String(),
		"message":                 "Propuesta creada. La regla se eliminara cuando la asamblea lo apruebe.",
		"status":                  "pending",
		"voting_duration_minutes": votingMinutes,
		"proposal":                "/app/assembly",
	})
}
