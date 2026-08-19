package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"

	"federated-credit-node/internal/accounts"
	"federated-credit-node/internal/api"
	"federated-credit-node/internal/config"
	"federated-credit-node/internal/crypto"
	"federated-credit-node/internal/db"
	"federated-credit-node/internal/external"
	"federated-credit-node/internal/ledger"
	"federated-credit-node/internal/payments"
	"federated-credit-node/internal/pricing"
)

func main() {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config.yaml"
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	database, err := db.Connect(ctx, cfg.Database.ConnString())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "internal/db/migrations"
	}

	if err := database.RunMigrations(ctx, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	log.Println("Database migrations completed")

	// Seed: insertar paginas por defecto del sitio publico si no existen
	if err := database.SeedPublicPages(ctx, "localhost"); err != nil {
		log.Printf("Warning: failed to seed public pages: %v", err)
	}

	// Generar archivos HTML estaticos reales en disco para crawlers
	api.GenerateStaticHTMLFiles(database.Pool)

	// Seed: copiar productos seed de 'default' al dominio del nodo si no existen
	seedDomain := cfg.Node.Domain
	if seedDomain == "" {
		seedDomain = "localhost"
	}
	if err := database.SeedProductsToNode(ctx, seedDomain); err != nil {
		log.Printf("Warning: failed to seed products to node: %v", err)
	}

	ledgerSvc := ledger.New(database.Pool)
	accountsSvc := accounts.New(database.Pool)
	pricingSvc := pricing.New(database.Pool)
	cryptoSvc := crypto.NewKeyManager()
	passkeyMgr := crypto.NewPasskeyManager(cfg.Node.Name, cfg.Node.Domain, cfg.API.CORSOrigins)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "change-me-in-production"
		log.Println("WARNING: JWT_SECRET not set, using default. Set JWT_SECRET env var for production.")
	} else {
		log.Printf("JWT_SECRET loaded from env (length=%d, first6=%s)", len(jwtSecret), jwtSecret[:minInt(6, len(jwtSecret))])
	}

	authMiddleware := api.NewAuthMiddlewareWithPool(jwtSecret, database.Pool)
	challengeStore := api.NewChallengeStoreService()

	authHandlers := &api.AuthHandlers{
		PasskeyManager: &passkeyAdapter{pm: passkeyMgr},
		KeyManager:     &keyAdapter{km: cryptoSvc},
		Accounts:       &accountsAdapter{accts: accountsSvc},
		ChallengeStore: challengeStore,
		JWTSecret:      jwtSecret,
		NodeDomain:     cfg.Node.Domain,
		RPName:         cfg.Node.Name,
		Pool:           database.Pool,
	}

	handler := api.NewHandler(ledgerSvc, accountsSvc, pricingSvc, cryptoSvc, cfg.Node.Domain, database.Pool)
	federationHandler := api.NewFederationHandler(database.Pool, cfg.Node.Domain)
	orgsSvc := accounts.NewOrganizations(database.Pool)
	orgHandler := api.NewOrganizationHandler(orgsSvc, cfg.Node.Domain)
	paymentsSvc := payments.New(database.Pool, cfg.Node.Domain)
	paymentsHandler := api.NewPaymentsHandler(paymentsSvc, cfg.Node.Domain, authMiddleware, accountsSvc)
	dexSvc := external.NewDEX(database.Pool, cfg.Node.Domain)
	storeSvc := external.NewStore(database.Pool, cfg.Node.Domain)
	externalHandler := api.NewExternalHandler(dexSvc, storeSvc, cfg.Node.Domain, authMiddleware, database.Pool)
	recoverySvc := accounts.NewRecovery(database.Pool)
	recoveryHandler := api.NewRecoveryHandler(recoverySvc, cfg.Node.Domain, jwtSecret)
	departmentsSvc := accounts.NewDepartments(database.Pool)
	departmentsHandler := api.NewDepartmentsHandler(departmentsSvc, cfg.Node.Domain, authMiddleware, database.Pool)
	nfcTerminalsSvc := payments.NewNFCTerminals(database.Pool, cfg.Node.Domain)

	// Firmware compiler (opcional — solo si Docker esta disponible)
	firmwareDir := os.Getenv("FIRMWARE_DIR")
	if firmwareDir == "" {
		firmwareDir = "./firmware"
	}
	buildDir := os.Getenv("FIRMWARE_BUILD_DIR")
	if buildDir == "" {
		buildDir = "/tmp/firmware-builds"
	}
	dockerImage := os.Getenv("FIRMWARE_DOCKER_IMAGE")
	if dockerImage == "" {
		dockerImage = "fmc-arduino-compiler:latest"
	}
	firmwareCompiler := payments.NewFirmwareCompiler(firmwareDir, buildDir, dockerImage)

	nfcTerminalHandler := api.NewNFCTerminalHandler(nfcTerminalsSvc, cfg.Node.Domain, firmwareCompiler)

	setupHandler := api.NewSetupHandler(database.Pool, accountsSvc, jwtSecret, cfg.Node.Domain, cfg.Node.Name)

	router := api.NewRouterWithAuth(handler, authHandlers, federationHandler, orgHandler, paymentsHandler, externalHandler, recoveryHandler, departmentsHandler, nfcTerminalHandler, setupHandler, cfg.API.CORSOrigins, authMiddleware, database.Pool)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.API.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Node %s starting on port %d", cfg.Node.Name, cfg.API.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

