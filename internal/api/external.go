package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/external"
)

type ExternalHandler struct {
	DEX        *external.DEX
	Store      *external.Store
	NodeDomain string
	Auth       *AuthMiddleware
	Pool       *pgxpool.Pool
}

func NewExternalHandler(dex *external.DEX, store *external.Store, nodeDomain string, am *AuthMiddleware, pool *pgxpool.Pool) *ExternalHandler {
	return &ExternalHandler{DEX: dex, Store: store, NodeDomain: nodeDomain, Auth: am, Pool: pool}
}

func (eh *ExternalHandler) RegisterRoutes(r chi.Router) {
	eh.RegisterRoutesWithAuth(r, nil)
}

func (eh *ExternalHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/external/fc", eh.getCurrentFC)
	r.Post("/api/external/fc/calculate", eh.calculateFC)
	if am != nil {
		r.With(am.RequirePermission("external.store_fc")).Post("/api/external/fc/store", eh.storeFC)
	} else {
		r.Post("/api/external/fc/store", eh.storeFC)
	}

	r.Get("/api/external/operations", eh.listOperations)
	r.Post("/api/external/operations", eh.createOperation)
	r.Get("/api/external/operations/{id}", eh.getOperation)
	if am != nil {
		r.With(am.RequirePermission("external.approve_operation")).Post("/api/external/operations/{id}/approve", eh.approveOperation)
		r.With(am.RequirePermission("external.reject_operation")).Post("/api/external/operations/{id}/reject", eh.rejectOperation)
	} else {
		r.Post("/api/external/operations/{id}/approve", eh.approveOperation)
		r.Post("/api/external/operations/{id}/reject", eh.rejectOperation)
	}

	r.Get("/api/store/items", eh.listStoreItems)
	r.Post("/api/store/items", eh.addStoreItem)
	r.Get("/api/store/items/{id}", eh.getStoreItem)
	r.Get("/api/store/all", eh.listAllStores)
	if am != nil {
		r.With(am.RequirePermission("store.update_stock")).Put("/api/store/items/{id}/stock", eh.updateStock)
		r.With(am.RequirePermission("store.update_price")).Put("/api/store/items/{id}/price", eh.updatePrice)
		r.With(am.RequirePermission("store.deactivate_item")).Delete("/api/store/items/{id}", eh.deactivateStoreItem)
	} else {
		r.Put("/api/store/items/{id}/stock", eh.updateStock)
		r.Put("/api/store/items/{id}/price", eh.updatePrice)
		r.Delete("/api/store/items/{id}", eh.deactivateStoreItem)
	}
	r.Post("/api/store/purchase", eh.purchase)
	r.Post("/api/store/composite", eh.addCompositeItem)
	r.Get("/api/store/composite/{id}/composition", eh.getComposition)
	r.Get("/api/products/components", eh.listComponents)
}

func (eh *ExternalHandler) getCurrentFC(w http.ResponseWriter, r *http.Request) {
	cf, err := eh.DEX.GetCurrentFC(r.Context())
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, cf)
}

type CalculateFCRequest struct {
	ExternalCPI     float64 `json:"external_cpi"`
	LocalEnergyCost float64 `json:"local_energy_cost"`
}

func (eh *ExternalHandler) calculateFC(w http.ResponseWriter, r *http.Request) {
	var req CalculateFCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	fc, err := eh.DEX.CalculateFC(r.Context(), req.ExternalCPI, req.LocalEnergyCost)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"factor":            fc,
		"external_cpi":      req.ExternalCPI,
		"local_energy_cost": req.LocalEnergyCost,
	})
}

type StoreFCRequest struct {
	Factor          float64     `json:"factor"`
	ExternalCPI     float64     `json:"external_cpi"`
	LocalEnergyCost float64     `json:"local_energy_cost"`
	ApprovedBy      []uuid.UUID `json:"approved_by"`
}

func (eh *ExternalHandler) storeFC(w http.ResponseWriter, r *http.Request) {
	var req StoreFCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	cf, err := eh.DEX.StoreFC(r.Context(), req.Factor, req.ExternalCPI, req.LocalEnergyCost, req.ApprovedBy)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, cf)
}

func (eh *ExternalHandler) listOperations(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	ops, err := eh.DEX.ListOperations(r.Context(), status)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, ops)
}

type CreateOperationRequest struct {
	OperationType     string  `json:"operation_type"`
	ProductName       string  `json:"product_name"`
	Quantity          int64   `json:"quantity"`
	ExternalPriceUSD  float64 `json:"external_price_usd"`
	LocalPriceTrueque float64 `json:"local_price_trueque"`
	LogisticsPct      float64 `json:"logistics_pct"`
	ExternalTaxRate   float64 `json:"external_tax_rate"`
}

