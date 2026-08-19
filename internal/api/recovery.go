package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"federated-credit-node/internal/accounts"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type RecoveryHandler struct {
	Recovery   *accounts.Recovery
	NodeDomain string
	JWTSecret  string
}

func NewRecoveryHandler(r *accounts.Recovery, nodeDomain, jwtSecret string) *RecoveryHandler {
	return &RecoveryHandler{Recovery: r, NodeDomain: nodeDomain, JWTSecret: jwtSecret}
}

func (h *RecoveryHandler) RegisterRoutes(r chi.Router) {
	h.RegisterRoutesWithAuth(r, nil)
}

func (h *RecoveryHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/recovery/config", h.getConfig)
	if am != nil {
		r.With(am.RequirePermission("recovery.update_config")).Put("/api/recovery/config", h.updateConfig)
	} else {
		r.Put("/api/recovery/config", h.updateConfig)
	}
	r.Post("/api/recovery/request", h.createRequest)
	r.Get("/api/recovery/requests", h.listRequests)
	r.Get("/api/recovery/requests/{id}", h.getRequest)
	if am != nil {
		r.With(am.RequirePermission("recovery.approve")).Post("/api/recovery/requests/{id}/approve", h.approveRequest)
		r.With(am.RequirePermission("recovery.reject")).Post("/api/recovery/requests/{id}/reject", h.rejectRequest)
		r.With(am.RequirePermission("recovery.complete")).Post("/api/recovery/requests/{id}/complete", h.completeRecovery)
	} else {
		r.Post("/api/recovery/requests/{id}/approve", h.approveRequest)
		r.Post("/api/recovery/requests/{id}/reject", h.rejectRequest)
		r.Post("/api/recovery/requests/{id}/complete", h.completeRecovery)
	}
	r.Get("/api/recovery/requests/{id}/approvals", h.listApprovals)
	r.Post("/api/recovery/invitation", h.createInvitation)
	r.Post("/api/recovery/invitation/validate", h.validateInvitation)
}

func (h *RecoveryHandler) getConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.Recovery.GetConfig(r.Context(), h.NodeDomain)
	if err != nil {
		writeError(w, 404, "recovery config not found")
		return
	}
	writeJSON(w, 200, cfg)
}

type UpdateConfigRequest struct {
	ApprovalMode                 string     `json:"approval_mode"`
	RequiredApprovals            int        `json:"required_approvals"`
	CouncilGroupID               *uuid.UUID `json:"council_group_id"`
	AutoExpireHours              int        `json:"auto_expire_hours"`
	RequiresIdentityVerification bool       `json:"requires_identity_verification"`
}

func (h *RecoveryHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req UpdateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	validModes := map[string]bool{"assembly": true, "council": true, "multi_sig": true, "department": true}
	if !validModes[req.ApprovalMode] {
		writeError(w, 400, "invalid approval_mode. Valid: assembly, council, multi_sig, department")
		return
	}
	if req.RequiredApprovals < 2 {
		writeError(w, 400, "required_approvals must be at least 2 (no single person can restore access)")
		return
	}
	if req.AutoExpireHours < 1 {
		req.AutoExpireHours = 72
	}

	err = h.Recovery.UpdateConfig(r.Context(), h.NodeDomain, req.ApprovalMode,
		req.RequiredApprovals, req.CouncilGroupID, req.AutoExpireHours,
		req.RequiresIdentityVerification, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	cfg, _ := h.Recovery.GetConfig(r.Context(), h.NodeDomain)
	writeJSON(w, 200, cfg)
}

type CreateRecoveryRequest struct {
	TargetUsername       string                 `json:"target_username"`
	Reason               string                 `json:"reason"`
	IdentityVerification map[string]interface{} `json:"identity_verification"`
}

func (h *RecoveryHandler) createRequest(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, _ := am.GetUserID(r)

	var req CreateRecoveryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TargetUsername == "" {
		writeError(w, 400, "target_username is required")
		return
	}
	if req.Reason == "" {
		writeError(w, 400, "reason is required")
		return
	}

	var requesterID *uuid.UUID
	if userID != uuid.Nil {
		requesterID = &userID
	}

	recoveryReq, err := h.Recovery.CreateRequest(r.Context(), h.NodeDomain,
		req.TargetUsername, requesterID, req.Reason, req.IdentityVerification)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Notificar a la junta directiva del nodo sobre la nueva solicitud
	notify := NewNotifyService(h.Recovery.Pool)
	notify.NotifyBoard(r.Context(), h.NodeDomain, "recovery_request_created",
		"Nueva solicitud de recuperacion",
		fmt.Sprintf("Se ha creado una solicitud de recuperacion para %s. Razon: %s", req.TargetUsername, req.Reason),
		"/app/recovery",
		map[string]interface{}{"request_id": recoveryReq.ID, "target_username": req.TargetUsername})

	writeJSON(w, 201, recoveryReq)
}

func (h *RecoveryHandler) listRequests(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	reqs, err := h.Recovery.ListRequests(r.Context(), h.NodeDomain, status)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"requests": reqs})
}

