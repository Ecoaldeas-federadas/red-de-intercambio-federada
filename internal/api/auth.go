package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthMiddleware struct {
	JWTSecret []byte
	Pool      *pgxpool.Pool
}

func NewAuthMiddleware(secret string) *AuthMiddleware {
	return &AuthMiddleware{JWTSecret: []byte(secret)}
}

func NewAuthMiddlewareWithPool(secret string, pool *pgxpool.Pool) *AuthMiddleware {
	return &AuthMiddleware{JWTSecret: []byte(secret), Pool: pool}
}

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Node     string `json:"node"`
	jwt.RegisteredClaims
}

func (am *AuthMiddleware) GenerateToken(userID uuid.UUID, username, node string) (string, error) {
	claims := &Claims{
		UserID:   userID.String(),
		Username: username,
		Node:     node,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(am.JWTSecret)
}

func (am *AuthMiddleware) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return am.JWTSecret, nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
}

func (am *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, 401, "authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, 401, "invalid authorization header format")
			return
		}

		claims, err := am.ValidateToken(parts[1])
		if err != nil {
			writeError(w, 401, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "username", claims.Username)
		ctx = context.WithValue(ctx, "node", claims.Node)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (am *AuthMiddleware) GetUserID(r *http.Request) (uuid.UUID, error) {
	userIDStr, ok := r.Context().Value("user_id").(string)
	if !ok {
		return uuid.Nil, fmt.Errorf("no user_id in context")
	}
	return uuid.Parse(userIDStr)
}

func (am *AuthMiddleware) RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if am.Pool == nil {
				next.ServeHTTP(w, r)
				return
			}

			// Asegurar que el token JWT este presente y valido (autocontenido:
			// no depende de que RequireAuth se haya aplicado antes).
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeError(w, 401, "authentication required")
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				writeError(w, 401, "invalid authorization header format")
				return
			}
			claims, err := am.ValidateToken(parts[1])
			if err != nil {
				writeError(w, 401, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "username", claims.Username)
			ctx = context.WithValue(ctx, "node", claims.Node)
			r = r.WithContext(ctx)

			userID, err := am.GetUserID(r)
			if err != nil {
				writeError(w, 401, "authentication required")
				return
			}

			// Super admin tiene acceso a todo
			var isSuperAdmin, superAdminEnabled bool
			_ = am.Pool.QueryRow(r.Context(), `
				SELECT is_super_admin, super_admin_enabled FROM users WHERE id = $1`,
				userID).Scan(&isSuperAdmin, &superAdminEnabled)
			if isSuperAdmin && superAdminEnabled {
				next.ServeHTTP(w, r)
				return
			}

			var has bool
			err = am.Pool.QueryRow(r.Context(), `
				SELECT EXISTS(
					SELECT 1 FROM user_permissions up
					JOIN permissions p ON p.id = up.permission_id
					WHERE up.user_id = $1 AND p.name = $2
					AND (up.expires_at IS NULL OR up.expires_at > NOW())
				)`,
				userID, permission,
			).Scan(&has)
			if err == nil && has {
				next.ServeHTTP(w, r)
				return
			}

			err = am.Pool.QueryRow(r.Context(), `
				SELECT EXISTS(
					SELECT 1 FROM department_members dm
					JOIN role_permissions rp ON rp.role_id = dm.role_id
					JOIN permissions p ON p.id = rp.permission_id
					WHERE dm.user_id = $1 AND p.name = $2
				)`,
				userID, permission,
			).Scan(&has)
			if err != nil {
				writeError(w, 500, "error checking permissions")
				return
			}

			if !has {
				writeError(w, 403, fmt.Sprintf("permission denied: %s required", permission))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type AuthHandlers struct {
	PasskeyManager PasskeyService
	KeyManager     KeyService
	Accounts       AccountsService
	ChallengeStore *ChallengeStoreService
	JWTSecret      string
	NodeDomain     string
	RPName         string
	Pool           *pgxpool.Pool
}

type PasskeyService interface {
	BeginRegistration(userID uuid.UUID, username, displayName string, existingCreds [][]byte) (interface{}, error)
	VerifyRegistration(response interface{}, expectedChallenge, expectedOrigin string) (interface{}, error)
	BeginLogin(credentialIDs [][]byte) (interface{}, error)
	VerifyLogin(response interface{}, expectedChallenge string, storedPubKey []byte, storedSignCount int64) (int64, error)
}

type KeyService interface {
	GenerateEd25519KeyPair() (interface{}, interface{}, error)
	EncryptPrivateKey(privKey interface{}, passphrase string) ([]byte, []byte, error)
	PublicKeyToHex(pubKey interface{}) string
}

type AccountsService interface {
	GetUser(ctx context.Context, id uuid.UUID) (interface{}, error)
	FindUserByUsername(ctx context.Context, nodeDomain, username string) (interface{}, error)
	CreateUser(ctx context.Context, params interface{}) (interface{}, error)
}

type ChallengeStoreService struct {
	store map[string]challengeEntry
}

type challengeEntry struct {
	Challenge string
	UserID    uuid.UUID
	Expires   time.Time
}

func NewChallengeStoreService() *ChallengeStoreService {
	return &ChallengeStoreService{store: make(map[string]challengeEntry)}
}

func (cs *ChallengeStoreService) Store(key, challenge string, userID uuid.UUID) {
	cs.store[key] = challengeEntry{
		Challenge: challenge,
		UserID:    userID,
		Expires:   time.Now().Add(5 * time.Minute),
	}
}

func (cs *ChallengeStoreService) Get(key string) (string, uuid.UUID, bool) {
	entry, ok := cs.store[key]
	if !ok || time.Now().After(entry.Expires) {
		delete(cs.store, key)
		return "", uuid.Nil, false
	}
	return entry.Challenge, entry.UserID, true
}

func (cs *ChallengeStoreService) Delete(key string) {
	delete(cs.store, key)
}

func (ah *AuthHandlers) RegisterRoutes(r chi.Router) {
	r.Post("/api/auth/register", ah.beginRegistration)
	r.Post("/api/auth/passkey/finish", ah.finishRegistration)
	r.Post("/api/auth/login/begin", ah.beginLogin)
	r.Post("/api/auth/login/finish", ah.finishLogin)
	r.Post("/api/auth/login/password", ah.passwordLogin)
	r.Get("/api/auth/me", ah.getMe)
	r.Post("/api/auth/passkey/list", ah.listPasskeys)
	r.Delete("/api/auth/passkey/{id}", ah.deletePasskey)
}

type BeginRegistrationRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

func (ah *AuthHandlers) beginRegistration(w http.ResponseWriter, r *http.Request) {
	var req BeginRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, 400, "username is required")
		return
	}

	userID := uuid.New()
	options, err := ah.PasskeyManager.BeginRegistration(userID, req.Username, req.DisplayName, nil)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	ah.ChallengeStore.Store(userID.String(), options.(map[string]interface{})["challenge"].(string), userID)

	writeJSON(w, 200, map[string]interface{}{
		"options":  options,
		"user_id":  userID.String(),
		"username": req.Username,
	})
}

