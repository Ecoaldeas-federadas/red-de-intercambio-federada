package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"federated-credit-node/internal/db"
	"federated-credit-node/internal/payments"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// POSHandler maneja los cargos QR del POS web.
// El POS crea un cargo aqui, genera un QR con el token,
// y el cliente paga via /api/pos/charge/{token}/pay
type POSHandler struct {
	Pool       *pgxpool.Pool
	NFC        *payments.NFCTerminals
	NodeDomain string
	MultiSig   *payments.MultiSigPayments
}

func NewPOSHandler(pool *pgxpool.Pool, nfc *payments.NFCTerminals, nodeDomain string) *POSHandler {
	return &POSHandler{Pool: pool, NFC: nfc, NodeDomain: nodeDomain}
}

func (h *POSHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Rutas del terminal (requieren sesion de terminal activa via JWT del merchant)
	r.With(am.RequireAuth).Post("/api/pos/charge", h.createCharge)
	r.With(am.RequireAuth).Get("/api/pos/charge/{id}/status", h.getChargeStatus)
	r.With(am.RequireAuth).Post("/api/pos/charge/{id}/cancel", h.cancelCharge)

	// Catalogo ultraligero del vendedor para POS (soporta ?seller_id=, ?seller_card_uid=, ?v=etag)
	// No exige JWT cuando se consulta por seller_card_uid desde un terminal multi-vendedor autenticado
	r.Get("/api/pos/vendor-catalog", h.getVendorCatalog)

	// Decodificar/generar codigos de barra con peso (EAN-13) y etiquetas QR/NFC (tq1:...)
	r.Post("/api/pos/code/parse", h.parsePOSCode)
	r.Post("/api/pos/code/generate", h.generatePOSCode)

	// Canastas pre-armadas para etiquetas NFC / codigos de barra
	r.With(am.RequireAuth).Post("/api/pos/baskets", h.createPresetBasket)
	r.With(am.RequireAuth).Get("/api/pos/baskets", h.listPresetBaskets)
	r.Get("/api/pos/baskets/{code}", h.getPresetBasketByCode)

	// Ruta publica para que el cliente consulte el cargo antes de pagar
	// No requiere auth - el cliente ve el monto primero, luego inicia sesion
	r.Get("/api/pos/charge/{token}/info", h.getChargeInfo)

	// Ruta para que el cliente cancele el cargo (usa token, no id del merchant)
	// Requiere auth del cliente para que solo el que escaneo el QR pueda cancelar
	r.With(am.RequireAuth).Post("/api/pos/charge/{token}/cancel", h.cancelChargeByToken)

	// Ruta para pagar (requiere auth del cliente/pagador)
	r.With(am.RequireAuth).Post("/api/pos/charge/{token}/pay", h.payCharge)
}

// --- Create Charge ---

type CreateChargeRequest struct {
	Amount      int64                       `json:"amount"`
	Description string                      `json:"description"`
	SellerID    string                      `json:"seller_id,omitempty"`
	Items       []payments.POSCartItemInput `json:"items"`
}

type ChargeResponse struct {
	ChargeID    string                      `json:"charge_id"`
	ChargeToken string                      `json:"charge_token"`
	Amount      int64                       `json:"amount"`
	Status      string                      `json:"status"`
	Description string                      `json:"description,omitempty"`
	Items       []payments.POSCartItemInput `json:"items,omitempty"`
	ExpiresAt   string                      `json:"expires_at"`
}

