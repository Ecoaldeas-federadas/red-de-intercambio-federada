package federation

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	TLSConfig  *tls.Config
	Protocol   *Protocol
	Gossip     *Gossip
	Reconciler *Reconciler
	ListenPort int
}

func NewServer(pool *pgxpool.Pool, nodeDomain string, listenPort int, certPath, keyPath, caCertPath string) (*Server, error) {
	tlsConfig, err := buildTLSConfig(certPath, keyPath, caCertPath)
	if err != nil {
		return nil, fmt.Errorf("building TLS config: %w", err)
	}

	proto := New(pool, nodeDomain)
	gossip := NewGossip(pool, nodeDomain, 60*time.Second)
	reconciler := NewReconciler(pool, nodeDomain)
	// Wire up gossip with reconciler so reconcileChain invokes real logic
	gossip.Reconciler = reconciler

	return &Server{
		Pool:       pool,
		NodeDomain: nodeDomain,
		TLSConfig:  tlsConfig,
		Protocol:   proto,
		Gossip:     gossip,
		Reconciler: reconciler,
		ListenPort: listenPort,
	}, nil
}

func buildTLSConfig(certPath, keyPath, caCertPath string) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return nil, fmt.Errorf("loading server certificate: %w", err)
	}

	caCertPool := x509.NewCertPool()
	if caCertPath != "" {
		caCert, err := os.ReadFile(caCertPath)
		if err != nil {
			return nil, fmt.Errorf("reading CA certificate: %w", err)
		}
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to append CA certificate")
		}
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    caCertPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/federation/inbox", s.handleInbox)
	mux.HandleFunc("/federation/limits", s.handleLimits)
	mux.HandleFunc("/federation/balance", s.handleBalance)
	mux.HandleFunc("/federation/bilateral/propose", s.handleBilateralPropose)
	mux.HandleFunc("/federation/bilateral/confirm", s.handleBilateralConfirm)
	mux.HandleFunc("/federation/bilateral/query", s.handleBilateralQuery)
	mux.HandleFunc("/federation/card/lookup", s.handleCardLookup)
	mux.HandleFunc("/federation/parity", s.handleParity)
	mux.HandleFunc("/federation/warnings", s.handleWarnings)
	mux.HandleFunc("/federation/health", s.handleHealth)
	mux.HandleFunc("/federation/reconcile/compare", s.handleReconcileCompare)
	mux.HandleFunc("/federation/reconcile/chain", s.handleReconcileChain)
	mux.HandleFunc("/federation/reconcile/import", s.handleReconcileImport)
	mux.HandleFunc("/federation/audit/chain", s.handleAuditChain)

	srv := &http.Server{
		Addr:      fmt.Sprintf(":%d", s.ListenPort),
		Handler:   mux,
		TLSConfig: s.TLSConfig,
	}

	go s.Gossip.Start(ctx)

	go func() {
		log.Printf("Federation server listening on :%d (mTLS)", s.ListenPort)
		if err := srv.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Federation server error: %v", err)
		}
	}()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeFederationJSON(w, 200, map[string]interface{}{
		"status":    "ok",
		"node":      s.NodeDomain,
		"protocol":  "fmc/1.0",
		"timestamp": time.Now().UTC(),
	})
}

func (s *Server) handleInbox(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var msg Message
	if err := decodeFederationJSON(r, &msg); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid message"})
		return
	}

	if msg.ToNode != s.NodeDomain {
		writeFederationJSON(w, 403, map[string]string{"error": "message not for this node"})
		return
	}

	switch msg.Type {
	case MsgTypeTransfer:
		s.handleTransferMessage(w, r, &msg)
	case MsgTypeBalanceSync:
		s.handleBalanceSyncMessage(w, r, &msg)
	case MsgTypeBilateralSync:
		s.handleBilateralSyncMessage(w, r, &msg)
	case MsgTypeProductProposal:
		s.handleProductProposalMessage(w, r, &msg)
	default:
		writeFederationJSON(w, 400, map[string]string{"error": "unknown message type"})
	}
}

