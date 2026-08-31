package api

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/db"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
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
	// Favicon dinamico: sirve el logo del nodo como favicon
	r.Get("/api/favicon", h.getFavicon)
	r.Get("/api/public/pages", h.listPublicPages)
	r.Get("/api/public/pages/{slug}", h.getPublicPage)
	r.Get("/api/public/page/{slug}/html", h.renderPublicPageHTML)
	r.Get("/api/public/admission-form", h.getPublicAdmissionForm)
	r.Post("/api/public/admission-request", h.submitAdmissionRequest)
	r.Get("/api/public/products", h.listPublicProducts)

	// ===== ENDPOINTS PRIVADOS (requieren auth) =====

	// Status de admision (para usuarios preliminares)
	r.With(am.RequireAuth).Get("/api/my/admission-status", h.getMyAdmissionStatus)
	r.With(am.RequireAuth).Post("/api/my/admission-defense", h.submitAdmissionDefense)

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
	r.With(am.RequirePermission("admission.manage")).Post("/api/admission-requests/{id}/elevate", h.elevateAdmissionRequest)
	r.With(am.RequirePermission("admission.manage")).Post("/api/admission-requests/{id}/reject", h.rejectAdmissionRequest)
	r.With(am.RequirePermission("admission.manage")).Post("/api/admission-requests/{id}/review-defense", h.reviewAdmissionDefense)

	// Auditoria
	r.With(am.RequireAuth).Get("/api/audit", h.listAudit)

	// Configuracion del nodo (moneda, nombre, etc)
	// GET es publico (solo devuelve nombre, moneda, app_name - no hay datos sensibles)
	// PUT requiere permiso
	r.Get("/api/config", h.getConfig)
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
	r.With(am.RequireAuth).Get("/api/products/pending", h.listPendingProducts)
	r.With(am.RequireAuth).Get("/api/products/composite", h.listCompositeProducts)
	r.With(am.RequireAuth).Get("/api/products/federated", h.listFederatedProducts)
	r.With(am.RequireAuth).Get("/api/products/federated/nodes", h.listFederatedProductNodes)
	r.With(am.RequireAuth).Get("/api/products/categories", h.listProductCategories)
	r.With(am.RequireAuth).Get("/api/products/{id}", h.getProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products", h.createProduct)
	r.With(am.RequirePermission("products.manage")).Put("/api/products/{id}", h.updateProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/approve", h.approveProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/disapprove", h.disapproveProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/reject", h.rejectProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/promote", h.promoteCompositeToBase)

	// Allowlist de productos (permitir / no permitir)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/allow", h.allowProduct)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/disallow", h.disallowProduct)
	r.With(am.RequireAuth).Get("/api/products/allowed", h.listAllowedProducts)
	r.With(am.RequireAuth).Get("/api/products/disallowed", h.listDisallowedProducts)

	// Productores
	r.With(am.RequireAuth).Get("/api/products/{id}/producers", h.listProducers)
	r.With(am.RequirePermission("products.manage")).Post("/api/products/{id}/producers", h.addProducer)
	r.With(am.RequirePermission("products.manage")).Delete("/api/products/producers/{pid}", h.removeProducer)

	// Historial de precios
	r.With(am.RequireAuth).Get("/api/products/{id}/price-history", h.getPriceHistory)

	// Fondo comunitario
	r.With(am.RequireAuth).Get("/api/fund/balance", h.getFundBalance)

	// Ledger / historial de transacciones
	r.With(am.RequireAuth).Get("/api/ledger/transactions", h.listLedgerTransactions)

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

	// Buscar usuarios y organizaciones (para asignar terminales, tarjetas, etc.)
	r.With(am.RequireAuth).Get("/api/search/users", h.searchUsers)
	r.With(am.RequireAuth).Get("/api/search/organizations", h.searchOrganizations)
}

// ===== AUDITORIA =====

func (h *SystemHandler) listAudit(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	actorID := r.URL.Query().Get("actor_id")
	fromDate := r.URL.Query().Get("from")
	toDate := r.URL.Query().Get("to")
	limit := 100

	query := `SELECT a.id, a.actor_id, COALESCE(u.username, ''), COALESCE(u.display_name, ''), a.action, a.target_id, a.details, a.ip_address, a.user_agent, a.created_at
		FROM audit_log a
		LEFT JOIN users u ON a.actor_id = u.id
		WHERE 1=1`
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
		var actorUsername string
		var actorDisplayName string
		var action string
		var targetID *uuid.UUID
		var details []byte
		var ipAddress *string
		var userAgent *string
		var createdAt time.Time
		if err := rows.Scan(&id, &actorID, &actorUsername, &actorDisplayName, &action, &targetID, &details, &ipAddress, &userAgent, &createdAt); err != nil {
			continue
		}

		var detailObj interface{}
		if details != nil {
			json.Unmarshal(details, &detailObj)
		}

		entries = append(entries, map[string]interface{}{
			"id":                 id,
			"actor_id":           derefUUID(actorID),
			"actor_username":     actorUsername,
			"actor_display_name": actorDisplayName,
			"action":             action,
			"target_id":          derefUUID(targetID),
			"details":            detailObj,
			"ip_address":         deref(ipAddress),
			"user_agent":         deref(userAgent),
			"created_at":         createdAt,
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
	// node_config guarda el dominio real, no __LOCAL__
	// Usar ActualNodeDomain para leer la configuracion
	actualDomain := db.ActualNodeDomain(r.Context(), h.Pool, h.nodeDomain)

	var nodeName, currencyName, appName, currencyFullName string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT node_name, currency_name, app_name, COALESCE(currency_full_name, 'Trueque')
		FROM node_config WHERE node_domain = $1`,
		actualDomain).Scan(&nodeName, &currencyName, &appName, &currencyFullName)
	if err != nil {
		// Defaults
		writeJSON(w, 200, map[string]interface{}{
			"node_name":          actualDomain,
			"currency_name":      "TQ",
			"currency_full_name": "Trueque",
			"app_name":           "Red de Intercambio",
			"node_domain":        actualDomain,
			"format_settings":    nodeFormatSettings(r.Context(), h.Pool, actualDomain),
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":          nodeName,
		"currency_name":      currencyName,
		"currency_full_name": currencyFullName,
		"app_name":           appName,
		"node_domain":        actualDomain,
		"format_settings":    nodeFormatSettings(r.Context(), h.Pool, actualDomain),
	})
}

type UpdateNodeConfigRequest struct {
	NodeName         string                  `json:"node_name"`
	CurrencyName     string                  `json:"currency_name"`
	CurrencyFullName string                  `json:"currency_full_name"`
	AppName          string                  `json:"app_name"`
	NodeDomain       string                  `json:"node_domain"`
	FormatSettings   *map[string]interface{} `json:"format_settings,omitempty"`
}

func (h *SystemHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateNodeConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// node_config guarda el dominio real, no __LOCAL__
	// Usar ActualNodeDomain para encontrar la fila correcta
	actualDomain := db.ActualNodeDomain(r.Context(), h.Pool, h.nodeDomain)

	// En nodo demo, bloquear cambio de dominio (se hereda del padre)
	// pero permitir cambios de nombre, moneda, etc.
	isDemo := os.Getenv("DEMO_MODE") == "true"
	if isDemo && req.NodeDomain != "" && req.NodeDomain != actualDomain {
		writeError(w, 403, "El dominio no se puede cambiar en el nodo demo. Se hereda del nodo padre.")
		return
	}

	// Si se solicita cambiar el dominio, validar y actualizar
	if !isDemo && req.NodeDomain != "" && req.NodeDomain != actualDomain {
		// Validar que el nuevo dominio no este vacio ni sea localhost
		if req.NodeDomain == "localhost" || req.NodeDomain == "__LOCAL__" {
			writeError(w, 400, "El dominio no puede ser 'localhost' ni '__LOCAL__'")
			return
		}
		// Actualizar el dominio en node_config
		_, err := h.Pool.Exec(r.Context(), `
			UPDATE node_config SET node_name = $1, currency_name = $2, app_name = $3, currency_full_name = $4, node_domain = $5 WHERE node_domain = $6`,
			req.NodeName, req.CurrencyName, req.AppName, req.CurrencyFullName, req.NodeDomain, actualDomain)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
	} else {
		// Solo actualizar nombre, moneda y app (sin cambiar dominio)
		_, err := h.Pool.Exec(r.Context(), `
			UPDATE node_config SET node_name = $1, currency_name = $2, app_name = $3, currency_full_name = $4 WHERE node_domain = $5`,
			req.NodeName, req.CurrencyName, req.AppName, req.CurrencyFullName, actualDomain)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
	}

	// Si se envian format_settings, mergearlos en node_config.settings JSONB
	// usando el operador || (jsonb concat) sobre la clave "format_settings".
	if req.FormatSettings != nil {
		fsBytes, err := json.Marshal(*req.FormatSettings)
		if err != nil {
			writeError(w, 400, "format_settings invalido")
			return
		}
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE node_config
			SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('format_settings', $2::jsonb),
			    updated_at = NOW()
			WHERE node_domain = $1`,
			actualDomain, string(fsBytes))
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_name":          req.NodeName,
		"currency_name":      req.CurrencyName,
		"currency_full_name": req.CurrencyFullName,
		"app_name":           req.AppName,
		"format_settings":    nodeFormatSettings(r.Context(), h.Pool, actualDomain),
		"message":            "Configuracion actualizada",
	})
}

