package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"federated-credit-node/internal/accounts"
)

type SetupHandler struct {
	Pool       *pgxpool.Pool
	Accounts   *accounts.Accounts
	JWTSecret  string
	NodeDomain string
	NodeName   string
}

func NewSetupHandler(pool *pgxpool.Pool, accts *accounts.Accounts, jwtSecret, nodeDomain, nodeName string) *SetupHandler {
	return &SetupHandler{
		Pool:       pool,
		Accounts:   accts,
		JWTSecret:  jwtSecret,
		NodeDomain: nodeDomain,
		NodeName:   nodeName,
	}
}

func (sh *SetupHandler) RegisterRoutes(r chi.Router) {
	r.Get("/api/setup/status", sh.getSetupStatus)
	r.Post("/api/setup/init", sh.initNode)
	r.Get("/api/setup/node-keys", sh.getNodeKeys)
}

// getNodeKeys retorna la clave publica del nodo para que el admin pueda
// copiarla y registrarla en otros nodos para federarse.
func (sh *SetupHandler) getNodeKeys(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var nodeDomain, nodeName, nodePubKey string
	var initialized bool
	err := sh.Pool.QueryRow(ctx, `
		SELECT node_domain, node_name, node_public_key, initialized
		FROM node_config WHERE initialized = true LIMIT 1`).Scan(
		&nodeDomain, &nodeName, &nodePubKey, &initialized)
	if err != nil {
		writeError(w, 404, "node not initialized yet")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_domain":     nodeDomain,
		"node_name":       nodeName,
		"node_public_key": nodePubKey,
		"initialized":     initialized,
	})
}

type SetupStatus struct {
	Initialized   bool   `json:"initialized"`
	NodeDomain    string `json:"node_domain"`
	NodeName      string `json:"node_name"`
	AdminExists   bool   `json:"admin_exists"`
	JWTConfigured bool   `json:"jwt_configured"`
}