func (eh *ExternalHandler) createOperation(w http.ResponseWriter, r *http.Request) {
	var req CreateOperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	requestedByStr := r.Header.Get("X-User-ID")
	requestedBy, err := uuid.Parse(requestedByStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	op, err := eh.DEX.CreateOperation(r.Context(), external.CreateOperationParams{
		OperationType:     req.OperationType,
		ProductName:       req.ProductName,
		Quantity:          req.Quantity,
		ExternalPriceUSD:  req.ExternalPriceUSD,
		LocalPriceTrueque: req.LocalPriceTrueque,
		LogisticsPct:      req.LogisticsPct,
		ExternalTaxRate:   req.ExternalTaxRate,
		RequestedBy:       requestedBy,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, op)
}

func (eh *ExternalHandler) getOperation(w http.ResponseWriter, r *http.Request) {
	opID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid operation id")
		return
	}

	op, err := eh.DEX.GetOperation(r.Context(), opID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, op)
}

func (eh *ExternalHandler) approveOperation(w http.ResponseWriter, r *http.Request) {
	opID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid operation id")
		return
	}

	approverIDStr := r.Header.Get("X-User-ID")
	approverID, err := uuid.Parse(approverIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	if err := eh.DEX.ApproveOperation(r.Context(), opID, approverID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "approved"})
}

type RejectOperationRequest struct {
	Reason string `json:"reason"`
}

func (eh *ExternalHandler) rejectOperation(w http.ResponseWriter, r *http.Request) {
	opID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid operation id")
		return
	}

	var req RejectOperationRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := eh.DEX.RejectOperation(r.Context(), opID, req.Reason); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

func (eh *ExternalHandler) listStoreItems(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	items, err := eh.Store.ListItems(r.Context(), category)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, items)
}

// listAllStores devuelve todos los items de todas las tiendas para busqueda publico
func (eh *ExternalHandler) listAllStores(w http.ResponseWriter, r *http.Request) {
	items, err := eh.Store.ListItems(r.Context(), "")
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, items)
}

type AddStoreItemRequest struct {
	ProductID        string     `json:"product_id"`
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
	ExternalOpID     *uuid.UUID `json:"external_op_id"`
}

func (eh *ExternalHandler) addStoreItem(w http.ResponseWriter, r *http.Request) {
	var req AddStoreItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Get owner ID from auth context
	ownerIDVal, _ := eh.Auth.GetUserID(r)
	var ownerID *uuid.UUID
	if ownerIDVal != uuid.Nil {
		ownerID = &ownerIDVal
	}

	var productID *uuid.UUID
	if req.ProductID != "" {
		pid, err := uuid.Parse(req.ProductID)
		if err == nil {
			productID = &pid
		}
	}

	// If product_id provided, look up product info from catalog
	productName := req.ProductName
	description := req.Description
	category := req.Category
	origin := req.Origin
	unit := req.Unit
	quantityPerUnit := req.QuantityPerUnit
	if quantityPerUnit == 0 {
		quantityPerUnit = 1
	}
	priceTrueque := req.PriceTrueque
	basePrice := req.BasePrice
	extraCosts := req.ExtraCosts
	finalPrice := req.FinalPrice
	extraDescription := req.ExtraDescription

	if productID != nil {
		var pname, pdesc, pcat, punit, porigin string
		var pprice float64
		err := eh.Pool.QueryRow(r.Context(),
			`SELECT name, COALESCE(description,''), category, unit, origin, price_per_unit
			 FROM products WHERE id = $1`, *productID).Scan(
			&pname, &pdesc, &pcat, &punit, &porigin, &pprice)
		if err == nil {
			productName = pname
			description = pdesc
			category = pcat
			origin = porigin
			if unit == "" {
				unit = punit
			}
			if priceTrueque == 0 {
				priceTrueque = pprice
			}
			// Si no se enviaron precios calculados, usar el del catalogo
			if basePrice == 0 {
				basePrice = pprice
			}
		}
	}

	// Calcular precio final si no se envio: base + extras
	if finalPrice == 0 {
		if basePrice == 0 {
			basePrice = priceTrueque
		}
		finalPrice = basePrice + extraCosts
	}
	// Asegurar que price_trueque (compat) = finalPrice
	if priceTrueque == 0 {
		priceTrueque = finalPrice
	}

	if productName == "" {
		writeError(w, 400, "product_name or product_id required")
		return
	}

	item, err := eh.Store.AddItem(r.Context(), external.AddStoreItemParams{
		OwnerID:          ownerID,
		ProductID:        productID,
		ProductName:      productName,
		Description:      description,
		ParentCategory:   req.ParentCategory,
		Category:         category,
		Subcategory:      req.Subcategory,
		Origin:           origin,
		Unit:             unit,
		QuantityPerUnit:  quantityPerUnit,
		PriceTrueque:     priceTrueque,
		BasePrice:        basePrice,
		ExtraCosts:       extraCosts,
		FinalPrice:       finalPrice,
		ExtraDescription: extraDescription,
		Stock:            req.Stock,
		ExternalOpID:     req.ExternalOpID,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, item)
}

func (eh *ExternalHandler) getStoreItem(w http.ResponseWriter, r *http.Request) {
	itemID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid item id")
		return
	}

	item, err := eh.Store.GetItem(r.Context(), itemID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, item)
}