// ===== NIVELES DE MIEMBRO =====

func (h *SystemHandler) listMemberLevels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
		// Defaults basados en migracion 038: 1 TQ = 1 kWh
		// Canasta vital: 8 kWh/dia para mantener viva a una persona
		writeJSON(w, 200, map[string]interface{}{
			"vital_food":          3,
			"vital_water":         1,
			"vital_domestic":      2,
			"vital_services":      2,
			"effort_admin":        1.0,
			"effort_technical":    3.0,
			"effort_agricultural": 0.61,
			"work_hours_per_day":  8,
			"work_days_per_month": 22,
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	search := r.URL.Query().Get("search")
	// Mostrar productos del nodo local (aprobados y no aprobados) para que el admin
	// pueda ver permitidos y no permitidos. is_allowed distingue permitido/no-permitido.
	query := `
		SELECT id, name, COALESCE(description,''), COALESCE(parent_category,''),
		       COALESCE(category,''), COALESCE(subcategory,''), unit, price_per_unit,
		       COALESCE(price_per_kg,0), COALESCE(weight_kg,0), COALESCE(base_unit,'kg'),
		       is_approved, origin, badge, image_url, product_code, is_system, is_hidden,
		       COALESCE(image_thumb_url,''), COALESCE(is_allowed, NULL)
		FROM products WHERE node_domain IN ($1, 'localhost', 'default') AND is_hidden = false AND COALESCE(is_composite, false) = false`
	args := []interface{}{nodeDomain}
	if search != "" {
		query += ` AND LOWER(name) LIKE LOWER($2)`
		args = append(args, "%"+search+"%")
	}
	query += ` ORDER BY COALESCE(parent_category,''), COALESCE(category,''), COALESCE(subcategory,''), name LIMIT 500`
	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	products := scanProductRows(rows)
	if products == nil {
		products = []map[string]interface{}{}
	}
	writeJSON(w, 200, products)
}

func (h *SystemHandler) listPendingProducts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, parent_category, category, subcategory, unit, price_per_unit, is_approved, origin, badge, image_url, product_code, is_system, is_hidden
		FROM products WHERE node_domain = $1 AND is_approved = false AND is_hidden = false AND COALESCE(is_composite, false) = false ORDER BY created_at DESC LIMIT 200`, nodeDomain)
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

// listCompositeProducts devuelve los productos compuestos del nodo actual.
// Los productos compuestos son creados por la gente del nodo combinando
// productos base. Se pueden vender en la tienda y se pueden promover
// a producto base para que aparezcan en toda la federacion.
func (h *SystemHandler) listCompositeProducts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	search := r.URL.Query().Get("search")
	query := `
		SELECT id, name, COALESCE(description,''), COALESCE(parent_category,''),
		       COALESCE(category,''), COALESCE(subcategory,''), unit, price_per_unit,
		       COALESCE(price_per_kg,0), COALESCE(weight_kg,0), COALESCE(base_unit,'kg'),
		       is_approved, origin, badge, image_url, product_code, is_system, is_hidden,
		       COALESCE(image_thumb_url,''), COALESCE(is_allowed, NULL)
		FROM products WHERE node_domain = $1 AND COALESCE(is_composite, false) = true`
	args := []interface{}{nodeDomain}
	if search != "" {
		query += ` AND LOWER(name) LIKE LOWER($2)`
		args = append(args, "%"+search+"%")
	}
	query += ` ORDER BY name LIMIT 500`
	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	products := scanProductRows(rows)
	if products == nil {
		products = []map[string]interface{}{}
	}
	writeJSON(w, 200, products)
}

// listFederatedProducts devuelve productos de todos los nodos federados.
// Incluye productos de todos los node_domain conocidos, no solo el nodo actual.
// Muestra TODOS los productos (aprobados y no aprobados) para que cada nodo
// pueda aprobar/desaprobar individualmente. No muestra ocultos ni compuestos.
func (h *SystemHandler) listFederatedProducts(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	orgFilter := r.URL.Query().Get("organization")
	query := `
		SELECT id, name, COALESCE(description,''), COALESCE(parent_category,''), COALESCE(category,''),
		       COALESCE(subcategory,''), unit, price_per_unit,
		       COALESCE(price_per_kg,0), COALESCE(weight_kg,0), COALESCE(base_unit,'kg'),
		       is_approved, origin, badge, image_url, product_code, is_system, is_hidden,
		       node_domain, COALESCE(source_node, ''), COALESCE(image_thumb_url,''), COALESCE(is_allowed, NULL)
		FROM products`
	var args []interface{}
	argIdx := 1
	whereParts := []string{"is_hidden = false", "COALESCE(is_composite, false) = false"}
	if search != "" {
		whereParts = append(whereParts, fmt.Sprintf("LOWER(name) LIKE LOWER($%d)", argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if orgFilter != "" {
		whereParts = append(whereParts, fmt.Sprintf("node_domain = $%d", argIdx))
		args = append(args, orgFilter)
		argIdx++
	}
	query += " WHERE " + strings.Join(whereParts, " AND ")
	query += ` ORDER BY is_approved DESC, node_domain, COALESCE(parent_category,''), COALESCE(category,''), name LIMIT 1000`
	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	var products []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, description, parentCategory, category, subcategory, unit, origin, baseUnit, nodeDomain, sourceNode, thumbURL string
		var price, pricePerKg, weightKg float64
		var isApproved, isSystem, isHidden bool
		var badge, imageURL, productCode *string
		var isAllowed *bool
		if err := rows.Scan(&id, &name, &description, &parentCategory, &category, &subcategory, &unit, &price, &pricePerKg, &weightKg, &baseUnit, &isApproved, &origin, &badge, &imageURL, &productCode, &isSystem, &isHidden, &nodeDomain, &sourceNode, &thumbURL, &isAllowed); err != nil {
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
		suggestedPrice := 0.0
		calcExplanation := ""
		if pricePerKg > 0 && weightKg > 0 {
			suggestedPrice = pricePerKg * weightKg
			switch baseUnit {
			case "L":
				calcExplanation = fmt.Sprintf("%.2f TQ/L x %.3f L = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			case "unidad":
				calcExplanation = fmt.Sprintf("%.2f TQ/unidad x %.0f unidades = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			default:
				calcExplanation = fmt.Sprintf("%.2f TQ/kg x %.3f kg = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			}
		}
		products = append(products, map[string]interface{}{
			"id":                id.String(),
			"name":              name,
			"description":       description,
			"parent_category":   parentCategory,
			"category":          category,
			"subcategory":       subcategory,
			"unit":              unit,
			"price":             price,
			"base_price":        pricePerKg,
			"base_unit":         baseUnit,
			"weight_kg":         weightKg,
			"suggested_price":   suggestedPrice,
			"price_calculation": calcExplanation,
			"is_approved":       isApproved,
			"origin":            origin,
			"badge":             bdg,
			"image_url":         imgURL,
			"image_thumb_url":   thumbURL,
			"product_code":      pcode,
			"is_system":         isSystem,
			"is_hidden":         isHidden,
			"node_domain":       nodeDomain,
			"source_node":       sourceNode,
			"available_locally": nodeDomain == db.LOCAL_NODE_DOMAIN,
			"is_allowed":        isAllowed,
		})
	}
	if products == nil {
		products = []map[string]interface{}{}
	}
	writeJSON(w, 200, products)
}

// listFederatedProductNodes devuelve los nodos/organizaciones que tienen productos
// para que el frontend pueda mostrar un filtro por organizacion.
func (h *SystemHandler) listFederatedProductNodes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT node_domain, COUNT(*) as product_count
		FROM products
		WHERE is_hidden = false AND COALESCE(is_composite, false) = false
		GROUP BY node_domain
		ORDER BY node_domain`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	nodes := []map[string]interface{}{}
	for rows.Next() {
		var nodeDomain string
		var count int
		if err := rows.Scan(&nodeDomain, &count); err != nil {
			continue
		}
		nodes = append(nodes, map[string]interface{}{
			"node_domain":   nodeDomain,
			"product_count": count,
		})
	}
	writeJSON(w, 200, nodes)
}