func (h *POSHandler) createCharge(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req CreateChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	merchantID := userID
	if strings.TrimSpace(req.SellerID) != "" {
		if parsedSeller, sErr := uuid.Parse(strings.TrimSpace(req.SellerID)); sErr == nil {
			merchantID = parsedSeller
		}
	}

	// Validar obligatoriamente la canasta de productos y servicios reales
	resolvedItems, calcTotal, autoSummary, cartErr := payments.ValidateAndResolveCart(r.Context(), h.Pool, merchantID, req.Items)
	if cartErr != nil {
		writeError(w, 400, cartErr.Error())
		return
	}
	req.Amount = calcTotal
	if strings.TrimSpace(req.Description) == "" {
		req.Description = autoSummary
	}
	itemsJSON := payments.MarshalCartItemsJSON(resolvedItems)

	// Buscar el terminal web_pos del merchant
	// El terminal_id se envia en el header X-Terminal-ID
	terminalID := r.Header.Get("X-Terminal-ID")
	var termDBID *uuid.UUID
	if terminalID != "" {
		var id uuid.UUID
		err := h.Pool.QueryRow(r.Context(), `
			SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
			terminalID,
		).Scan(&id)
		if err == nil {
			termDBID = &id
		}
	}

	chargeToken := uuid.New().String()
	// Timeout de 3 minutos para que el cliente confirme el pago.
	// Si son varias firmas (multi-sig), cada firma resetea el timeout a 3 min mas.
	expiresAt := time.Now().Add(3 * time.Minute)

	var chargeID string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO pos_charges (node_domain, terminal_id, merchant_id, charge_token, amount, status, description, items_json, expires_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
		RETURNING id::text`,
		db.LOCAL_NODE_DOMAIN, termDBID, merchantID, chargeToken, req.Amount, req.Description, itemsJSON, expiresAt,
	).Scan(&chargeID)
	if err != nil {
		writeError(w, 500, "failed to create charge: "+err.Error())
		return
	}

	writeJSON(w, 201, ChargeResponse{
		ChargeID:    chargeID,
		ChargeToken: chargeToken,
		Amount:      req.Amount,
		Status:      "pending",
		Description: req.Description,
		Items:       resolvedItems,
		ExpiresAt:   expiresAt.Format(time.RFC3339),
	})
}

// --- Get Charge Status (for POS polling) ---

func (h *POSHandler) getChargeStatus(w http.ResponseWriter, r *http.Request) {
	chargeID := chi.URLParam(r, "id")
	if chargeID == "" {
		writeError(w, 400, "charge id is required")
		return
	}

	var status, paymentMethod string
	var paidAt *time.Time
	var amount int64
	err := h.Pool.QueryRow(r.Context(), `
		SELECT amount, status, payment_method, paid_at FROM pos_charges
		WHERE id::text = $1 OR charge_token = $1`,
		chargeID,
	).Scan(&amount, &status, &paymentMethod, &paidAt)
	if err != nil {
		writeError(w, 404, "charge not found")
		return
	}

	resp := map[string]interface{}{
		"charge_id":      chargeID,
		"amount":         amount,
		"status":         status,
		"payment_method": paymentMethod,
	}
	if paidAt != nil {
		resp["paid_at"] = paidAt.Format(time.RFC3339)
	}
	writeJSON(w, 200, resp)
}

// --- Get Charge Info (public, for customer before login) ---

func (h *POSHandler) getChargeInfo(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	var amount int64
	var status, description, merchantName string
	var itemsRaw []byte
	var expiresAt time.Time
	err := h.Pool.QueryRow(r.Context(), `
		SELECT c.amount, c.status, COALESCE(c.description,''), COALESCE(c.items_json, '[]'::jsonb), c.expires_at,
		       COALESCE(u.display_name, u.username, '')
		FROM pos_charges c
		JOIN users u ON u.id = c.merchant_id
		WHERE c.charge_token = $1`,
		token,
	).Scan(&amount, &status, &description, &itemsRaw, &expiresAt, &merchantName)
	if err != nil {
		writeError(w, 404, "charge not found or expired")
		return
	}

	// Verificar si expiro
	if status == "pending" && time.Now().After(expiresAt) {
		_, _ = h.Pool.Exec(r.Context(), `
			UPDATE pos_charges SET status = 'expired' WHERE charge_token = $1`,
			token,
		)
		status = "expired"
	}

	var items []payments.POSCartItemInput
	_ = json.Unmarshal(itemsRaw, &items)

	writeJSON(w, 200, map[string]interface{}{
		"amount":        amount,
		"status":        status,
		"description":   description,
		"items":         items,
		"merchant_name": merchantName,
		"expires_at":    expiresAt.Format(time.RFC3339),
	})
}

// --- Pay Charge (customer confirms payment) ---

type PayChargeRequest struct {
	PaymentMethod string `json:"payment_method"` // qr, nfc
}

func (h *POSHandler) payCharge(w http.ResponseWriter, r *http.Request) {
	payerID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	var req PayChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.PaymentMethod = "qr"
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = "qr"
	}

	// Atomically: verificar y pagar el cargo
	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, 500, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var chargeID uuid.UUID
	var merchantID uuid.UUID
	var amount int64
	var status string
	var itemsRaw []byte
	var expiresAt time.Time
	err = tx.QueryRow(r.Context(), `
		SELECT id, merchant_id, amount, status, COALESCE(items_json, '[]'::jsonb), expires_at
		FROM pos_charges
		WHERE charge_token = $1
		FOR UPDATE`,
		token,
	).Scan(&chargeID, &merchantID, &amount, &status, &itemsRaw, &expiresAt)
	if err != nil {
		writeError(w, 404, "charge not found")
		return
	}

	if status != "pending" {
		writeError(w, 400, "charge is already "+status)
		return
	}

	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(r.Context(), `UPDATE pos_charges SET status = 'expired' WHERE id = $1`, chargeID)
		_ = tx.Commit(r.Context())
		writeError(w, 400, "charge has expired")
		return
	}

	// No permitir pagarse a si mismo
	if payerID == merchantID {
		writeError(w, 400, "cannot pay yourself")
		return
	}

	// Verificar saldo del pagador contra su tope de credito comunitario
	// Filosofia moneda cero (LETS / Credito Mutuo):
	// - El saldo puede ser negativo (deuda con la comunidad).
	// - No existe "saldo insuficiente"; existe el tope negativo (credit_limit).
	// - Al tocar el tope, el miembro debe aportar a la comunidad para recibir nuevamente.
	var balance, creditLimit int64
	err = tx.QueryRow(r.Context(), `SELECT balance, credit_limit FROM users WHERE id = $1`, payerID).Scan(&balance, &creditLimit)
	if err != nil {
		writeError(w, 500, "failed to get payer balance")
		return
	}

	if balance-amount < creditLimit {
		// Formatear montos en TQ (dividir centavos por 100) para el mensaje.
		// El sistema almacena enteros en centavos internamente.
		balanceTQ := float64(balance) / 100.0
		limitTQ := float64(creditLimit) / 100.0
		afterTQ := float64(balance-amount) / 100.0
		writeJSON(w, 400, map[string]interface{}{
			"error":           fmt.Sprintf("Este pago te llevaria a %.2f TQ, por debajo de tu tope de credito comunitario (%.2f TQ). Debes aportar a la comunidad (bienes o trabajo) para poder pagar nuevamente.", afterTQ, limitTQ),
			"balance":         balance,
			"balance_tq":      balanceTQ,
			"credit_limit":    creditLimit,
			"credit_limit_tq": limitTQ,
			"amount":          amount,
		})
		return
	}

	// Verificar si la cuenta del pagador requiere multi-firma
	if h.MultiSig != nil {
		reqSigs, _, err := h.MultiSig.CheckAccountMultiSig(r.Context(), payerID)
		if err == nil && reqSigs > 1 {
			// La cuenta requiere multi-firma: crear pago pendiente
			pending, err := h.MultiSig.CreatePendingPayment(r.Context(), payments.CreatePendingPaymentParams{
				PaymentType:   "pos_qr",
				FromAccount:   payerID,
				ToAccount:     merchantID,
				Amount:        amount,
				PaymentMethod: "qr",
				PosChargeID:   &chargeID,
				Description:   "Pago QR multi-firma",
			})
			if err != nil {
				writeError(w, 500, "error creating pending multi-sig payment: "+err.Error())
				return
			}
			// La primera firma es implicita (el usuario que inicio el pago)
			remaining, _, _ := h.MultiSig.SignPendingPayment(r.Context(), pending.ID, payerID, "web", "", false, false)
			_ = tx.Commit(r.Context())
			writeJSON(w, 202, map[string]interface{}{
				"status":         "pending_multisig",
				"pending_id":     pending.ID,
				"charge_id":      chargeID,
				"required_sigs":  reqSigs,
				"collected_sigs": 1,
				"remaining_sigs": remaining,
				"message":        "Pago pendiente. Faltan " + strconv.Itoa(remaining) + " firma(s) para completar.",
			})
			return
		}
	}

	// Debitar del pagador
	_, err = tx.Exec(r.Context(), `UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`, payerID, amount)
	if err != nil {
		writeError(w, 500, "failed to debit payer")
		return
	}

	// Acreditar al merchant
	_, err = tx.Exec(r.Context(), `UPDATE users SET balance = balance + $2, updated_at = NOW() WHERE id = $1`, merchantID, amount)
	if err != nil {
		writeError(w, 500, "failed to credit merchant")
		return
	}

	// Marcar cargo como pagado
	_, err = tx.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'paid', payer_id = $2, paid_at = NOW(), payment_method = $3
		WHERE id = $1`,
		chargeID, payerID, req.PaymentMethod,
	)
	if err != nil {
		writeError(w, 500, "failed to mark charge as paid")
		return
	}

	// Registrar transaccion en el log
	_, err = tx.Exec(r.Context(), `
		INSERT INTO transactions (tx_type, sender_id, receiver_id, amount, status)
		VALUES ('pos_payment', $1, $2, $3, 'completed')`,
		payerID, merchantID, amount,
	)
	if err != nil {
		// No es fatal - el pago ya se completo
	}

	// Log NFC transaction para el terminal
	var termDBID *uuid.UUID
	_ = tx.QueryRow(r.Context(), `SELECT terminal_id FROM pos_charges WHERE id = $1`, chargeID).Scan(&termDBID)
	if termDBID != nil {
		_, _ = tx.Exec(r.Context(), `
			INSERT INTO nfc_transactions (terminal_id, card_uid, user_id, amount, status, pin_verified, transaction_type, buyer_user_id, seller_user_id)
			VALUES ($1, 'qr_payment', $2, $3, 'approved', true, 'pos_qr', $2, $4)`,
			*termDBID, payerID, amount, merchantID,
		)
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, 500, "failed to commit payment")
		return
	}

	// Descontar stock y registrar lineas en pos_transaction_items
	var chargeItems []payments.POSCartItemInput
	if json.Unmarshal(itemsRaw, &chargeItems) == nil && len(chargeItems) > 0 {
		payments.CommitCartStockAndItems(r.Context(), h.Pool, db.LOCAL_NODE_DOMAIN, &chargeID, nil, merchantID, payerID, chargeItems)
	}

	// Obtener nuevo balance del pagador
	var newBalance int64
	_ = h.Pool.QueryRow(r.Context(), `SELECT balance FROM users WHERE id = $1`, payerID).Scan(&newBalance)

	writeJSON(w, 200, map[string]interface{}{
		"status":         "paid",
		"amount":         amount,
		"new_balance":    newBalance,
		"payment_method": req.PaymentMethod,
	})
}

// --- Cancel Charge ---

func (h *POSHandler) cancelCharge(w http.ResponseWriter, r *http.Request) {
	chargeID := chi.URLParam(r, "id")
	if chargeID == "" {
		writeError(w, 400, "charge id is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'cancelled'
		WHERE (id::text = $1 OR charge_token = $1) AND status = 'pending'`,
		chargeID,
	)
	if err != nil {
		writeError(w, 500, "failed to cancel charge")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "cancelled"})
}

