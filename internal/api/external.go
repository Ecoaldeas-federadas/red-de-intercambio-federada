package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"federated-credit-node/internal/external"
)

type ExternalHandler struct {
	DEX        *external.DEX
	Store      *external.Store
	NodeDomain string
}

func NewExternalHandler(dex *external.DEX, store *external.Store, nodeDomain string) *ExternalHandler {
	return &ExternalHandler{DEX: dex, Store: store, NodeDomain: nodeDomain}
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
	LocalPriceTrueque int64   `json:"local_price_trueque"`
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

type AddStoreItemRequest struct {
	ProductName  string     `json:"product_name"`
	Description  string     `json:"description"`
	Category     string     `json:"category"`
	Origin       string     `json:"origin"`
	PriceTrueque int64      `json:"price_trueque"`
	Stock        int64      `json:"stock"`
	ExternalOpID *uuid.UUID `json:"external_op_id"`
}

func (eh *ExternalHandler) addStoreItem(w http.ResponseWriter, r *http.Request) {
	var req AddStoreItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	item, err := eh.Store.AddItem(r.Context(), external.AddStoreItemParams{
		ProductName:  req.ProductName,
		Description:  req.Description,
		Category:     req.Category,
		Origin:       req.Origin,
		PriceTrueque: req.PriceTrueque,
		Stock:        req.Stock,
		ExternalOpID: req.ExternalOpID,
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