func (sh *SetupHandler) getSetupStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var adminCount int
	err := sh.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE account_type = 'individual' AND membership_status = 'active'`).Scan(&adminCount)
	if err != nil {
		adminCount = 0
	}

	jwtConfigured := sh.JWTSecret != "" && sh.JWTSecret != "change-me-in-production"

	status := SetupStatus{
		Initialized:   adminCount > 0,
		NodeDomain:    sh.NodeDomain,
		NodeName:      sh.NodeName,
		AdminExists:   adminCount > 0,
		JWTConfigured: jwtConfigured,
	}

	writeJSON(w, 200, status)
}

type InitNodeRequest struct {
	AdminUsername    string `json:"admin_username"`
	AdminDisplayName string `json:"admin_display_name"`
	AdminPassword    string `json:"admin_password"`
	NodeName         string `json:"node_name"`
	NodeDomain       string `json:"node_domain"`
}

func (sh *SetupHandler) initNode(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req InitNodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.AdminUsername == "" {
		writeError(w, 400, "admin_username is required")
		return
	}
	if req.AdminPassword == "" || len(req.AdminPassword) < 8 {
		writeError(w, 400, "admin_password must be at least 8 characters")
		return
	}

	var adminCount int
	err := sh.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE account_type = 'individual' AND membership_status = 'active'`).Scan(&adminCount)
	if err != nil {
		writeError(w, 500, "failed to check existing users")
		return
	}
	if adminCount > 0 {
		writeError(w, 409, "node is already initialized")
		return
	}

	nodeDomain := req.NodeDomain
	if nodeDomain == "" {
		nodeDomain = sh.NodeDomain
	}
	nodeName := req.NodeName
	if nodeName == "" {
		nodeName = sh.NodeName
	}

	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		writeError(w, 500, "failed to generate keypair")
		return
	}

	pubKeyHex := hex.EncodeToString(pubKey)

	var encryptedPrivKey []byte
	var keySalt []byte
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		writeError(w, 500, "failed to generate salt")
		return
	}
	keySalt = salt

	encryptedPrivKey, err = encryptPrivateKey(privKey, req.AdminPassword)
	if err != nil {
		writeError(w, 500, "failed to encrypt private key")
		return
	}

	var memberLevelID string
	err = sh.Pool.QueryRow(ctx, `SELECT id FROM member_levels WHERE level = (SELECT MAX(level) FROM member_levels) LIMIT 1`).Scan(&memberLevelID)
	if err != nil {
		rows, _ := sh.Pool.Query(ctx, `SELECT id FROM member_levels ORDER BY level DESC LIMIT 1`)
		defer rows.Close()
		for rows.Next() {
			rows.Scan(&memberLevelID)
		}
		if memberLevelID == "" {
			memberLevelID = uuid.New().String()
			_, _ = sh.Pool.Exec(ctx, `
				INSERT INTO member_levels (id, name, description, level, has_voice, has_vote, counts_in_quorum, credit_limit, debit_limit)
				VALUES ($1, 'Admin', 'Administrator', 99, true, true, true, 1000000, 1000000)`,
				memberLevelID)
		}
	}

	var creditLimit, debitLimit int64 = 1000000, 1000000
	adminUser, err := sh.Accounts.CreateUser(ctx, accounts.CreateUserParams{
		NodeDomain:       nodeDomain,
		Username:         req.AdminUsername,
		DisplayName:      req.AdminDisplayName,
		AccountType:      "individual",
		MemberLevelID:    memberLevelID,
		CreditLimit:      creditLimit,
		DebitLimit:       debitLimit,
		PublicKey:        pubKeyHex,
		EncryptedPrivKey: encryptedPrivKey,
		KeySalt:          keySalt,
	})
	if err != nil {
		writeError(w, 500, fmt.Sprintf("failed to create admin user: %v", err))
		return
	}

	pinHash, err := bcrypt.GenerateFromPassword([]byte(req.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, 500, "failed to hash password")
		return
	}

	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO user_credentials (user_id, password_hash, created_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id) DO UPDATE SET password_hash = $2`,
		adminUser.ID, pinHash)
	if err != nil {
	}
	deptID := uuid.New()
	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO departments (id, name, description, group_type, is_active, created_at)
		VALUES ($1, 'Administracion', 'Departamento de administracion del nodo', 'department', true, NOW())`,
		deptID)
	if err != nil {
	}

	roleID := uuid.New()
	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO roles (id, department_id, name, description, is_active, created_at)
		VALUES ($1, $2, 'Administrador', 'Rol con todos los permisos', true, NOW())`,
		roleID, deptID)
	if err != nil {
	}

	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO department_members (id, department_id, user_id, role_id, joined_at)
		VALUES ($1, $2, $3, $4, NOW())`,
		uuid.New(), deptID, adminUser.ID, roleID)
	if err != nil {
	}

	rows, err := sh.Pool.Query(ctx, `SELECT id FROM permissions`)
	if err != nil {
	}
	defer rows.Close()
	var permIDs []uuid.UUID
	for rows.Next() {
		var pid uuid.UUID
		rows.Scan(&pid)
		permIDs = append(permIDs, pid)
	}
	for _, pid := range permIDs {
		_, _ = sh.Pool.Exec(ctx, `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, roleID, pid)
	}

	// === Generar claves Ed25519 del nodo (para federacion) ===
	// Estas claves son distintas a las del usuario admin. Son del nodo como entidad.
	// Se usan para firmar comunicacion federada con otros nodos.
	nodePubKey, nodePrivKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		writeError(w, 500, "failed to generate node keypair")
		return
	}
	nodePubKeyHex := hex.EncodeToString(nodePubKey)

	// Encriptar la clave privada del nodo con la password del admin
	encryptedNodePrivKey, err := encryptPrivateKey(nodePrivKey, req.AdminPassword)
	if err != nil {
		writeError(w, 500, "failed to encrypt node private key")
		return
	}

	// Usar el JWT secret del environment (configurado por el instalador).
	// NO generar uno nuevo aqui - si lo hacemos, el middleware de auth
	// (que usa el secret del env) no podra validar los tokens.
	jwtSecret := sh.JWTSecret
	if jwtSecret == "" {
		jwtSecret = "change-me-in-production"
	}

	// Guardar la configuracion del nodo en la BD (tabla node_config)
	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO node_config (node_domain, node_name, node_public_key, node_private_key_enc, jwt_secret, initialized, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
		ON CONFLICT (node_domain) DO UPDATE SET
			node_name = $2,
			node_public_key = $3,
			node_private_key_enc = $4,
			jwt_secret = $5,
			initialized = true,
			updated_at = NOW()`,
		nodeDomain, nodeName, nodePubKeyHex, encryptedNodePrivKey, jwtSecret)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("failed to save node config: %v", err))
		return
	}

	am := NewAuthMiddleware(jwtSecret)
	token, err := am.GenerateToken(adminUser.ID, adminUser.Username, nodeDomain)
	if err != nil {
		writeError(w, 500, "failed to generate token")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"message":         "Node initialized successfully",
		"token":           token,
		"username":        adminUser.Username,
		"node":            nodeDomain,
		"user_id":         adminUser.ID.String(),
		"node_name":       nodeName,
		"node_domain":     nodeDomain,
		"node_public_key": nodePubKeyHex,
	})
}

func encryptPrivateKey(privKey ed25519.PrivateKey, passphrase string) ([]byte, error) {
	key := sha256.Sum256([]byte(passphrase))
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	ciphertext := aesgcm.Seal(nil, nonce, privKey, nil)
	result := append(nonce, ciphertext...)
	return result, nil
}