// cancelChargeByToken permite al CLIENTE cancelar el cargo usando el token del QR.
// Esto notifica al POS (que hace polling de status) que el cliente cancelo,
// en lugar de dejarlo esperando hasta que expire el timeout.
func (h *POSHandler) cancelChargeByToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	result, err := h.Pool.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'cancelled'
		WHERE charge_token = $1 AND status = 'pending'`,
		token,
	)
	if err != nil {
		writeError(w, 500, "failed to cancel charge")
		return
	}
	if result.RowsAffected() == 0 {
		// El cargo ya no esta pending (puede estar paid, expired, o cancelled)
		var status string
		_ = h.Pool.QueryRow(r.Context(), `SELECT status FROM pos_charges WHERE charge_token = $1`, token).Scan(&status)
		if status == "" {
			writeError(w, 404, "charge not found")
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"status":  status,
			"message": "El cargo ya no esta pendiente (estado: " + status + ")",
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"status":  "cancelled",
		"message": "Cargo cancelado por el cliente",
	})
}

// ============================================================================
// Catalogo ultraligero del vendedor para POS + Codigos de Barra/QR/NFC + Canastas
// ============================================================================

// VendorCatalogCompactItem es un item compacto de la tienda del vendedor
// optimizado para enlaces muy lentos (LoRa / punto a punto).
type VendorCatalogCompactItem struct {
	ID          string `json:"id"`
	ProductID   string `json:"pid,omitempty"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Category    string `json:"cat,omitempty"`
	Unit        string `json:"u"`
	PriceCents  int64  `json:"p"`
	Stock       int64  `json:"s"`
	IsService   bool   `json:"svc,omitempty"`
	IsUniversal bool   `json:"univ,omitempty"`
	IconURL     string `json:"ic,omitempty"`
}