type passkeyAdapter struct {
	pm *crypto.PasskeyManager
}

func (a *passkeyAdapter) BeginRegistration(userID uuid.UUID, username, displayName string, existingCreds [][]byte) (interface{}, error) {
	return a.pm.BeginRegistration(userID, username, displayName, existingCreds)
}

func (a *passkeyAdapter) VerifyRegistration(response interface{}, expectedChallenge, expectedOrigin string) (interface{}, error) {
	var resp crypto.RegistrationResponse
	switch v := response.(type) {
	case crypto.RegistrationResponse:
		resp = v
	case map[string]interface{}:
		// JSON deserializado como interface{} produce map[string]interface{}.
		// Re-marshall y re-unmarshal al tipo correcto.
		data, err := json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("marshaling registration response: %w", err)
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, fmt.Errorf("unmarshaling registration response: %w", err)
		}
	default:
		return nil, fmt.Errorf("invalid registration response type: %T", response)
	}
	return a.pm.VerifyRegistration(resp, expectedChallenge, expectedOrigin)
}

func (a *passkeyAdapter) BeginLogin(credentialIDs [][]byte) (interface{}, error) {
	return a.pm.BeginLogin(credentialIDs)
}

func (a *passkeyAdapter) VerifyLogin(response interface{}, expectedChallenge string, storedPubKey []byte, storedSignCount int64) (int64, error) {
	var resp crypto.LoginResponse
	switch v := response.(type) {
	case crypto.LoginResponse:
		resp = v
	case map[string]interface{}:
		data, err := json.Marshal(v)
		if err != nil {
			return 0, fmt.Errorf("marshaling login response: %w", err)
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			return 0, fmt.Errorf("unmarshaling login response: %w", err)
		}
	default:
		return 0, fmt.Errorf("invalid login response type: %T", response)
	}
	return a.pm.VerifyLogin(resp, expectedChallenge, storedPubKey, storedSignCount)
}

type keyAdapter struct {
	km *crypto.KeyManager
}

func (a *keyAdapter) GenerateEd25519KeyPair() (interface{}, interface{}, error) {
	return a.km.GenerateEd25519KeyPair()
}

func (a *keyAdapter) EncryptPrivateKey(privKey interface{}, passphrase string) ([]byte, []byte, error) {
	key, ok := privKey.(ed25519.PrivateKey)
	if !ok {
		return nil, nil, fmt.Errorf("invalid private key type")
	}
	return a.km.EncryptPrivateKey(key, passphrase)
}

func (a *keyAdapter) PublicKeyToHex(pubKey interface{}) string {
	key, ok := pubKey.(ed25519.PublicKey)
	if !ok {
		return ""
	}
	return a.km.PublicKeyToHex(key)
}

type accountsAdapter struct {
	accts *accounts.Accounts
}

func (a *accountsAdapter) GetUser(ctx context.Context, id uuid.UUID) (interface{}, error) {
	return a.accts.GetUser(ctx, id)
}

func (a *accountsAdapter) FindUserByUsername(ctx context.Context, nodeDomain, username string) (interface{}, error) {
	return a.accts.FindUserByUsername(ctx, nodeDomain, username)
}

func (a *accountsAdapter) CreateUser(ctx context.Context, params interface{}) (interface{}, error) {
	p, ok := params.(accounts.CreateUserParams)
	if !ok {
		return nil, fmt.Errorf("invalid params type")
	}
	return a.accts.CreateUser(ctx, p)
}