type FinishRegistrationRequest struct {
	UserID      string      `json:"user_id"`
	Username    string      `json:"username"`
	DisplayName string      `json:"display_name"`
	Response    interface{} `json:"response"`
}

func (ah *AuthHandlers) finishRegistration(w http.ResponseWriter, r *http.Request) {
	var req FinishRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	challenge, storedUserID, ok := ah.ChallengeStore.Get(userID.String())
	if !ok || storedUserID != userID {
		writeError(w, 400, "no pending registration challenge")
		return
	}

	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "https://" + ah.NodeDomain
	}

	passkey, err := ah.PasskeyManager.VerifyRegistration(req.Response, challenge, origin)
	if err != nil {
		writeError(w, 400, fmt.Sprintf("registration verification failed: %v", err))
		return
	}

	ah.ChallengeStore.Delete(userID.String())

	writeJSON(w, 201, map[string]interface{}{
		"user_id":    userID.String(),
		"username":   req.Username,
		"passkey_id": passkey,
		"message":    "Passkey registered successfully. User account pending admission approval.",
	})
}

type BeginLoginRequest struct {
	Username string `json:"username"`
}

func (ah *AuthHandlers) beginLogin(w http.ResponseWriter, r *http.Request) {
	var req BeginLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, 400, "username is required")
		return
	}

	options, err := ah.PasskeyManager.BeginLogin(nil)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	sessionKey := uuid.New().String()
	challenge := options.(map[string]interface{})["challenge"].(string)
	ah.ChallengeStore.Store(sessionKey, challenge, uuid.Nil)

	writeJSON(w, 200, map[string]interface{}{
		"options":     options,
		"session_key": sessionKey,
		"username":    req.Username,
	})
}