// getVendorCatalog devuelve el catalogo ultraligero de la tienda de un vendedor
// (sus store_items activos + sus servicios + los servicios universales del nodo).
// Soporta:
//   - ?seller_id=<uuid>
//   - ?seller_card_uid=<card_uid> (para terminales multi-vendedor al escanear tarjeta del vendedor)
//   - Si no se envia ninguno, usa el usuario autenticado por JWT o merchant_user_id del X-Terminal-ID
//   - ?v=<etag> -> responde 304 Not Modified si la tienda no cambio (0 bytes en enlaces lentos)
//   - ?no_icons=1 -> omite icon_url para modo texto puro ultraligero
func (h *POSHandler) getVendorCatalog(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var sellerID uuid.UUID
	var sellerUsername, sellerDisplay string

	sellerIDParam := strings.TrimSpace(r.URL.Query().Get("seller_id"))
	sellerCardUID := strings.TrimSpace(r.URL.Query().Get("seller_card_uid"))
	noIcons := r.URL.Query().Get("no_icons") == "1"

	if sellerIDParam != "" {
		if parsed, err := uuid.Parse(sellerIDParam); err == nil {
			sellerID = parsed
		}
	}
	if sellerID == uuid.Nil && sellerCardUID != "" {
		_ = h.Pool.QueryRow(ctx, `
			SELECT user_id FROM nfc_cards WHERE card_uid = $1 AND is_active = true LIMIT 1`,
			sellerCardUID,
		).Scan(&sellerID)
	}
	if sellerID == uuid.Nil {
		if uid, err := getUserID(r); err == nil && uid != uuid.Nil {
			sellerID = uid
		}
	}
	if sellerID == uuid.Nil {
		termHeader := strings.TrimSpace(r.Header.Get("X-Terminal-ID"))
		if termHeader != "" {
			_ = h.Pool.QueryRow(ctx, `
				SELECT merchant_user_id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true LIMIT 1`,
				termHeader,
			).Scan(&sellerID)
		}
	}

	if sellerID != uuid.Nil {
		_ = h.Pool.QueryRow(ctx, `
			SELECT username, COALESCE(display_name, username, '')
			FROM users WHERE id = $1`, sellerID,
		).Scan(&sellerUsername, &sellerDisplay)
	}

	items := make([]VendorCatalogCompactItem, 0, 32)
	existingProdIDs := make(map[string]bool)

	// 1. Items propios de la tienda del vendedor (store_items)
	if sellerID != uuid.Nil {
		rows, err := h.Pool.Query(ctx, `
			SELECT si.id::text, COALESCE(si.product_id::text, ''), COALESCE(si.item_code, ''),
			       si.product_name, COALESCE(si.category, ''), COALESCE(si.unit, 'unidad'),
			       COALESCE(si.final_price, 0), COALESCE(si.price_trueque, 0),
			       si.stock, COALESCE(si.is_service, false),
			       COALESCE(NULLIF(si.image_icon_url, ''), COALESCE(p.image_icon_url, ''), COALESCE(p.image_thumb_url, ''))
			FROM store_items si
			LEFT JOIN products p ON p.id = si.product_id
			WHERE si.owner_id = $1
			  AND si.is_active = true
			  AND (p.id IS NULL OR (p.is_approved = true AND COALESCE(p.is_allowed, true) = true))
			ORDER BY si.is_service ASC, si.product_name ASC`, sellerID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, pid, code, name, cat, unit, iconURL string
				var finalPrice, priceTrueque float64
				var stock int64
				var isSvc bool
				if err := rows.Scan(&id, &pid, &code, &name, &cat, &unit, &finalPrice, &priceTrueque, &stock, &isSvc, &iconURL); err != nil {
					continue
				}
				p := finalPrice
				if p <= 0 {
					p = priceTrueque
				}
				priceCents := int64(p)
				if p > 0 && (p != float64(int64(p)) || p < 50) {
					priceCents = int64(p*100 + 0.5)
				}
				if noIcons {
					iconURL = ""
				}
				if pid != "" {
					existingProdIDs[pid] = true
				}
				items = append(items, VendorCatalogCompactItem{
					ID:         id,
					ProductID:  pid,
					Code:       code,
					Name:       name,
					Category:   cat,
					Unit:       unit,
					PriceCents: priceCents,
					Stock:      stock,
					IsService:  isSvc,
					IconURL:    iconURL,
				})
			}
		}
	}

	// 2. Servicios universales del nodo (ej: Trabajo en el Conuco / Mano Vuelta)
	uRows, uErr := h.Pool.Query(ctx, `
		SELECT id::text, COALESCE(item_code, '90001'), name, COALESCE(category, 'Servicios'),
		       COALESCE(unit, 'hora'), price_per_unit,
		       COALESCE(NULLIF(image_icon_url, ''), COALESCE(image_thumb_url, ''))
		FROM products
		WHERE node_domain = '__FEDERATION__'
		  AND is_active = true
		  AND is_approved = true
		  AND COALESCE(is_allowed, true) = true
		  AND COALESCE(is_universal_service, false) = true
		ORDER BY name ASC`)
	if uErr == nil {
		defer uRows.Close()
		for uRows.Next() {
			var pid, code, name, cat, unit, iconURL string
			var price float64
			if err := uRows.Scan(&pid, &code, &name, &cat, &unit, &price, &iconURL); err != nil {
				continue
			}
			if existingProdIDs[pid] {
				continue
			}
			priceCents := int64(price)
			if price > 0 && (price != float64(int64(price)) || price < 50) {
				priceCents = int64(price*100 + 0.5)
			}
			if noIcons {
				iconURL = ""
			}
			items = append(items, VendorCatalogCompactItem{
				ID:          pid,
				ProductID:   pid,
				Code:        code,
				Name:        name,
				Category:    cat,
				Unit:        unit,
				PriceCents:  priceCents,
				Stock:       -1,
				IsService:   true,
				IsUniversal: true,
				IconURL:     iconURL,
			})
		}
	}

	// Calcular hash/ETag ligero para evitar re-descargas innecesarias
	rawBytes, _ := json.Marshal(items)
	sum := sha256.Sum256(rawBytes)
	etag := hex.EncodeToString(sum[:8])

	if clientVer := strings.TrimSpace(r.URL.Query().Get("v")); clientVer != "" && clientVer == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	var sellerIDOut string
	if sellerID != uuid.Nil {
		sellerIDOut = sellerID.String()
	}

	writeJSON(w, 200, map[string]interface{}{
		"v":               etag,
		"seller_id":       sellerIDOut,
		"seller_username": sellerUsername,
		"seller_name":     sellerDisplay,
		"items":           items,
	})
}