func (s *Server) handleTransferMessage(w http.ResponseWriter, r *http.Request, msg *Message) {
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid payload"})
		return
	}

	txID, _ := payload["transaction_id"].(string)

	// Validar firma dual: tanto el nodo emisor como el receptor deben firmar
	senderSignature, _ := payload["sender_signature"].(string)
	receiverSignature, _ := payload["receiver_signature"].(string)
	if senderSignature == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "missing sender_signature - dual signature required"})
		return
	}
	if receiverSignature == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "missing receiver_signature - dual signature required"})
		return
	}

	// Verificacion criptografica Ed25519 de las firmas contra las claves
	// publicas registradas en node_federation_keys.
	// Los datos firmados son: tx_id|sender_node|receiver_node|amount|created_at
	senderNode, _ := payload["sender_node"].(string)
	receiverNode, _ := payload["receiver_node"].(string)
	amount, _ := payload["amount"].(float64)
	createdAtStr, _ := payload["created_at"].(string)

	signedData := fmt.Sprintf("%s|%s|%s|%d|%s", txID, senderNode, receiverNode, int64(amount), createdAtStr)

	// Verify sender signature against sender node's public key
	if senderNode != "" {
		if !s.verifyNodeSignature(r.Context(), senderNode, signedData, senderSignature) {
			writeFederationJSON(w, 400, map[string]string{"error": "invalid sender_signature - cryptographic verification failed"})
			return
		}
	}
	// Verify receiver signature against receiver node's public key
	if receiverNode != "" {
		if !s.verifyNodeSignature(r.Context(), receiverNode, signedData, receiverSignature) {
			writeFederationJSON(w, 400, map[string]string{"error": "invalid receiver_signature - cryptographic verification failed"})
			return
		}
	}

	_, err := s.Pool.Exec(r.Context(), `
		INSERT INTO processed_messages (id, source_node) VALUES ($1, $2)
		ON CONFLICT (id) DO NOTHING`,
		txID, msg.FromNode,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "processing message"})
		return
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"status":         "accepted",
		"transaction_id": txID,
	})
}

// verifyNodeSignature looks up the peer's public key in node_federation_keys
// and cryptographically verifies the Ed25519 signature over the given data.
// Returns true if the signature is valid, false otherwise (including if the
// peer key is not found — in which case we fail closed for security).
func (s *Server) verifyNodeSignature(ctx context.Context, peerDomain, data, signatureHex string) bool {
	var peerPubKey string
	err := s.Pool.QueryRow(ctx,
		`SELECT peer_public_key FROM node_federation_keys
		 WHERE peer_domain = $1 AND status = 'active'`,
		peerDomain,
	).Scan(&peerPubKey)
	if err != nil {
		// Peer key not found — fail closed
		return false
	}

	pubKeyBytes, err := hex.DecodeString(peerPubKey)
	if err != nil || len(pubKeyBytes) != ed25519.PublicKeySize {
		return false
	}

	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubKeyBytes), []byte(data), sigBytes)
}

func (s *Server) handleBalanceSyncMessage(w http.ResponseWriter, r *http.Request, msg *Message) {
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid payload"})
		return
	}

	remoteNode, _ := payload["remote_node"].(string)
	balance, _ := payload["balance"].(float64)
	lastHash, _ := payload["last_hash"].(string)

	_, err := s.Pool.Exec(r.Context(), `
		INSERT INTO node_balance (remote_node, balance, last_sync, last_hash)
		VALUES ($1, $2, NOW(), $3)
		ON CONFLICT (remote_node) DO UPDATE
		SET balance = $2, last_sync = NOW(), last_hash = $3`,
		remoteNode, int64(balance), lastHash,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "syncing balance"})
		return
	}

	writeFederationJSON(w, 200, map[string]string{"status": "synced"})
}

func (s *Server) handleBilateralSyncMessage(w http.ResponseWriter, r *http.Request, msg *Message) {
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid payload"})
		return
	}

	remoteNode, _ := payload["remote_node"].(string)
	creditLimit, _ := payload["credit_limit"].(float64)
	debitLimit, _ := payload["debit_limit"].(float64)
	isCustomized, _ := payload["is_customized"].(bool)

	_, err := s.Pool.Exec(r.Context(), `
		INSERT INTO bilateral_limits (local_node, remote_node, credit_limit, debit_limit, is_customized, remote_confirmed)
		VALUES ($1, $2, $3, $4, $5, true)
		ON CONFLICT (local_node, remote_node) DO UPDATE
		SET credit_limit = $3, debit_limit = $4, is_customized = $5, remote_confirmed = true, updated_at = NOW()`,
		s.NodeDomain, remoteNode, int64(creditLimit), int64(debitLimit), isCustomized,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "syncing bilateral"})
		return
	}

	writeFederationJSON(w, 200, map[string]string{"status": "synced"})
}

func (s *Server) handleLimits(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	resp, err := s.Protocol.QueryRemoteLimits(r.Context(), r.URL.Query().Get("remote"))
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "querying limits"})
		return
	}

	writeFederationJSON(w, 200, resp)
}

func (s *Server) handleBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	remoteNode := r.URL.Query().Get("node")
	if remoteNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	var balance int64
	var lastSync *time.Time
	var lastHash *string
	err := s.Pool.QueryRow(r.Context(),
		`SELECT balance, last_sync, last_hash FROM node_balance WHERE remote_node = $1`,
		remoteNode,
	).Scan(&balance, &lastSync, &lastHash)
	if err != nil {
		writeFederationJSON(w, 404, map[string]string{"error": "node not found"})
		return
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"remote_node": remoteNode,
		"balance":     balance,
		"last_sync":   lastSync,
		"last_hash":   lastHash,
	})
}