// promoteCompositeToBase promueve un producto compuesto a producto base.
// Esto hace que el producto:
// 1. is_composite = false (ya no es compuesto, es base)
// 2. is_system = true (aparece en toda la federacion)
// 3. Se puede usar como ingrediente para otros compuestos
func (h *SystemHandler) promoteCompositeToBase(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	_, err = h.Pool.Exec(r.Context(),
		`UPDATE products SET is_composite = false, is_system = true, is_approved = true WHERE id = $1`,
		id)
	if err != nil {
		writeError(w, 500, "error al promover producto")
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"message": "Producto promovido a producto base. Ahora aparece en toda la federacion y puede usarse como ingrediente.",
	})
}

// scanProductRows es helper para escanear filas de productos
func scanProductRows(rows pgx.Rows) []map[string]interface{} {
	var products []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, description, parentCategory, category, subcategory, unit, origin, baseUnit string
		var price, pricePerKg, weightKg float64
		var isApproved, isSystem, isHidden bool
		var badge, imageURL, productCode *string
		var thumbURL string
		var isAllowed *bool
		if err := rows.Scan(&id, &name, &description, &parentCategory, &category, &subcategory, &unit, &price, &pricePerKg, &weightKg, &baseUnit, &isApproved, &origin, &badge, &imageURL, &productCode, &isSystem, &isHidden, &thumbURL, &isAllowed); err != nil {
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
		suggestedPrice := 0.0
		calcExplanation := ""
		if pricePerKg > 0 && weightKg > 0 {
			suggestedPrice = pricePerKg * weightKg
			switch baseUnit {
			case "L":
				calcExplanation = fmt.Sprintf("%.2f TQ/L x %.3f L = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			case "unidad":
				calcExplanation = fmt.Sprintf("%.2f TQ/unidad x %.0f unidades = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			default:
				calcExplanation = fmt.Sprintf("%.2f TQ/kg x %.3f kg = %.2f TQ", pricePerKg, weightKg, suggestedPrice)
			}
		}
		products = append(products, map[string]interface{}{
			"id":                id.String(),
			"name":              name,
			"description":       description,
			"parent_category":   parentCategory,
			"category":          category,
			"subcategory":       subcategory,
			"unit":              unit,
			"price":             price,
			"base_price":        pricePerKg,
			"base_unit":         baseUnit,
			"weight_kg":         weightKg,
			"suggested_price":   suggestedPrice,
			"price_calculation": calcExplanation,
			"is_approved":       isApproved,
			"origin":            origin,
			"badge":             bdg,
			"image_url":         imgURL,
			"image_thumb_url":   thumbURL,
			"product_code":      pcode,
			"is_system":         isSystem,
			"is_hidden":         isHidden,
			"is_allowed":        isAllowed,
		})
	}
	return products
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

func (h *SystemHandler) rejectProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	_, err = h.Pool.Exec(r.Context(), `UPDATE products SET is_approved = false, is_hidden = true, approved_by = $1 WHERE id = $2`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message": "Producto rechazado y ocultado del catalogo.",
	})
}

// disapproveProduct marca un producto como no aprobado (is_approved = false)
// pero NO lo oculta (is_hidden = false). El producto sigue visible en la
// pestaña Federacion para poder re-aprobarlo despues.
// Esto es diferente de rejectProduct que ademas oculta el producto.
func (h *SystemHandler) disapproveProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	_, err = h.Pool.Exec(r.Context(), `UPDATE products SET is_approved = false, approved_by = $1 WHERE id = $2`,
		userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message": "Producto desaprobado. Sigue visible en la Federacion pero no esta aprobado.",
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
		err = h.Pool.QueryRow(r.Context(), `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, req.ProducerID).Scan(&producerID)
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

// ===== FONDO COMUNITARIO (Asamblea General) =====

func (h *SystemHandler) getFundBalance(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// El Fondo Comunitario ES la cuenta de la Asamblea General
	var fundID uuid.UUID
	var balance int64
	var username, displayName string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id, balance, username, COALESCE(display_name, username)
		FROM users WHERE node_domain = $1 AND username = 'asamblea'
		LIMIT 1`,
		nodeDomain).Scan(&fundID, &balance, &username, &displayName)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"fund_account": nil,
			"balance":      0,
			"message":      "No hay cuenta de Asamblea General. El Fondo Comunitario es la cuenta de la Asamblea.",
		})
		return
	}

	// Tambien obtener transacciones del fondo
	var txCount int
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM transactions WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'completed'`, fundID).Scan(&txCount)

	writeJSON(w, 200, map[string]interface{}{
		"fund_account":      fundID.String(),
		"username":          username,
		"display_name":      displayName,
		"balance":           balance,
		"transaction_count": txCount,
		"aliases":           []string{"asamblea", "impuestos", "fondo_comunitario"},
	})
}

// ===== LEDGER / HISTORIAL DE TRANSACCIONES =====

func (h *SystemHandler) listLedgerTransactions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	if nodeDomain == "" {
		// Intentar obtener del context (JWT)
		if node, ok := r.Context().Value("node").(string); ok && node != "" {
			nodeDomain = node
		}
	}
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	userID := r.Header.Get("X-User-ID")
	// Si no hay header, intentar obtener del context (JWT)
	if userID == "" {
		if uid, ok := r.Context().Value("user_id").(uuid.UUID); ok {
			userID = uid.String()
		}
	}
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 500 {
			limit = v
		}
	}

	// Soportar filtro por cuenta especifica
	accountID := r.URL.Query().Get("account_id")

	query := `SELECT t.id, t.tx_type, t.sender_id, t.receiver_id, t.amount, t.tax_amount,
			  t.status, t.created_at, t.confirmed_at,
			  COALESCE(sender.username, '') as sender_name,
			  COALESCE(sender.display_name, '') as sender_display,
			  COALESCE(receiver.username, '') as receiver_name,
			  COALESCE(receiver.display_name, '') as receiver_display,
			  t.metadata
			  FROM transactions t
			  LEFT JOIN users sender ON t.sender_id = sender.id
			  LEFT JOIN users receiver ON t.receiver_id = receiver.id
			  WHERE (sender.node_domain = $1 OR receiver.node_domain = $1)
			  AND t.tx_type != 'federation_transfer'`
	args := []interface{}{nodeDomain}
	argIdx := 2
	if userID != "" {
		query += fmt.Sprintf(` AND (t.sender_id = $%d OR t.receiver_id = $%d)`, argIdx, argIdx)
		args = append(args, userID)
		argIdx++
	}
	if accountID != "" {
		query += fmt.Sprintf(` AND (t.sender_id = $%d OR t.receiver_id = $%d)`, argIdx, argIdx)
		args = append(args, accountID)
		argIdx++
	}
	query += ` ORDER BY t.created_at DESC LIMIT ` + strconv.Itoa(limit)

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	txs := []map[string]interface{}{}
	for rows.Next() {
		var id, txType, senderID, receiverID, status, senderName, senderDisplay, receiverName, receiverDisplay string
		var amount, taxAmount float64
		var confirmedAt *time.Time
		var createdAt time.Time
		var metadata []byte
		_ = rows.Scan(&id, &txType, &senderID, &receiverID, &amount, &taxAmount, &status, &createdAt, &confirmedAt, &senderName, &senderDisplay, &receiverName, &receiverDisplay, &metadata)

		// Determinar direccion desde la perspectiva del usuario
		direction := "neutral"
		if userID != "" {
			if senderID == userID {
				direction = "debit"
			} else if receiverID == userID {
				direction = "credit"
			}
		}

		// Extraer descripcion del metadata
		description := ""
		if len(metadata) > 0 {
			var meta map[string]interface{}
			if json.Unmarshal(metadata, &meta) == nil {
				if d, ok := meta["description"].(string); ok {
					description = d
				}
			}
		}

		txs = append(txs, map[string]interface{}{
			"id":               id,
			"tx_type":          txType,
			"sender_id":        senderID,
			"receiver_id":      receiverID,
			"sender_name":      senderName,
			"sender_display":   senderDisplay,
			"receiver_name":    receiverName,
			"receiver_display": receiverDisplay,
			"from_user":        senderDisplay,
			"to_user":          receiverDisplay,
			"amount":           amount,
			"tax_amount":       taxAmount,
			"status":           status,
			"direction":        direction,
			"description":      description,
			"created_at":       createdAt,
			"confirmed_at":     confirmedAt,
		})
	}
	writeJSON(w, 200, txs)
}

// ===== AUTO-ASCENSO DE NIVEL =====

func (h *SystemHandler) autoUpgradeLevel(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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

	query := `SELECT id, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, is_active, approved, created_at, COALESCE(tariff_category,'')
		FROM calculator_parameters WHERE node_domain = $1`
	args := []interface{}{db.LOCAL_NODE_DOMAIN}
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
		var tariffCategory string
		if err := rows.Scan(&id, &pType, &category2, &subcategory, &name, &description, &unit, &kwhPerUnit, &effortFactor, &isActive, &approved, &createdAt, &tariffCategory); err != nil {
			continue
		}
		params = append(params, map[string]interface{}{
			"id":              id.String(),
			"type":            pType,
			"category":        category2,
			"subcategory":     deref(subcategory),
			"name":            name,
			"description":     deref(description),
			"unit":            deref(unit),
			"kwh_per_unit":    kwhPerUnit,
			"effort_factor":   effortFactor,
			"tariff_category": tariffCategory,
			"is_active":       isActive,
			"approved":        approved,
			"created_at":      createdAt,
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
	args := []interface{}{db.LOCAL_NODE_DOMAIN}
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
	Type           string  `json:"type"` // 'work' o 'material'
	Category       string  `json:"category"`
	Subcategory    string  `json:"subcategory"`
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	Unit           string  `json:"unit"`
	KwhPerUnit     float64 `json:"kwh_per_unit"`
	EffortFactor   float64 `json:"effort_factor"`
	TariffCategory string  `json:"tariff_category"` // 'agricultural', 'technical', 'admin' o ''
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
	var tariffCategory *string
	if req.TariffCategory != "" {
		tariffCategory = &req.TariffCategory
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO calculator_parameters (id, node_domain, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, tariff_category, approved, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12)`,
		id, db.LOCAL_NODE_DOMAIN, req.Type, req.Category, subcategory, req.Name, description, req.Unit, req.KwhPerUnit, req.EffortFactor, tariffCategory, userID)
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
	var tariffCategory *string
	if req.TariffCategory != "" {
		tariffCategory = &req.TariffCategory
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE calculator_parameters SET
			category = $1, subcategory = $2, name = $3, description = $4,
			unit = $5, kwh_per_unit = $6, effort_factor = $7, tariff_category = $8,
			approved = false, updated_at = NOW()
		WHERE id = $9`,
		req.Category, subcategory, req.Name, description, req.Unit, req.KwhPerUnit, req.EffortFactor, tariffCategory, id)
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
		id, db.LOCAL_NODE_DOMAIN, req.Type, req.Name, description)
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
		       COALESCE(announcement_text, ''),
		       COALESCE(show_announcement, false),
		       COALESCE(footer_style, 'columns'),
		       COALESCE(footer_about, ''),
		       COALESCE(footer_schedule, ''),
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
		       COALESCE(footer_slogan, ''),
		       COALESCE(footer_admission_text, 'Solicitar Ingreso'),
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

// getFavicon sirve el logo del nodo como favicon dinamico.
// Si el nodo tiene un logo_url configurado en public_settings, redirige a esa URL.
// Si no tiene logo, sirve el icon.svg por defecto del frontend.
// Esto hace que el favicon cambie automaticamente cuando se cambia el logo.
func (h *SystemHandler) getFavicon(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var logoURL string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(logo_url, '') FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&logoURL)

	if err == nil && logoURL != "" {
		// El nodo tiene logo configurado - redirigir a la URL del logo
		// Cache por 1 hora para no consultar la BD en cada request del navegador
		w.Header().Set("Cache-Control", "public, max-age=3600")
		http.Redirect(w, r, logoURL, http.StatusFound)
		return
	}

	// No hay logo configurado - servir el icon.svg por defecto
	// Buscar en el directorio del frontend
	frontendDir := "/app/frontend"
	if _, err := os.Stat(frontendDir + "/icon.svg"); err != nil {
		frontendDir = "/app/dist"
	}
	iconPath := frontendDir + "/icon.svg"
	if _, err := os.Stat(iconPath); err != nil {
		// Ultimo recurso: icono SVG inline
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>`))
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	http.ServeFile(w, r, iconPath)
}

