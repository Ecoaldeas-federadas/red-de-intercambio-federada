package federation

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	TLSConfig  *tls.Config
	Protocol   *Protocol
	Gossip     *Gossip
	ListenPort int
}

func NewServer(pool *pgxpool.Pool, nodeDomain string, listenPort int, certPath, keyPath, caCertPath string) (*Server, error) {
	tlsConfig, err := buildTLSConfig(certPath, keyPath, caCertPath)
	if err != nil {
		return nil, fmt.Errorf("building TLS config: %w", err)
	}

	proto := New(pool, nodeDomain)
	gossip := NewGossip(pool, nodeDomain, 60*time.Second)

	return &Server{
		Pool:       pool,
		NodeDomain: nodeDomain,
		TLSConfig:  tlsConfig,
		Protocol:   proto,
		Gossip:     gossip,
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