// parsePOSCode decodifica un codigo de barras (EAN-13 con peso/cantidad), QR o etiqueta NFC (tq1:...)
// y resuelve los productos/servicios contra la tienda del vendedor.
func (h *POSHandler) parsePOSCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code     string `json:"code"`
		SellerID string `json:"seller_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	parsed, err := payments.ParsePOSCode(req.Code)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Si es una referencia a una canasta pre-armada (tq1:r:... o EAN-13 28...), cargarla de BD
	if parsed.Kind == "basket_ref" {
		var sellerUUID uuid.UUID
		var label string
		var itemsRaw []byte
		err := h.Pool.QueryRow(r.Context(), `
			SELECT seller_id, COALESCE(label,''), items_json
			FROM pos_preset_baskets
			WHERE (short_code = $1 OR barcode_ean13 = $1) AND is_active = true
			LIMIT 1`, parsed.BasketShortCode,
		).Scan(&sellerUUID, &label, &itemsRaw)
		if err != nil {
			writeError(w, 404, "canasta pre-armada no encontrada: "+parsed.BasketShortCode)
			return
		}
		parsed.SellerID = sellerUUID.String()
		_ = json.Unmarshal(itemsRaw, &parsed.Items)
	}

	// Determinar el sellerID efectivo (el que venia en la etiqueta tiene prioridad)
	effectiveSellerStr := parsed.SellerID
	if effectiveSellerStr == "" {
		effectiveSellerStr = strings.TrimSpace(req.SellerID)
	}
	var effectiveSellerID uuid.UUID
	if effectiveSellerStr != "" {
		if u, uErr := uuid.Parse(effectiveSellerStr); uErr == nil {
			effectiveSellerID = u
		}
	}
	if effectiveSellerID == uuid.Nil {
		if uid, uErr := getUserID(r); uErr == nil {
			effectiveSellerID = uid
		}
	}

	resolvedItems, totalCents, summary, vErr := payments.ValidateAndResolveCart(r.Context(), h.Pool, effectiveSellerID, parsed.Items)
	if vErr != nil {
		writeError(w, 400, vErr.Error())
		return
	}

	var sellerName string
	if effectiveSellerID != uuid.Nil {
		_ = h.Pool.QueryRow(r.Context(), `SELECT COALESCE(display_name, username, '') FROM users WHERE id = $1`, effectiveSellerID).Scan(&sellerName)
	}

	writeJSON(w, 200, map[string]interface{}{
		"kind":        parsed.Kind,
		"seller_id":   effectiveSellerID.String(),
		"seller_name": sellerName,
		"items":       resolvedItems,
		"total_cents": totalCents,
		"summary":     summary,
	})
}

// generatePOSCode genera el codigo de barras EAN-13 con peso/cantidad incrustada
// y el payload compacto tq1:... para QR y etiquetas NFC (de un producto o de una canasta).
func (h *POSHandler) generatePOSCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SellerID      string                      `json:"seller_id,omitempty"`
		IncludeSeller bool                        `json:"include_seller"`
		ItemCode      string                      `json:"item_code,omitempty"`
		Quantity      float64                     `json:"quantity,omitempty"`
		Items         []payments.POSCartItemInput `json:"items,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	sellerID := strings.TrimSpace(req.SellerID)
	if sellerID == "" && req.IncludeSeller {
		if uid, err := getUserID(r); err == nil && uid != uuid.Nil {
			sellerID = uid.String()
		}
	}
	if !req.IncludeSeller {
		sellerID = ""
	}

	if len(req.Items) > 1 {
		tagPayload := payments.FormatBasketTagPayload(sellerID, req.Items)
		writeJSON(w, 200, map[string]interface{}{
			"kind":        "basket_inline",
			"qr_payload":  tagPayload,
			"nfc_payload": tagPayload,
		})
		return
	}

	code := strings.TrimSpace(req.ItemCode)
	qty := req.Quantity
	if code == "" && len(req.Items) == 1 {
		code = req.Items[0].ItemCode
		if code == "" {
			code = req.Items[0].StoreItemID
		}
		qty = req.Items[0].Quantity
	}
	if qty <= 0 {
		qty = 1
	}

	ean13, _ := payments.GenerateWeightedEAN13(code, qty)
	tagPayload := payments.FormatProductTagPayload(sellerID, code, qty)

	writeJSON(w, 200, map[string]interface{}{
		"kind":          "product",
		"item_code":     code,
		"quantity":      qty,
		"barcode_ean13": ean13,
		"qr_payload":    tagPayload,
		"nfc_payload":   tagPayload,
	})
}