func (h *SystemHandler) listPublicPages(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	if nodeDomain == "" {
		nodeDomain = h.nodeDomain
	}
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
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
		// Paginas virtuales: federacion y gobernanza no estan en la BD
		// pero el frontend las renderiza con componentes especiales.
		// Devolver una pagina vacia para que el frontend no de error 404.
		if slug == "federacion" || slug == "gobernanza" {
			writeJSON(w, 200, map[string]interface{}{
				"id":           "",
				"slug":         slug,
				"title":        "Federacion",
				"subtitle":     "",
				"content":      "[]",
				"icon":         "globe",
				"menu_order":   95,
				"is_published": true,
				"show_in_menu": true,
				"is_virtual":   true,
			})
			return
		}
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
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
	FullName         string          `json:"full_name"`
	Email            string          `json:"email"`
	Phone            string          `json:"phone"`
	Location         string          `json:"location"`
	Reason           string          `json:"reason"`
	Skills           string          `json:"skills"`
	HowHeard         string          `json:"how_heard"`
	CustomFields     json.RawMessage `json:"custom_fields"`
	ProposedUsername string          `json:"proposed_username"`
	ProposedPassword string          `json:"proposed_password"`
}

func (h *SystemHandler) getPublicAdmissionForm(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.URL.Query().Get("node")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	if req.ProposedUsername == "" {
		writeError(w, 400, "proposed_username is required")
		return
	}
	if req.ProposedPassword == "" || len(req.ProposedPassword) < 6 {
		writeError(w, 400, "proposed_password is required and must be at least 6 characters")
		return
	}

	// Validar username: solo letras, numeros, guiones, sin espacios
	username := strings.ToLower(strings.TrimSpace(req.ProposedUsername))
	for _, c := range username {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_') {
			writeError(w, 400, "username solo puede contener letras, numeros, guiones y guiones bajos")
			return
		}
	}

	nodeDomain := r.URL.Query().Get("node")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Verificar que el username no exista ya
	var existingID *uuid.UUID
	_ = h.Pool.QueryRow(r.Context(), `
		SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
		username, nodeDomain).Scan(&existingID)
	if existingID != nil {
		writeError(w, 409, "El nombre de usuario ya existe. Elige otro.")
		return
	}

	// Verificar si ya existe una solicitud pendiente del mismo username
	var existingReqID *string
	h.Pool.QueryRow(r.Context(), `
		SELECT id::text FROM admission_requests
		WHERE proposed_username = $1 AND node_domain = $2
		AND status IN ('pending_review', 'elevated_to_assembly', 'defense_pending')
		LIMIT 1`,
		username, nodeDomain).Scan(&existingReqID)
	if existingReqID != nil {
		writeError(w, 409, "Ya tienes una solicitud de admisión pendiente. Espera la respuesta de la asamblea.")
		return
	}

	// Hashear password con bcrypt
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.ProposedPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, 500, "error hashing password")
		return
	}

	// Crear usuario preliminar
	userID := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, balance, credit_limit, debit_limit, is_approved)
		VALUES ($1, $2, $3, $4, 'individual', 'pending_admission', 0, 0, 0, false)`,
		userID, nodeDomain, username, req.FullName)
	if err != nil {
		writeError(w, 500, "error creating preliminary user: "+err.Error())
		return
	}

	// Crear credenciales (password hash)
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)`,
		userID, string(passwordHash))
	if err != nil {
		// Rollback: borrar usuario preliminar
		h.Pool.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, userID)
		writeError(w, 500, "error creating user credentials: "+err.Error())
		return
	}

	customJSON := string(req.CustomFields)
	if customJSON == "" || customJSON == "null" {
		customJSON = "{}"
	}

	// Sanitizar custom_fields: eliminar cualquier clave que contenga "password",
	// "contrasena" o "clave" para evitar que se guarden contraseñas en texto plano
	// en la BD donde el admin podria verlas.
	customJSON = sanitizeCustomFields(customJSON)

	// Crear admission_request con created_user_id y proposed_password
	var id uuid.UUID
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO admission_requests (node_domain, full_name, email, phone, location, reason, skills, how_heard, custom_fields, proposed_username, proposed_password, created_user_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, 'pending_review') RETURNING id`,
		nodeDomain, req.FullName, req.Email, req.Phone, req.Location, req.Reason, req.Skills, req.HowHeard, customJSON,
		username, string(passwordHash), userID).Scan(&id)
	if err != nil {
		// Rollback: borrar usuario y credenciales
		h.Pool.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, userID)
		writeError(w, 500, "error creating admission request: "+err.Error())
		return
	}

	// Notificar a los administradores (usuarios con permiso admission.manage)
	// que hay una nueva solicitud de admisión pendiente.
	notify := NewNotifyService(h.Pool)
	resolvedDomain := db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	// Buscar usuarios con permiso admission.manage
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT u.id FROM users u
		JOIN user_permissions up ON up.user_id = u.id
		JOIN permissions p ON p.id = up.permission_id
		WHERE p.name = 'admission.manage'
		AND (up.expires_at IS NULL OR up.expires_at > NOW())
		AND u.membership_status = 'active'`)
	var adminIDs []uuid.UUID
	if rows != nil {
		for rows.Next() {
			var uid uuid.UUID
			if err := rows.Scan(&uid); err == nil {
				adminIDs = append(adminIDs, uid)
			}
		}
		rows.Close()
	}
	// Tambien incluir super_admins
	superRows, _ := h.Pool.Query(r.Context(), `
		SELECT id FROM users WHERE is_super_admin = true AND super_admin_enabled = true AND membership_status = 'active'`)
	if superRows != nil {
		for superRows.Next() {
			var uid uuid.UUID
			if err := superRows.Scan(&uid); err == nil {
				adminIDs = append(adminIDs, uid)
			}
		}
		superRows.Close()
	}
	if len(adminIDs) > 0 {
		notify.NotifyMany(r.Context(), resolvedDomain, adminIDs, "admission_request",
			"Nueva solicitud de admisión",
			fmt.Sprintf("Nueva solicitud de %s (%s). Revisa y evalúa antes de elevar a asamblea.", req.FullName, username),
			"/app/website?tab=admission", map[string]interface{}{
				"request_id": id.String(),
				"full_name":  req.FullName,
				"username":   username,
			})
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":       id.String(),
		"message":  "Solicitud enviada. Puedes iniciar sesion con tu usuario y contrasena para ver el estado de tu solicitud.",
		"status":   "pending_review",
		"username": username,
	})
}

// sanitizeCustomFields elimina del JSON de custom_fields cualquier clave
// que contenga "password", "contrasena" o "clave" (case-insensitive).
// Esto previene que las contraseñas propuestas se guarden en texto plano
// en la BD donde podrian ser vistas por administradores.
func sanitizeCustomFields(jsonStr string) string {
	var fields map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &fields); err != nil {
		return jsonStr // si no es JSON valido, devolver tal cual
	}
	for key := range fields {
		lowerKey := strings.ToLower(key)
		if strings.Contains(lowerKey, "password") ||
			strings.Contains(lowerKey, "contrasena") ||
			strings.Contains(lowerKey, "contraseña") ||
			strings.Contains(lowerKey, "clave") {
			delete(fields, key)
		}
	}
	sanitized, err := json.Marshal(fields)
	if err != nil {
		return jsonStr
	}
	return string(sanitized)
}

// ===== STATUS DE ADMISION (para usuarios preliminares) =====

func (h *SystemHandler) getMyAdmissionStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var id, status string
	var fullName, rejectionReason, defenseText, defenseStatus *string
	var submittedAt, reviewedAt, elevatedAt, rejectionExpiresAt, defenseSubmittedAt *time.Time

	err = h.Pool.QueryRow(r.Context(), `
		SELECT id::text, status, full_name, rejection_reason, defense_text, defense_status,
		       submitted_at, reviewed_at, elevated_at, rejection_expires_at, defense_submitted_at
		FROM admission_requests WHERE created_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID).Scan(&id, &status, &fullName, &rejectionReason, &defenseText, &defenseStatus,
		&submittedAt, &reviewedAt, &elevatedAt, &rejectionExpiresAt, &defenseSubmittedAt)
	if err != nil {
		writeError(w, 404, "no admission request found for this user")
		return
	}

	// Si esta elevado a asamblea, buscar la proxima asamblea
	var nextAssemblyDate *string
	if status == "elevated_to_assembly" {
		var nextDate *time.Time
		_ = h.Pool.QueryRow(r.Context(), `
			SELECT start_time FROM assembly_sessions
			WHERE status IN ('scheduled', 'active') AND start_time >= NOW()
			ORDER BY start_time ASC LIMIT 1`).Scan(&nextDate)
		if nextDate != nil {
			s := nextDate.Format("2006-01-02 15:04")
			nextAssemblyDate = &s
		}
	}

	resp := map[string]interface{}{
		"id":                   id,
		"status":               status,
		"full_name":            deref(fullName),
		"submitted_at":         submittedAt,
		"reviewed_at":          reviewedAt,
		"elevated_at":          elevatedAt,
		"next_assembly":        deref(nextAssemblyDate),
		"rejection_reason":     deref(rejectionReason),
		"rejection_expires_at": rejectionExpiresAt,
		"defense_text":         deref(defenseText),
		"defense_status":       deref(defenseStatus),
		"defense_submitted_at": defenseSubmittedAt,
	}
	writeJSON(w, 200, resp)
}