func (h *RecoveryHandler) getRequest(w http.ResponseWriter, r *http.Request) {
	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}
	req, err := h.Recovery.GetRequest(r.Context(), reqID)
	if err != nil {
		writeError(w, 404, "recovery request not found")
		return
	}
	writeJSON(w, 200, req)
}

type ApproveRequest struct {
	ApprovalType string     `json:"approval_type"`
	Signature    *string    `json:"signature"`
	GroupID      *uuid.UUID `json:"group_id"`
	Notes        string     `json:"notes"`
}

func (h *RecoveryHandler) approveRequest(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	approverID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	var req ApproveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.ApprovalType = "member"
	}
	if req.ApprovalType == "" {
		req.ApprovalType = "member"
	}

	result, err := h.Recovery.ApproveRequest(r.Context(), reqID, approverID,
		req.ApprovalType, req.Signature, req.GroupID, req.Notes)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

type RejectRequest struct {
	Reason string `json:"reason"`
}

func (h *RecoveryHandler) rejectRequest(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	rejecterID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	var req RejectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Reason == "" {
		writeError(w, 400, "reason is required")
		return
	}

	err = h.Recovery.RejectRequest(r.Context(), reqID, rejecterID, req.Reason)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

type CompleteRecoveryRequest struct {
	NewPublicKey    string `json:"new_public_key"`
	NewCredentialID []byte `json:"new_credential_id"`
}

func (h *RecoveryHandler) completeRecovery(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	req, err := h.Recovery.GetRequest(r.Context(), reqID)
	if err != nil {
		writeError(w, 404, "recovery request not found")
		return
	}
	if req.Status != "approved" {
		writeError(w, 400, "request must be approved before completion")
		return
	}

	var body CompleteRecoveryRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.NewPublicKey == "" {
		writeError(w, 400, "new_public_key is required")
		return
	}

	isApprover := false
	for _, a := range req.ApprovedBy {
		if a == userID {
			isApprover = true
			break
		}
	}
	if !isApprover && req.TargetUserID != nil && *req.TargetUserID != userID {
		writeError(w, 403, "only the recovered user or an approver can complete the recovery")
		return
	}

	err = h.Recovery.CompleteRecovery(r.Context(), reqID, body.NewPublicKey, body.NewCredentialID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "completed"})
}

func (h *RecoveryHandler) listApprovals(w http.ResponseWriter, r *http.Request) {
	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}
	approvals, err := h.Recovery.ListApprovals(r.Context(), reqID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"approvals": approvals})
}

type CreateInvitationRequest struct {
	MaxUses       int    `json:"max_uses"`
	ProposedLevel string `json:"proposed_level"`
	ExpiresHours  int    `json:"expires_hours"`
}

func (h *RecoveryHandler) createInvitation(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req CreateInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.MaxUses = 1
	}
	if req.MaxUses < 1 {
		req.MaxUses = 1
	}
	if req.ProposedLevel == "" {
		req.ProposedLevel = "new"
	}

	var expiresAt *time.Time
	if req.ExpiresHours > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresHours) * time.Hour)
		expiresAt = &t
	}

	code, err := h.Recovery.CreateInvitationCode(r.Context(), h.NodeDomain, userID, req.MaxUses, req.ProposedLevel, expiresAt)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]string{"invitation_code": code})
}

type ValidateInvitationRequest struct {
	Code string `json:"code"`
}

func (h *RecoveryHandler) validateInvitation(w http.ResponseWriter, r *http.Request) {
	var req ValidateInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Code == "" {
		writeError(w, 400, "code is required")
		return
	}

	inv, err := h.Recovery.ValidateInvitationCode(r.Context(), h.NodeDomain, req.Code)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"valid":          true,
		"proposed_level": inv.ProposedLevel,
		"max_uses":       inv.MaxUses,
		"use_count":      inv.UseCount,
	})
}

var _ = context.Background