func (s *Server) handleBilateralPropose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		RemoteNode  string `json:"remote_node"`
		CreditLimit int64  `json:"credit_limit"`
		DebitLimit  int64  `json:"debit_limit"`
	}
	if err := decodeFederationJSON(r, &req); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	err := s.Protocol.ProposeBilateralLimit(r.Context(), req.RemoteNode, req.CreditLimit, req.DebitLimit)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, map[string]string{"status": "proposed"})
}

func (s *Server) handleBilateralConfirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		RemoteNode string `json:"remote_node"`
	}
	if err := decodeFederationJSON(r, &req); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	err := s.Protocol.ConfirmBilateralLimit(r.Context(), req.RemoteNode)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, map[string]string{"status": "confirmed"})
}

func (s *Server) handleBilateralQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	remoteNode := r.URL.Query().Get("node")
	if remoteNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	credit, debit, err := s.Protocol.GetEffectiveBilateralLimit(r.Context(), remoteNode)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"remote_node":  remoteNode,
		"credit_limit": credit,
		"debit_limit":  debit,
	})
}

func (s *Server) handleParity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	remoteNode := r.URL.Query().Get("node")
	if remoteNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	report, err := s.Gossip.GetParityReport(r.Context(), remoteNode)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, report)
}

func (s *Server) handleWarnings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	warnings, err := s.Gossip.GetActiveWarnings(r.Context())
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"warnings": warnings,
	})
}

type Client struct {
	NodeDomain string
	TLSConfig  *tls.Config
	HTTPClient *http.Client
}

func (s *Server) handleCardLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var req CardLookupPayload
	if err := decodeFederationJSON(r, &req); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.CardUID == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "card_uid required"})
		return
	}

	resp, err := s.Protocol.HandleCardLookup(r.Context(), &req)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeFederationJSON(w, 200, resp)
}

func NewClient(nodeDomain string, certPath, keyPath, caCertPath string) (*Client, error) {
	tlsConfig, err := buildTLSConfig(certPath, keyPath, caCertPath)
	if err != nil {
		return nil, fmt.Errorf("building client TLS config: %w", err)
	}

	return &Client{
		NodeDomain: nodeDomain,
		TLSConfig:  tlsConfig,
		HTTPClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: &http.Transport{TLSClientConfig: tlsConfig},
		},
	}, nil
}

func (c *Client) SendMessage(ctx context.Context, remoteNodeURL string, msg Message) error {
	return nil
}

func (c *Client) QueryRemoteLimits(ctx context.Context, remoteNodeURL, remoteNode string) (*LimitResponse, error) {
	return nil, nil
}

func (c *Client) ProposeBilateral(ctx context.Context, remoteNodeURL, remoteNode string, creditLimit, debitLimit int64) error {
	return nil
}

func (c *Client) ConfirmBilateral(ctx context.Context, remoteNodeURL, remoteNode string) error {
	return nil
}

func (c *Client) SyncBalance(ctx context.Context, remoteNodeURL string, remoteNode string, balance int64, lastHash string) error {
	return nil
}

func (c *Client) QueryRemoteCard(ctx context.Context, remoteNodeURL, cardUID string) (*CardLookupResponse, error) {
	body, _ := json.Marshal(CardLookupPayload{
		CardUID:  cardUID,
		FromNode: c.NodeDomain,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", remoteNodeURL+"/federation/card/lookup", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("querying remote card: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("remote node returned status %d", resp.StatusCode)
	}

	var result CardLookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding card lookup response: %w", err)
	}
	return &result, nil
}

// ============ RECONCILIATION & AUDIT ============

// handleReconcileCompare returns our last chain hash for a given node pair.
// The peer calls this to check if our chains are in sync.
func (s *Server) handleReconcileCompare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	peerNode := r.URL.Query().Get("node")
	if peerNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	// Our last hash for A->B (we are A, peer is B)
	hashAB, _ := s.Reconciler.GetLastChainHash(r.Context(), s.NodeDomain, peerNode)
	// Our last hash for B->A (peer is B, we are A)
	hashBA, _ := s.Reconciler.GetLastChainHash(r.Context(), peerNode, s.NodeDomain)

	writeFederationJSON(w, 200, map[string]interface{}{
		"node":         s.NodeDomain,
		"peer":         peerNode,
		"last_hash_ab": hashAB,
		"last_hash_ba": hashBA,
	})
}