func (h *SystemHandler) submitAdmissionDefense(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		DefenseText string `json:"defense_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.DefenseText == "" || len(req.DefenseText) < 10 {
		writeError(w, 400, "defense_text is required and must be at least 10 characters")
		return
	}

	// Verificar que el usuario tiene una solicitud rechazada y no expirada
	var reqID string
	var rejectionExpiresAt *time.Time
	err = h.Pool.QueryRow(r.Context(), `
		SELECT id::text, rejection_expires_at FROM admission_requests
		WHERE created_user_id = $1 AND status = 'rejected' ORDER BY created_at DESC LIMIT 1`,
		userID).Scan(&reqID, &rejectionExpiresAt)
	if err != nil {
		writeError(w, 404, "no rejected admission request found")
		return
	}
	if rejectionExpiresAt != nil && rejectionExpiresAt.Before(time.Now()) {
		writeError(w, 403, "el plazo para enviar defensa ha expirado")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE admission_requests SET
			defense_text = $1, defense_submitted_at = NOW(), defense_status = 'pending', status = 'defense_pending'
		WHERE id = $2::uuid`,
		req.DefenseText, reqID)
	if err != nil {
		writeError(w, 500, "error submitting defense: "+err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message": "Defensa enviada. La comision revisara tu respuesta.",
		"status":  "defense_pending",
	})
}

// ===== GESTION DEL SITIO (admin) =====