func (h *POSHandler) createPresetBasket(w http.ResponseWriter, r *http.Request) {
	sellerID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req struct {
		Label      string                      `json:"label"`
		IsReusable *bool                       `json:"is_reusable"`
		Items      []payments.POSCartItemInput `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	resolvedItems, totalCents, summary, vErr := payments.ValidateAndResolveCart(r.Context(), h.Pool, sellerID, req.Items)
	if vErr != nil {
		writeError(w, 400, vErr.Error())
		return
	}
	if strings.TrimSpace(req.Label) == "" {
		req.Label = summary
	}
	reusable := true
	if req.IsReusable != nil {
		reusable = *req.IsReusable
	}

	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	shortCode := string(b)
	tenDigits := fmt.Sprintf("%010d", time.Now().UnixNano()%10000000000)
	barcodeEAN13, _ := payments.GenerateBasketEAN13(tenDigits)
	itemsJSON := payments.MarshalCartItemsJSON(resolvedItems)

	var basketID string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO pos_preset_baskets (node_domain, short_code, barcode_ean13, seller_id, label, items_json, total_cents, is_reusable, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
		RETURNING id::text`,
		db.LOCAL_NODE_DOMAIN, shortCode, barcodeEAN13, sellerID, req.Label, itemsJSON, totalCents, reusable,
	).Scan(&basketID)
	if err != nil {
		writeError(w, 500, "error guardando canasta: "+err.Error())
		return
	}

	refPayload := "tq1:r:" + shortCode
	inlinePayload := payments.FormatBasketTagPayload(sellerID.String(), resolvedItems)

	writeJSON(w, 201, map[string]interface{}{
		"id":                 basketID,
		"short_code":         shortCode,
		"barcode_ean13":      barcodeEAN13,
		"qr_payload":         inlinePayload,
		"nfc_payload":        refPayload,
		"nfc_inline_payload": inlinePayload,
		"label":              req.Label,
		"items":              resolvedItems,
		"total_cents":        totalCents,
	})
}