// handleReconcileChain returns chain entries since a given hash (or all if empty).
// The peer calls this when it detects a hash mismatch to get our missing entries.
func (s *Server) handleReconcileChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	peerNode := r.URL.Query().Get("node")
	if peerNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	sinceHash := r.URL.Query().Get("since")

	// Return entries where we are sender and peer is receiver
	entries, err := s.Reconciler.GetChainSince(r.Context(), s.NodeDomain, peerNode, sinceHash)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "getting chain"})
		return
	}

	// Also entries where peer is sender and we are receiver
	entriesRev, _ := s.Reconciler.GetChainSince(r.Context(), peerNode, s.NodeDomain, sinceHash)
	entries = append(entries, entriesRev...)

	writeFederationJSON(w, 200, map[string]interface{}{
		"entries": entries,
		"count":   len(entries),
	})
}

// handleReconcileImport receives chain entries from a peer and imports them.
func (s *Server) handleReconcileImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		Entries []ChainEntry `json:"entries"`
	}
	if err := decodeFederationJSON(r, &req); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	imported := 0
	rejected := 0
	for _, entry := range req.Entries {
		err := s.Reconciler.ImportChainEntry(r.Context(), &entry)
		if err != nil {
			rejected++
		} else {
			imported++
		}
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"imported": imported,
		"rejected": rejected,
	})
}

// handleAuditChain returns the full chain for a node pair for audit purposes.
// Any node can request another node's chain to verify integrity.
func (s *Server) handleAuditChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	peerNode := r.URL.Query().Get("node")
	if peerNode == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "node parameter required"})
		return
	}

	entries, err := s.Reconciler.GetChainSince(r.Context(), s.NodeDomain, peerNode, "")
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "getting audit chain"})
		return
	}

	entriesRev, _ := s.Reconciler.GetChainSince(r.Context(), peerNode, s.NodeDomain, "")
	entries = append(entries, entriesRev...)

	writeFederationJSON(w, 200, map[string]interface{}{
		"node":    s.NodeDomain,
		"peer":    peerNode,
		"entries": entries,
		"count":   len(entries),
	})
}

// ============ PRODUCT FEDERATION ============

func (s *Server) handleProductProposalMessage(w http.ResponseWriter, r *http.Request, msg *Message) {
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid payload"})
		return
	}

	sourceProductID, _ := payload["source_product_id"].(string)
	name, _ := payload["name"].(string)
	parentCategory, _ := payload["parent_category"].(string)
	category, _ := payload["category"].(string)
	subcategory, _ := payload["subcategory"].(string)
	unit, _ := payload["unit"].(string)
	description, _ := payload["description"].(string)
	badge, _ := payload["badge"].(string)
	imageURL, _ := payload["image_url"].(string)
	pricePerUnit, _ := payload["price_per_unit"].(float64)
	isComposite, _ := payload["is_composite"].(bool)

	if sourceProductID == "" || name == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "source_product_id and name required"})
		return
	}

	sourcePID, err := uuid.Parse(sourceProductID)
	if err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid source_product_id"})
		return
	}

	// Guardar propuesta (si ya existe, no duplicar)
	_, err = s.Pool.Exec(r.Context(), `
		INSERT INTO product_federation_proposals (source_node, source_product_id, name, parent_category, category, subcategory, unit, description, badge, image_url, price_per_unit, is_composite, composition, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
		ON CONFLICT (source_node, source_product_id) DO NOTHING`,
		msg.FromNode, sourcePID, name, parentCategory, category, subcategory, unit, description, badge, imageURL, pricePerUnit, isComposite, payload["composition"],
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "saving product proposal"})
		return
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"status":      "accepted",
		"product":     name,
		"source_node": msg.FromNode,
	})
}

// BroadcastProductProposal envia un producto nuevo a todos los nodos federados conocidos
func (s *Server) BroadcastProductProposal(ctx context.Context, productID uuid.UUID, name, parentCategory, category, subcategory, unit, description, badge, imageURL string, pricePerUnit float64, isComposite bool, composition interface{}) error {
	// Obtener todos los nodos federados conocidos
	rows, err := s.Pool.Query(ctx, `SELECT remote_node FROM node_balance`)
	if err != nil {
		return fmt.Errorf("listing federated nodes: %w", err)
	}
	defer rows.Close()

	var nodes []string
	for rows.Next() {
		var node string
		_ = rows.Scan(&node)
		if node != "" && node != s.NodeDomain {
			nodes = append(nodes, node)
		}
	}

	// Por cada nodo, enviar propuesta
	// Nota: el envio real requiere URL del nodo remoto y cliente TLS
	// Por ahora registramos el intento en el log
	for _, node := range nodes {
		log.Printf("Product proposal: %s -> %s (product: %s, price: %f)", s.NodeDomain, node, name, pricePerUnit)
		// El envio real se hace via el cliente federado cuando las URLs esten configuradas
	}

	return nil
}