func (h *SystemHandler) listSitePages(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Limpiar solicitudes expiradas automaticamente
	h.CleanupExpiredAdmissionRequests(r.Context())

	status := r.URL.Query().Get("status")
	query := `SELECT id::text, full_name, email, phone, location, reason, skills, how_heard,
		         status, created_at, COALESCE(custom_fields, '{}'::jsonb),
		         proposed_username, rejection_reason, rejection_expires_at,
		         defense_text, defense_status, defense_submitted_at, elevated_at
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
		var proposedUsername, rejectionReason, defenseText, defenseStatus *string
		var rejectionExpiresAt, defenseSubmittedAt, elevatedAt *time.Time
		if err := rows.Scan(&id, &fullName, &email, &phone, &location, &reason, &skills, &howHeard,
			&status, &createdAt, &customFields,
			&proposedUsername, &rejectionReason, &rejectionExpiresAt,
			&defenseText, &defenseStatus, &defenseSubmittedAt, &elevatedAt); err != nil {
			continue
		}
		requests = append(requests, map[string]interface{}{
			"id":                   id,
			"full_name":            fullName,
			"email":                deref(email),
			"phone":                deref(phone),
			"location":             deref(location),
			"reason":               deref(reason),
			"skills":               deref(skills),
			"how_heard":            deref(howHeard),
			"status":               status,
			"created_at":           createdAt,
			"custom_fields":        customFields,
			"proposed_username":    deref(proposedUsername),
			"rejection_reason":     deref(rejectionReason),
			"rejection_expires_at": rejectionExpiresAt,
			"defense_text":         deref(defenseText),
			"defense_status":       deref(defenseStatus),
			"defense_submitted_at": defenseSubmittedAt,
			"elevated_at":          elevatedAt,
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

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

func (h *SystemHandler) elevateAdmissionRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := h.Auth.GetUserID(r)

	// Obtener datos de la solicitud para la propuesta de asamblea
	var fullName, proposedUsername, reason, skills string
	var createdUserID *uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT full_name, proposed_username, COALESCE(reason, ''), COALESCE(skills, ''), created_user_id
		FROM admission_requests WHERE id = $1::uuid`, id).Scan(
		&fullName, &proposedUsername, &reason, &skills, &createdUserID)
	if err != nil {
		writeError(w, 404, "solicitud no encontrada")
		return
	}

	// Crear sesion de asamblea si no existe una activa
	var sessionID uuid.UUID
	err = h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		sessionID = uuid.New()
		nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.URL.Query().Get("node"), h.nodeDomain)
		_, _ = h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, $2, 'ordinaria', 'Sesion automatica - Admision', NOW(), 'active')`,
			sessionID, nodeDomain)
	}

	// Crear propuesta de asamblea para admision
	decisionID := uuid.New()
	proposalDesc := fmt.Sprintf("Admision de nuevo miembro: %s (usuario: %s). Razon: %s. Habilidades: %s",
		fullName, proposedUsername, truncate(reason, 200), truncate(skills, 200))
	params, _ := json.Marshal(map[string]interface{}{
		"admission_request_id": id,
		"proposed_username":    proposedUsername,
		"full_name":            fullName,
		"created_user_id":      derefUUID(createdUserID),
	})
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, new_value, required_signatures, status, voting_duration_minutes)
		VALUES ($1, $2, 'admission_approve', $3, $4, 1, 'proposed', 1440)`,
		decisionID, sessionID, proposalDesc, params)
	if err != nil {
		writeError(w, 500, "error creando propuesta de asamblea: "+err.Error())
		return
	}

	// Actualizar solicitud: elevada a asamblea
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE admission_requests SET
			status = 'elevated_to_assembly', elevated_at = NOW(), elevated_by = $1,
			assembly_decision_id = $2, reviewed_by = $1, reviewed_at = NOW()
		WHERE id = $3::uuid`,
		userID, decisionID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":              "Solicitud elevada a asamblea para votacion",
		"status":               "elevated_to_assembly",
		"assembly_decision_id": decisionID.String(),
	})
}

func (h *SystemHandler) rejectAdmissionRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := h.Auth.GetUserID(r)

	var req struct {
		RejectionReason string `json:"rejection_reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Permitir body vacio (compatibilidad) pero requerir motivo
		req.RejectionReason = ""
	}
	if req.RejectionReason == "" || len(req.RejectionReason) < 10 {
		writeError(w, 400, "rejection_reason es obligatorio y debe tener al menos 10 caracteres")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE admission_requests SET
			status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW(),
			rejection_expires_at = NOW() + INTERVAL '30 days'
		WHERE id = $3::uuid`,
		req.RejectionReason, userID, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message": "Solicitud rechazada. El postulante tiene 30 dias para enviar una defensa.",
		"status":  "rejected",
	})
}

func (h *SystemHandler) reviewAdmissionDefense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := h.Auth.GetUserID(r)

	var req struct {
		Action string `json:"action"` // "accept" | "reject"
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Action != "accept" && req.Action != "reject" {
		writeError(w, 400, "action debe ser 'accept' o 'reject'")
		return
	}

	// Verificar que la solicitud tiene defensa pendiente
	var fullName, proposedUsername, reason, skills string
	var createdUserID *uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT full_name, proposed_username, COALESCE(reason, ''), COALESCE(skills, ''), created_user_id
		FROM admission_requests WHERE id = $1::uuid AND status = 'defense_pending'`,
		id).Scan(&fullName, &proposedUsername, &reason, &skills, &createdUserID)
	if err != nil {
		writeError(w, 404, "solicitud no encontrada o no tiene defensa pendiente")
		return
	}

	if req.Action == "accept" {
		// Aceptar defensa: elevar a asamblea
		var sessionID uuid.UUID
		err = h.Pool.QueryRow(r.Context(), `
			SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
		if err != nil {
			sessionID = uuid.New()
			nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.URL.Query().Get("node"), h.nodeDomain)
			_, _ = h.Pool.Exec(r.Context(), `
				INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
				VALUES ($1, $2, 'ordinaria', 'Sesion automatica - Admision (defensa aceptada)', NOW(), 'active')`,
				sessionID, nodeDomain)
		}

		decisionID := uuid.New()
		proposalDesc := fmt.Sprintf("Admision (defensa aceptada): %s (usuario: %s). Razon: %s.",
			fullName, proposedUsername, truncate(reason, 200))
		params, _ := json.Marshal(map[string]interface{}{
			"admission_request_id": id,
			"proposed_username":    proposedUsername,
			"full_name":            fullName,
			"created_user_id":      derefUUID(createdUserID),
		})
		_, err = h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, new_value, required_signatures, status, voting_duration_minutes)
			VALUES ($1, $2, 'admission_approve', $3, $4, 1, 'proposed', 1440)`,
			decisionID, sessionID, proposalDesc, params)
		if err != nil {
			writeError(w, 500, "error creando propuesta de asamblea: "+err.Error())
			return
		}

		_, err = h.Pool.Exec(r.Context(), `
			UPDATE admission_requests SET
				status = 'elevated_to_assembly', defense_status = 'accepted',
				defense_reviewed_at = NOW(), defense_reviewed_by = $1,
				assembly_decision_id = $2
			WHERE id = $3::uuid`,
			userID, decisionID, id)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}

		writeJSON(w, 200, map[string]interface{}{
			"message": "Defensa aceptada. Solicitud elevada a asamblea.",
			"status":  "elevated_to_assembly",
		})
	} else {
		// Rechazar defensa: confirmar rechazo
		notes := req.Notes
		if notes == "" {
			notes = "Defensa rechazada por la comision"
		}
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE admission_requests SET
				defense_status = 'rejected', defense_reviewed_at = NOW(), defense_reviewed_by = $1,
				rejection_reason = rejection_reason || ' | Defensa rechazada: ' || $2
			WHERE id = $3::uuid`,
			userID, notes, id)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}

		writeJSON(w, 200, map[string]interface{}{
			"message": "Defensa rechazada. El rechazo se mantiene.",
			"status":  "rejected",
		})
	}
}

// ===== CLEANUP DE SOLICITUDES EXPIRADAS =====

// CleanupExpiredAdmissionRequests borra usuarios preliminares cuyas solicitudes
// fueron rechazadas y cuyo plazo de defensa de 30 dias ha expirado sin resolucion.
// Debe llamarse periodicamente (ej: en cada listado de solicitudes del admin).
func (h *SystemHandler) CleanupExpiredAdmissionRequests(ctx context.Context) {
	// Buscar solicitudes rechazadas expiradas con defensa no aceptada
	rows, err := h.Pool.Query(ctx, `
		SELECT id::text, created_user_id FROM admission_requests
		WHERE status = 'rejected'
		  AND rejection_expires_at < NOW()
		  AND (defense_status IS NULL OR defense_status != 'accepted')
		  AND created_user_id IS NOT NULL`)
	if err != nil {
		return
	}
	defer rows.Close()

	type expiredReq struct {
		ID            string
		CreatedUserID uuid.UUID
	}
	var expired []expiredReq
	for rows.Next() {
		var req expiredReq
		if err := rows.Scan(&req.ID, &req.CreatedUserID); err == nil {
			expired = append(expired, req)
		}
	}

	for _, req := range expired {
		// Borrar usuario preliminar (ON DELETE SET NULL preserva el registro de admision)
		_, _ = h.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1 AND membership_status = 'pending_admission'`, req.CreatedUserID)
		// Marcar solicitud como expirada
		_, _ = h.Pool.Exec(ctx, `
			UPDATE admission_requests SET status = 'expired', created_user_id = NULL WHERE id = $1::uuid`,
			req.ID)
	}
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

	// Decode the image
	srcImg, _, err := image.Decode(file)
	if err != nil {
		// Si no se puede decodificar, guardar el original sin comprimir
		file.Seek(0, io.SeekStart)
		saveRawImage(w, r, h, file, header, mimeType)
		return
	}

	// Save to /app/uploads/ (Docker volume)
	uploadDir := "/app/uploads"
	if _, err := os.Stat(uploadDir); err != nil {
		uploadDir = "./uploads"
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeError(w, 500, "failed to create upload directory")
		return
	}

	// 1. Guardar imagen original (max 1200px, JPEG calidad 85)
	maxOriginal := 1200
	origImg := resizeIfNeeded(srcImg, maxOriginal)
	origFilename := fmt.Sprintf("img_%d_%s.jpg", time.Now().UnixNano(), randomString(6))
	origPath := filepath.Join(uploadDir, origFilename)
	origFile, err := os.Create(origPath)
	if err != nil {
		writeError(w, 500, "failed to save original")
		return
	}
	jpeg.Encode(origFile, origImg, &jpeg.Options{Quality: 85})
	origFile.Close()
	origSize := getFileSize(origPath)
	origURL := "/uploads/" + origFilename

	// 2. Crear thumbnail (max 300px, JPEG calidad 75) para listas
	maxThumb := 300
	thumbImg := resizeIfNeeded(srcImg, maxThumb)
	thumbFilename := fmt.Sprintf("thumb_%d_%s.jpg", time.Now().UnixNano(), randomString(6))
	thumbPath := filepath.Join(uploadDir, thumbFilename)
	thumbFile, err := os.Create(thumbPath)
	if err != nil {
		// Si falla el thumb, al menos devolver la original
		writeJSON(w, 201, map[string]interface{}{
			"url":       origURL,
			"filename":  origFilename,
			"original":  header.Filename,
			"size":      origSize,
			"mime_type": "image/jpeg",
		})
		return
	}
	jpeg.Encode(thumbFile, thumbImg, &jpeg.Options{Quality: 75})
	thumbFile.Close()
	thumbSize := getFileSize(thumbPath)
	thumbURL := "/uploads/" + thumbFilename

	// Save metadata in DB
	userID, _ := h.Auth.GetUserID(r)
	bounds := origImg.Bounds()
	_, _ = h.Pool.Exec(r.Context(), `
		INSERT INTO uploaded_images (id, filename, original_name, mime_type, file_size, url, thumb_url, width, height, uploaded_by, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
		origFilename, header.Filename, "image/jpeg", origSize, origURL, thumbURL,
		bounds.Dx(), bounds.Dy(), userID)

	writeJSON(w, 201, map[string]interface{}{
		"url":        origURL,
		"thumb_url":  thumbURL,
		"filename":   origFilename,
		"original":   header.Filename,
		"size":       origSize,
		"thumb_size": thumbSize,
		"mime_type":  "image/jpeg",
		"width":      bounds.Dx(),
		"height":     bounds.Dy(),
	})
}

// saveRawImage guarda una imagen sin comprimir (fallback si decode falla)
func saveRawImage(w http.ResponseWriter, r *http.Request, h *SystemHandler, file io.Reader, header *multipart.FileHeader, mimeType string) {
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
	uploadDir := "/app/uploads"
	if _, err := os.Stat(uploadDir); err != nil {
		uploadDir = "./uploads"
	}
	os.MkdirAll(uploadDir, 0755)
	filePath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, 500, "failed to save file")
		return
	}
	defer dst.Close()
	io.Copy(dst, file)
	url := "/uploads/" + filename
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

// resizeIfNeeded redimensiona una imagen si excede maxDim pixeles en cualquier lado.
// Mantiene el aspect ratio. Si ya es mas pequena, la devuelve sin cambios.
func resizeIfNeeded(src image.Image, maxDim int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxDim && h <= maxDim {
		return src
	}
	var newW, newH int
	if w > h {
		newW = maxDim
		newH = h * maxDim / w
	} else {
		newH = maxDim
		newW = w * maxDim / h
	}
	// Usar nearest-neighbor simple (rapido, sin dependencias externas)
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	scaleX := float64(w) / float64(newW)
	scaleY := float64(h) / float64(newH)
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := int(float64(x) * scaleX)
			srcY := int(float64(y) * scaleY)
			if srcX >= w {
				srcX = w - 1
			}
			if srcY >= h {
				srcY = h - 1
			}
			dst.Set(x, y, src.At(bounds.Min.X+srcX, bounds.Min.Y+srcY))
		}
	}
	return dst
}

// getFileSize devuelve el tamano de un archivo en bytes
func getFileSize(path string) int64 {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
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
		WHERE node_domain = $1 AND is_approved = true AND is_hidden = false AND COALESCE(is_composite, false) = false`
	domain := h.nodeDomain
	if domain == "" {
		domain = db.ResolveNodeDomain(r.Context(), h.Pool, "", h.nodeDomain)
	}
	args := []interface{}{domain}
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
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
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Cargar valores dinamicos de la configuracion real del nodo
	dynValues := h.loadGovernanceDynamicValues(r.Context(), nodeDomain)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, category, title, description, severity, icon, sort_order, is_active, rule_type
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
		RuleType    string `json:"rule_type"`
	}

	var rules []Rule
	for rows.Next() {
		var rule Rule
		_ = rows.Scan(&rule.ID, &rule.Category, &rule.Title, &rule.Description, &rule.Severity, &rule.Icon, &rule.SortOrder, &rule.IsActive, &rule.RuleType)
		if category != "" && rule.Category != category {
			continue
		}
		// Reemplazar placeholders {key} con valores dinamicos
		rule.Description = replaceGovernancePlaceholders(rule.Description, dynValues)
		rules = append(rules, rule)
	}

	if rules == nil {
		rules = []Rule{}
	}
	writeJSON(w, 200, rules)
}