func (h *POSHandler) listPresetBaskets(w http.ResponseWriter, r *http.Request) {
	sellerID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, short_code, COALESCE(barcode_ean13,''), COALESCE(label,''), items_json, total_cents, is_reusable, created_at
		FROM pos_preset_baskets
		WHERE seller_id = $1 AND is_active = true
		ORDER BY created_at DESC LIMIT 100`, sellerID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	list := []map[string]interface{}{}
	for rows.Next() {
		var id, shortCode, barcode, label string
		var itemsRaw []byte
		var totalCents int64
		var reusable bool
		var createdAt time.Time
		if err := rows.Scan(&id, &shortCode, &barcode, &label, &itemsRaw, &totalCents, &reusable, &createdAt); err != nil {
			continue
		}
		var items []payments.POSCartItemInput
		_ = json.Unmarshal(itemsRaw, &items)
		list = append(list, map[string]interface{}{
			"id":            id,
			"short_code":    shortCode,
			"barcode_ean13": barcode,
			"nfc_payload":   "tq1:r:" + shortCode,
			"qr_payload":    payments.FormatBasketTagPayload(sellerID.String(), items),
			"label":         label,
			"items":         items,
			"total_cents":   totalCents,
			"is_reusable":   reusable,
			"created_at":    createdAt,
		})
	}
	writeJSON(w, 200, list)
}

func (h *POSHandler) getPresetBasketByCode(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" {
		writeError(w, 400, "code is required")
		return
	}
	var id, shortCode, barcode, label string
	var sellerID uuid.UUID
	var itemsRaw []byte
	var totalCents int64
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id::text, short_code, COALESCE(barcode_ean13,''), seller_id, COALESCE(label,''), items_json, total_cents
		FROM pos_preset_baskets
		WHERE (short_code = $1 OR barcode_ean13 = $1) AND is_active = true
		LIMIT 1`, code,
	).Scan(&id, &shortCode, &barcode, &sellerID, &label, &itemsRaw, &totalCents)
	if err != nil {
		writeError(w, 404, "canasta no encontrada")
		return
	}
	var items []payments.POSCartItemInput
	_ = json.Unmarshal(itemsRaw, &items)
	writeJSON(w, 200, map[string]interface{}{
		"id":            id,
		"short_code":    shortCode,
		"barcode_ean13": barcode,
		"seller_id":     sellerID.String(),
		"label":         label,
		"items":         items,
		"total_cents":   totalCents,
	})
}

var _ = context.Background