type UpdateStockRequest struct {
	Delta int64 `json:"delta"`
}

func (eh *ExternalHandler) updateStock(w http.ResponseWriter, r *http.Request) {
	itemID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid item id")
		return
	}

	var req UpdateStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := eh.Store.UpdateStock(r.Context(), itemID, req.Delta); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

type UpdatePriceRequest struct {
	NewPrice int64 `json:"new_price"`
}

func (eh *ExternalHandler) updatePrice(w http.ResponseWriter, r *http.Request) {
	itemID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid item id")
		return
	}

	var req UpdatePriceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := eh.Store.UpdatePrice(r.Context(), itemID, req.NewPrice); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (eh *ExternalHandler) deactivateStoreItem(w http.ResponseWriter, r *http.Request) {
	itemID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid item id")
		return
	}

	if err := eh.Store.DeactivateItem(r.Context(), itemID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

type PurchaseRequest struct {
	ItemID   uuid.UUID `json:"item_id"`
	BuyerID  uuid.UUID `json:"buyer_id"`
	Quantity int64     `json:"quantity"`
}

func (eh *ExternalHandler) purchase(w http.ResponseWriter, r *http.Request) {
	var req PurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	purchase, err := eh.Store.Purchase(r.Context(), req.ItemID, req.BuyerID, req.Quantity)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, purchase)
}

// ============ PRODUCTOS COMPUESTOS ============

type CompositeComponent struct {
	ComponentProductID string  `json:"component_product_id"`
	ComponentName      string  `json:"component_name"`
	ComponentUnit      string  `json:"component_unit"`
	ComponentPrice     float64 `json:"component_price"`
	Quantity           float64 `json:"quantity"`
	ComponentCategory  string  `json:"component_category"`
}

type AddCompositeItemRequest struct {
	ProductName     string               `json:"product_name"`
	Description     string               `json:"description"`
	ParentCategory  string               `json:"parent_category"`
	Category        string               `json:"category"`
	Subcategory     string               `json:"subcategory"`
	Unit            string               `json:"unit"`
	QuantityPerUnit float64              `json:"quantity_per_unit"`
	Stock           int64                `json:"stock"`
	Components      []CompositeComponent `json:"components"`
}