// loadGovernanceDynamicValues carga los valores reales de configuracion
// del nodo para reemplazar en las reglas de gobernanza.
func (h *SystemHandler) loadGovernanceDynamicValues(ctx context.Context, nodeDomain string) map[string]string {
	vals := map[string]string{
		"assembly_frequency":      "3",
		"quorum_ordinaria_first":  "50",
		"quorum_ordinaria_second": "30",
		"quorum_extraordinaria":   "66.67",
		"limit_new_negative":      "-100",
		"limit_new_positive":      "100",
		"limit_active_negative":   "-500",
		"limit_active_positive":   "500",
		"tax_individual_rate":     "0%",
		"tax_org_default_rate":    "5%",
	}

	// Frecuencia de asamblea ordinaria
	var freqMonths int
	_ = h.Pool.QueryRow(ctx, `
		SELECT COALESCE(ordinary_frequency_months, 3) FROM assembly_frequency_config
		WHERE node_domain IN ($1, 'localhost') AND scope = 'node' AND scope_id IS NULL
		LIMIT 1`, nodeDomain).Scan(&freqMonths)
	if freqMonths > 0 {
		vals["assembly_frequency"] = fmt.Sprintf("%d", freqMonths)
	}

	// Quorum de asamblea ordinaria
	var qFirst, qSecond float64
	_ = h.Pool.QueryRow(ctx, `
		SELECT quorum_first_call, quorum_second_call FROM assembly_quorum_config
		WHERE node_domain IN ($1, 'localhost') AND session_type = 'ordinaria'
		LIMIT 1`, nodeDomain).Scan(&qFirst, &qSecond)
	if qFirst > 0 {
		vals["quorum_ordinaria_first"] = fmt.Sprintf("%.0f", qFirst)
	}
	if qSecond > 0 {
		vals["quorum_ordinaria_second"] = fmt.Sprintf("%.0f", qSecond)
	}

	// Quorum de asamblea extraordinaria
	var qExtra float64
	_ = h.Pool.QueryRow(ctx, `
		SELECT quorum_first_call FROM assembly_quorum_config
		WHERE node_domain IN ($1, 'localhost') AND session_type = 'extraordinaria'
		LIMIT 1`, nodeDomain).Scan(&qExtra)
	if qExtra > 0 {
		vals["quorum_extraordinaria"] = fmt.Sprintf("%.0f", qExtra)
	}

	// Limites de niveles de miembro
	var newNeg, newPos, actNeg, actPos int
	_ = h.Pool.QueryRow(ctx, `
		SELECT credit_limit, debit_limit FROM member_levels
		WHERE node_domain IN ($1, 'localhost') AND name = 'nuevo' AND is_active = true
		LIMIT 1`, nodeDomain).Scan(&newNeg, &newPos)
	vals["limit_new_negative"] = fmt.Sprintf("%d", newNeg)
	vals["limit_new_positive"] = fmt.Sprintf("%d", newPos)

	_ = h.Pool.QueryRow(ctx, `
		SELECT credit_limit, debit_limit FROM member_levels
		WHERE node_domain IN ($1, 'localhost') AND name = 'activo' AND is_active = true
		LIMIT 1`, nodeDomain).Scan(&actNeg, &actPos)
	if actNeg != 0 || actPos != 0 {
		vals["limit_active_negative"] = fmt.Sprintf("%d", actNeg)
		vals["limit_active_positive"] = fmt.Sprintf("%d", actPos)
	}

	// Tasas de impuesto
	var indRate float64
	var indEnabled bool
	_ = h.Pool.QueryRow(ctx, `
		SELECT rate, enabled FROM tax_config
		WHERE node_domain IN ($1, 'localhost') AND scope = 'individual'
		LIMIT 1`, nodeDomain).Scan(&indRate, &indEnabled)
	if indEnabled {
		vals["tax_individual_rate"] = fmt.Sprintf("%.0f%%", indRate*100)
	} else {
		vals["tax_individual_rate"] = "0% (deshabilitado)"
	}

	var orgRate float64
	_ = h.Pool.QueryRow(ctx, `
		SELECT default_rate FROM tax_config
		WHERE node_domain IN ($1, 'localhost') AND scope = 'organization'
		LIMIT 1`, nodeDomain).Scan(&orgRate)
	if orgRate > 0 {
		vals["tax_org_default_rate"] = fmt.Sprintf("%.0f%%", orgRate*100)
	}

	return vals
}

// replaceGovernancePlaceholders reemplaza {key} con valores dinamicos
func replaceGovernancePlaceholders(text string, vals map[string]string) string {
	for key, val := range vals {
		placeholder := "{" + key + "}"
		text = strings.ReplaceAll(text, placeholder, val)
	}
	return text
}