type FinishLoginRequest struct {
	SessionKey string      `json:"session_key"`
	Username   string      `json:"username"`
	Response   interface{} `json:"response"`
}

func (ah *AuthHandlers) finishLogin(w http.ResponseWriter, r *http.Request) {
	var req FinishLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, _, ok := ah.ChallengeStore.Get(req.SessionKey)
	if !ok {
		writeError(w, 400, "no pending login challenge")
		return
	}

	ah.ChallengeStore.Delete(req.SessionKey)

	am := NewAuthMiddleware(ah.JWTSecret)
	token, err := am.GenerateToken(uuid.New(), req.Username, ah.NodeDomain)
	if err != nil {
		writeError(w, 500, "failed to generate token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":    token,
		"username": req.Username,
		"node":     ah.NodeDomain,
	})
}

func (ah *AuthHandlers) getMe(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	user, err := ah.Accounts.GetUser(r.Context(), userID)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}

	writeJSON(w, 200, user)
}

func (ah *AuthHandlers) listAccounts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	rows, err := ah.Pool.Query(r.Context(), `
		SELECT id, username, display_name, account_type, membership_status
		FROM users WHERE node_domain = $1 AND membership_status = 'active'
		ORDER BY username`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing accounts")
		return
	}
	defer rows.Close()
	var accounts []map[string]interface{}
	for rows.Next() {
		var id string
		var username, displayName, accountType, status string
		if err := rows.Scan(&id, &username, &displayName, &accountType, &status); err != nil {
			continue
		}
		accounts = append(accounts, map[string]interface{}{
			"id":                id,
			"username":          username,
			"display_name":      displayName,
			"account_type":      accountType,
			"membership_status": status,
		})
	}
	if accounts == nil {
		accounts = []map[string]interface{}{}
	}
	writeJSON(w, 200, accounts)
}

func (ah *AuthHandlers) listPasskeys(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"user_id":  userID.String(),
		"passkeys": []interface{}{},
	})
}

func (ah *AuthHandlers) deletePasskey(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	_, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	passkeyID := chi.URLParam(r, "id")
	if passkeyID == "" {
		writeError(w, 400, "passkey id is required")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "deleted", "passkey_id": passkeyID})
}

type PasswordLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (ah *AuthHandlers) passwordLogin(w http.ResponseWriter, r *http.Request) {
	var req PasswordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, 400, "username and password are required")
		return
	}

	if ah.Pool == nil {
		writeError(w, 500, "database not available")
		return
	}

	var userID uuid.UUID
	var passwordHash string
	err := ah.Pool.QueryRow(r.Context(), `
		SELECT u.id, uc.password_hash
		FROM users u
		JOIN user_credentials uc ON uc.user_id = u.id
		WHERE u.username = $1 AND u.node_domain = $2 AND u.membership_status = 'active'
	`, req.Username, ah.NodeDomain).Scan(&userID, &passwordHash)
	if err != nil {
		writeError(w, 401, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, 401, "invalid credentials")
		return
	}

	am := NewAuthMiddleware(ah.JWTSecret)
	token, err := am.GenerateToken(userID, req.Username, ah.NodeDomain)
	if err != nil {
		writeError(w, 500, "failed to generate token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":    token,
		"username": req.Username,
		"node":     ah.NodeDomain,
		"user_id":  userID.String(),
	})
}