func (eh *ExternalHandler) addCompositeItem(w http.ResponseWriter, r *http.Request) {
	var req AddCompositeItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if len(req.Components) == 0 {
		writeError(w, 400, "debe agregar al menos un componente")
		return
	}

	ownerIDVal, _ := eh.Auth.GetUserID(r)
	var ownerID *uuid.UUID
	if ownerIDVal != uuid.Nil {
		ownerID = &ownerIDVal
	}

	// Calcular precio total sumando componentes
	var totalPrice float64
	compositeDesc := ""
	for _, c := range req.Components {
		// Verificar que el componente existe y esta aprobado
		if c.ComponentProductID != "" {
			pid, err := uuid.Parse(c.ComponentProductID)
			if err == nil {
				var pname, punit string
				var pprice float64
				var pApproved bool
				err := eh.Pool.QueryRow(r.Context(),
					`SELECT name, unit, price_per_unit, is_approved
					 FROM products WHERE id = $1 AND node_domain = $2`,
					pid, eh.NodeDomain).Scan(&pname, &punit, &pprice, &pApproved)
				if err != nil {
					writeError(w, 400, "componente no encontrado: "+c.ComponentName)
					return
				}
				if !pApproved {
					writeError(w, 400, "componente no aprobado por asamblea: "+pname)
					return
				}
				// Usar precio del catalogo, no el enviado por el cliente
				c.ComponentPrice = pprice
				c.ComponentName = pname
				c.ComponentUnit = punit
			}
		}
		subtotal := c.ComponentPrice * c.Quantity
		totalPrice += subtotal
		if compositeDesc != "" {
			compositeDesc += ", "
		}
		compositeDesc += fmt.Sprintf("%s x%.4f (%.2f TQ)", c.ComponentName, c.Quantity, subtotal)
	}

	// Crear el store item con el precio calculado
	item, err := eh.Store.AddItem(r.Context(), external.AddStoreItemParams{
		OwnerID:          ownerID,
		ProductName:      req.ProductName,
		Description:      req.Description,
		ParentCategory:   req.ParentCategory,
		Category:         req.Category,
		Subcategory:      req.Subcategory,
		Origin:           "internal",
		Unit:             req.Unit,
		QuantityPerUnit:  req.QuantityPerUnit,
		PriceTrueque:     totalPrice,
		BasePrice:        totalPrice,
		ExtraCosts:       0,
		FinalPrice:       totalPrice,
		ExtraDescription: compositeDesc,
		Stock:            req.Stock,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Guardar la composicion
	for i, c := range req.Components {
		var componentID *uuid.UUID
		if c.ComponentProductID != "" {
			pid, err := uuid.Parse(c.ComponentProductID)
			if err == nil {
				componentID = &pid
			}
		}
		subtotal := c.ComponentPrice * c.Quantity
		_, err := eh.Pool.Exec(r.Context(),
			`INSERT INTO product_compositions (product_id, product_type, component_product_id, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
			 VALUES ($1, 'store_item', $2, $3, $4, $5, $6, $7, $8, $9)`,
			item.ID, componentID, c.ComponentName, c.ComponentUnit, c.ComponentPrice, c.Quantity, subtotal, c.ComponentCategory, i)
		if err != nil {
			// No fallar si no se puede guardar la composicion, pero loguear
			continue
		}
	}

	writeJSON(w, 201, map[string]interface{}{
		"item":        item,
		"total_price": totalPrice,
		"composition": compositeDesc,
		"components":  req.Components,
	})
}

func (eh *ExternalHandler) getComposition(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}

	rows, err := eh.Pool.Query(r.Context(),
		`SELECT id, component_product_id, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order
		 FROM product_compositions
		 WHERE product_id = $1
		 ORDER BY sort_order`, productID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	components := []map[string]interface{}{}
	for rows.Next() {
		var id string
		var componentProductID *uuid.UUID
		var name, unit, category string
		var price float64
		var quantity float64
		var subtotal float64
		var sortOrder int
		_ = rows.Scan(&id, &componentProductID, &name, &unit, &price, &quantity, &subtotal, &category, &sortOrder)

		cpID := ""
		if componentProductID != nil {
			cpID = componentProductID.String()
		}
		components = append(components, map[string]interface{}{
			"id":                   id,
			"component_product_id": cpID,
			"component_name":       name,
			"component_unit":       unit,
			"component_price":      price,
			"quantity":             quantity,
			"subtotal":             subtotal,
			"component_category":   category,
		})
	}
	writeJSON(w, 200, components)
}

func (eh *ExternalHandler) listComponents(w http.ResponseWriter, r *http.Request) {
	// Listar productos que pueden ser usados como componentes
	// materias primas, productos base aprobados, trabajo, embalaje, envio
	// Incluye items individuales dentro de grupos (group_id no nulo)
	// y productos que no son grupos ni pertenecen a un grupo
	category := r.URL.Query().Get("category")
	if category == "" {
		category = "all"
	}
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))

	query := `SELECT id, name, parent_category, category, subcategory, unit, price_per_unit, description, badge, image_url, group_id
		FROM products
		WHERE node_domain IN ($1, 'localhost', 'default') AND is_approved = true AND is_hidden = false AND is_group = false`
	args := []interface{}{eh.NodeDomain}
	argIdx := 2

	switch category {
	case "materia_prima":
		query += ` AND subcategory = 'Materia Prima'`
	case "producto_base":
		query += ` AND is_composite = true`
	case "trabajo":
		query += ` AND unit = 'hora'`
	case "embalaje":
		query += ` AND parent_category = 'Embalaje'`
	case "envio":
		query += ` AND parent_category = 'Envio'`
	}

	if search != "" {
		query += fmt.Sprintf(` AND (LOWER(name) LIKE $%d OR LOWER(description) LIKE $%d OR LOWER(category) LIKE $%d OR LOWER(parent_category) LIKE $%d)`,
			argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += ` ORDER BY parent_category, category, name`

	rows, err := eh.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	components := []map[string]interface{}{}
	for rows.Next() {
		var id, name, parentCategory, cat, subcat, unit, description string
		var price float64
		var badge, imageURL *string
		var groupID *string
		_ = rows.Scan(&id, &name, &parentCategory, &cat, &subcat, &unit, &price, &description, &badge, &imageURL, &groupID)

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

		components = append(components, map[string]interface{}{
			"id":              id,
			"name":            name,
			"parent_category": parentCategory,
			"category":        cat,
			"subcategory":     subcat,
			"unit":            unit,
			"price_per_unit":  price,
			"description":     description,
			"badge":           bdg,
			"image_url":       imgURL,
			"group_id":        gid,
		})
	}
	writeJSON(w, 200, components)
}