func (h *SystemHandler) createGovernanceRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Category              string `json:"category"`
		Title                 string `json:"title"`
		Description           string `json:"description"`
		Severity              string `json:"severity"`
		Icon                  string `json:"icon"`
		SortOrder             int    `json:"sort_order"`
		RuleType              string `json:"rule_type"`
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
	if req.RuleType == "" {
		req.RuleType = "informativo"
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
		sessDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, $2, 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID, sessDomain)
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
		"rule_type":   req.RuleType,
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
		RuleType              string `json:"rule_type"`
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
		sessDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, $2, 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID, sessDomain)
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
		"rule_type":   req.RuleType,
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
		sessDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, $2, 'ordinaria', 'Sesion automatica', NOW(), 'active')`, sessionID, sessDomain)
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

// ===== ALLOWLIST DE PRODUCTOS (permitir / no permitir) =====

// allowProduct marca un producto como permitido en el nodo actual.
// Para productos locales: actualiza is_allowed = true.
// Para productos federados: inserta en product_node_allowlist.
func (h *SystemHandler) allowProduct(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	userID, _ := h.Auth.GetUserID(r)

	// Verificar si el producto es local
	var productNode string
	err = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM products WHERE id = $1`, productID).Scan(&productNode)
	if err != nil {
		writeError(w, 404, "producto no encontrado")
		return
	}

	if productNode == db.LOCAL_NODE_DOMAIN || productNode == nodeDomain {
		// Producto local: actualizar is_allowed directamente
		_, err = h.Pool.Exec(r.Context(), `UPDATE products SET is_allowed = true WHERE id = $1`, productID)
	} else {
		// Producto federado: upsert en allowlist
		_, err = h.Pool.Exec(r.Context(), `
			INSERT INTO product_node_allowlist (product_id, node_domain, is_allowed, decided_by)
			VALUES ($1, $2, true, $3)
			ON CONFLICT (product_id, node_domain) DO UPDATE SET is_allowed = true, decided_by = $3, decided_at = NOW()`,
			productID, nodeDomain, userID)
	}
	if err != nil {
		writeError(w, 500, "error al permitir producto")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "allowed"})
}

// disallowProduct marca un producto como NO permitido en el nodo actual.
func (h *SystemHandler) disallowProduct(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	userID, _ := h.Auth.GetUserID(r)

	var productNode string
	err = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM products WHERE id = $1`, productID).Scan(&productNode)
	if err != nil {
		writeError(w, 404, "producto no encontrado")
		return
	}

	if productNode == db.LOCAL_NODE_DOMAIN || productNode == nodeDomain {
		_, err = h.Pool.Exec(r.Context(), `UPDATE products SET is_allowed = false WHERE id = $1`, productID)
	} else {
		_, err = h.Pool.Exec(r.Context(), `
			INSERT INTO product_node_allowlist (product_id, node_domain, is_allowed, decided_by)
			VALUES ($1, $2, false, $3)
			ON CONFLICT (product_id, node_domain) DO UPDATE SET is_allowed = false, decided_by = $3, decided_at = NOW()`,
			productID, nodeDomain, userID)
	}
	if err != nil {
		writeError(w, 500, "error al no permitir producto")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "disallowed"})
}

// listAllowedProducts devuelve productos permitidos en el nodo actual.
func (h *SystemHandler) listAllowedProducts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT p.id, p.name, COALESCE(p.description,''), COALESCE(p.parent_category,''),
		       COALESCE(p.category,''), COALESCE(p.subcategory,''), p.unit, p.price_per_unit,
		       p.is_approved, COALESCE(p.badge,''), COALESCE(p.image_url,''),
		       COALESCE(p.image_thumb_url,''), COALESCE(p.product_code,''),
		       p.is_system, p.is_hidden, p.node_domain,
		       COALESCE(p.is_allowed, true) AS allowed
		FROM products p
		WHERE p.is_hidden = false AND COALESCE(p.is_composite, false) = false
		  AND (
		    (p.node_domain = $1 AND COALESCE(p.is_allowed, p.is_approved) = true)
		    OR
		    (p.node_domain != $1 AND EXISTS (
		      SELECT 1 FROM product_node_allowlist a
		      WHERE a.product_id = p.id AND a.node_domain = $1 AND a.is_allowed = true
		    ))
		  )
		ORDER BY p.name LIMIT 500`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	products := scanProductRowsWithThumb(rows)
	writeJSON(w, 200, products)
}

// listDisallowedProducts devuelve productos NO permitidos en el nodo actual.
func (h *SystemHandler) listDisallowedProducts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT p.id, p.name, COALESCE(p.description,''), COALESCE(p.parent_category,''),
		       COALESCE(p.category,''), COALESCE(p.subcategory,''), p.unit, p.price_per_unit,
		       p.is_approved, COALESCE(p.badge,''), COALESCE(p.image_url,''),
		       COALESCE(p.image_thumb_url,''), COALESCE(p.product_code,''),
		       p.is_system, p.is_hidden, p.node_domain,
		       false AS allowed
		FROM products p
		WHERE p.is_hidden = false AND COALESCE(p.is_composite, false) = false
		  AND (
		    (p.node_domain = $1 AND p.is_allowed = false)
		    OR
		    (p.node_domain != $1 AND EXISTS (
		      SELECT 1 FROM product_node_allowlist a
		      WHERE a.product_id = p.id AND a.node_domain = $1 AND a.is_allowed = false
		    ))
		  )
		ORDER BY p.name LIMIT 500`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	products := scanProductRowsWithThumb(rows)
	writeJSON(w, 200, products)
}

// scanProductRowsWithThumb escanea rows con el formato extendido (incluye thumb_url)
func scanProductRowsWithThumb(rows pgx.Rows) []map[string]interface{} {
	var products []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, description, parentCategory, category, subcategory, unit string
		var price float64
		var isApproved, isSystem, isHidden, allowed bool
		var badge, imageURL, thumbURL, productCode, nodeDomain string
		if err := rows.Scan(&id, &name, &description, &parentCategory, &category, &subcategory, &unit, &price, &isApproved, &badge, &imageURL, &thumbURL, &productCode, &isSystem, &isHidden, &nodeDomain, &allowed); err != nil {
			continue
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
			"badge":           badge,
			"image_url":       imageURL,
			"image_thumb_url": thumbURL,
			"product_code":    productCode,
			"is_system":       isSystem,
			"is_hidden":       isHidden,
			"node_domain":     nodeDomain,
			"is_allowed":      allowed,
		})
	}
	if products == nil {
		products = []map[string]interface{}{}
	}
	return products
}

// ===== BUSQUEDA DE USUARIOS Y ORGANIZACIONES =====

// searchUsers busca SOLO personas (account_type = 'individual').
// Las organizaciones (asamblea, impuesto, fondo comunitario, cooperativas, etc)
// NO aparecen aqui — se buscan con searchOrganizations.
func (h *SystemHandler) searchUsers(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	q := r.URL.Query().Get("q")

	var rows pgx.Rows
	var err error
	if q == "" {
		rows, err = h.Pool.Query(r.Context(), `
			SELECT id, username, COALESCE(display_name, username), account_type, membership_status
			FROM users
			WHERE node_domain = $1 AND membership_status = 'active' AND account_type = 'individual'
			ORDER BY username LIMIT 100`, nodeDomain)
	} else {
		rows, err = h.Pool.Query(r.Context(), `
			SELECT id, username, COALESCE(display_name, username), account_type, membership_status
			FROM users
			WHERE node_domain = $1 AND membership_status = 'active' AND account_type = 'individual'
			  AND (username ILIKE $2 OR display_name ILIKE $2)
			ORDER BY username LIMIT 50`, nodeDomain, "%"+q+"%")
	}
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var username, displayName, accountType, status string
		rows.Scan(&id, &username, &displayName, &accountType, &status)
		users = append(users, map[string]interface{}{
			"id":                id.String(),
			"username":          username,
			"display_name":      displayName,
			"account_type":      accountType,
			"membership_status": status,
		})
	}
	writeJSON(w, 200, users)
}

// searchOrganizations busca organizaciones por nombre o display_name.
func (h *SystemHandler) searchOrganizations(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	q := r.URL.Query().Get("q")

	var rows pgx.Rows
	var err error
	if q == "" {
		rows, err = h.Pool.Query(r.Context(), `
			SELECT id, username, COALESCE(display_name, username), account_type, membership_status
			FROM users
			WHERE node_domain = $1 AND account_type = 'organization' AND membership_status = 'active'
			ORDER BY username LIMIT 100`, nodeDomain)
	} else {
		rows, err = h.Pool.Query(r.Context(), `
			SELECT id, username, COALESCE(display_name, username), account_type, membership_status
			FROM users
			WHERE node_domain = $1 AND account_type = 'organization' AND membership_status = 'active'
			  AND (username ILIKE $2 OR display_name ILIKE $2)
			ORDER BY username LIMIT 50`, nodeDomain, "%"+q+"%")
	}
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	orgs := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var username, displayName, accountType, status string
		rows.Scan(&id, &username, &displayName, &accountType, &status)
		orgs = append(orgs, map[string]interface{}{
			"id":                id.String(),
			"name":              username,
			"display_name":      displayName,
			"account_type":      accountType,
			"membership_status": status,
		})
	}
	writeJSON(w, 200, orgs)
}
