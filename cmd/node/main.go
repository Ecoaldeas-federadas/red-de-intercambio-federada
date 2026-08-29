package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
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
	// Flags para modo demo
	demoReset := flag.Bool("demo-reset", false, "Resetear datos del nodo demo y salir")
	demoDomain := flag.String("demo-domain", "demo", "Dominio del nodo demo")
	flag.Parse()

	// Inicializar el commit instalado en el volumen compartido.
	// El archivo /app/BUILD_COMMIT se inyecta en build time via ARG BUILD_COMMIT.
	// Esto permite que checkUpdates distinga "commit descargado" (HEAD del repo,
	// que puede moverse al actualizar un servicio) de "commit instalado" (el
	// commit con el que se construyo esta imagen del node-app).
	if buildCommit, err := os.ReadFile("/app/BUILD_COMMIT"); err == nil {
		commit := strings.TrimSpace(string(buildCommit))
		if commit != "" && commit != "unknown" {
			os.MkdirAll("/update-state", 0755)
			os.WriteFile("/update-state/installed-node-commit.txt", []byte(commit), 0644)
			log.Printf("Installed node commit: %s", commit)
		}
	}

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

	// Esperar a que YugabyteDB este listo (puede tardar varios minutos)
	log.Println("Waiting for database to be ready...")
	var database *db.DB
	maxRetries := 60
	for i := 0; i < maxRetries; i++ {
		database, err = db.Connect(ctx, cfg.Database.ConnString())
		if err == nil {
			log.Println("Database is ready!")
			break
		}
		log.Printf("Database not ready yet (attempt %d/%d): %v", i+1, maxRetries, err)
		if i < maxRetries-1 {
			time.Sleep(5 * time.Second)
		}
	}
	if database == nil {
		log.Fatalf("Failed to connect to database after %d attempts", maxRetries)
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

	// Modo demo-reset: borrar y re-seedear, luego salir
	if *demoReset {
		log.Println("Demo reset mode: resetting domain", *demoDomain)
		if err := db.DemoReset(ctx, database, *demoDomain); err != nil {
			log.Fatalf("Demo reset failed: %v", err)
		}
		log.Println("Demo reset completed successfully")
		return
	}

	// Modo demo: auto-setup si DEMO_MODE=true
	// El padre se sirve bajo /main, el demo bajo /demo.
	// La raiz / sirve un HTML estatico de redirect (no el SPA).
	isDemoMode := os.Getenv("DEMO_MODE") == "true"
	demoBasePath := "/main"
	if isDemoMode {
		demoBasePath = "/demo"
	}
	if isDemoMode {
		// Leer el dominio del padre desde .demo-shared/parent-domain.txt
		// El padre lo escribe antes de iniciar el demo.
		// El dominio del demo es {parent_domain}/demo.
		demoDom := ""
		if data, err := os.ReadFile("/app/.demo-shared/parent-domain.txt"); err == nil {
			parentDomain := strings.TrimSpace(string(data))
			if parentDomain != "" {
				demoDom = parentDomain + "/demo"
			}
		}
		if demoDom == "" {
			// Fallback: usar DEMO_DOMAIN env o "localhost/demo"
			demoDom = os.Getenv("DEMO_DOMAIN")
			if demoDom == "" || demoDom == "demo" {
				demoDom = "localhost/demo"
			}
		}
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "demo-jwt-secret"
		}
		log.Println("Demo mode: parent domain detected, demo domain:", demoDom)
		log.Println("Demo mode: resetting demo data (using __LOCAL__)")
		// Resetear datos demo: borrar datos con __LOCAL__ y node_config con demoDom
		// Tambien borrar datos viejos con node_domain='demo' (one-time cleanup)
		if err := db.DemoReset(ctx, database, demoDom); err != nil {
			log.Printf("Warning: demo reset failed: %v", err)
		}
		log.Println("Demo mode: running auto-setup for domain", demoDom)
		// DemoAutoSetup configura node_config con demoDom y datos con __LOCAL__
		if err := api.DemoAutoSetup(ctx, database.Pool, jwtSecret, demoDom, "Nodo Demo - Red Federada"); err != nil {
			log.Printf("Warning: demo auto-setup failed: %v", err)
		}
		// Seed datos demo: todos los datos usan __LOCAL__, node_config usa demoDom
		log.Println("Demo mode: seeding demo data (using __LOCAL__)")
		demoPreset := os.Getenv("DEMO_PRESET")
		// Tambien leer desde archivo .demo-shared/preset.txt (escrito por el padre)
		if demoPreset == "" {
			if data, err := os.ReadFile("/app/.demo-shared/preset.txt"); err == nil {
				demoPreset = strings.TrimSpace(string(data))
			}
		}
		if demoPreset == "" {
			demoPreset = "gen_ecoaldea" // preset por defecto
		}
		log.Println("Demo mode: using preset:", demoPreset)
		if err := db.DemoSeedData(ctx, database, demoDom); err != nil {
			log.Printf("Warning: demo seed failed: %v", err)
		}
		// Aplicar configuracion del preset (horarios, reglas, nombre, footer)
		if demoPreset != "vacio" && demoPreset != "gen_ecoaldea" {
			if err := db.ApplyPreset(ctx, database.Pool, demoDom, demoPreset); err != nil {
				log.Printf("Warning: apply preset %s failed: %v", demoPreset, err)
			} else {
				log.Printf("Demo mode: preset %s applied successfully", demoPreset)
			}
		}
		// En modo demo, usar el dominio del demo (para federacion e identidad)
		cfg.Node.Domain = demoDom
	}

	// Migrar datos legacy: convertir cualquier dominio real/localhost/default
	// a LOCAL_NODE_DOMAIN ("__LOCAL__"). Esto se hace UNA SOLA VEZ.
	// Despues de esto, todos los datos locales usan __LOCAL__ y si cambia
	// el dominio del nodo, no hay que migrar nada.
	if err := db.MigrateDomainData(ctx, database.Pool); err != nil {
		log.Printf("Warning: failed to migrate domain data to __LOCAL__: %v", err)
	}

	// Seed: insertar paginas por defecto del sitio publico si no existen
	// En modo demo, las paginas las crea DemoSeedData (no usar las de Feria Conuquera)
	// Los datos locales se guardan con LOCAL_NODE_DOMAIN, no con el dominio real
	seedDomain := db.LOCAL_NODE_DOMAIN
	if !isDemoMode {
		if err := database.SeedPublicPages(ctx, seedDomain); err != nil {
			log.Printf("Warning: failed to seed public pages: %v", err)
		}

		// Aplicar preset del nodo si esta configurado en .env (NODE_PRESET)
		// y el nodo no esta inicializado (no hay admin). Esto es para instalacion nueva.
		nodePreset := os.Getenv("NODE_PRESET")
		if nodePreset != "" && nodePreset != "vacio" {
			var hasAdmin bool
			err := database.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE is_admin = true OR is_super_admin = true)`).Scan(&hasAdmin)
			if err == nil && !hasAdmin {
				log.Printf("Applying node preset: %s", nodePreset)
				if err := db.ApplyPreset(ctx, database.Pool, cfg.Node.Domain, nodePreset); err != nil {
					log.Printf("Warning: apply node preset %s failed: %v", nodePreset, err)
				} else {
					log.Printf("Node preset %s applied successfully", nodePreset)
				}
			}
		}
	}

	// Generar archivos HTML estaticos reales en disco para crawlers
	api.GenerateStaticHTMLFiles(database.Pool)

	// Seed: copiar productos seed de 'default' al dominio del nodo si no existen
	// En modo demo, los productos los crea DemoSeedData + el catalogo compartido
	if err := database.SeedProductsToNode(ctx, seedDomain); err != nil {
		log.Printf("Warning: failed to seed products to node: %v", err)
	}

	// Asegurar que existe la cuenta de la Asamblea General para el dominio del nodo
	// La Asamblea = Fondo Comunitario = cuenta de Impuestos (es la misma cuenta)
	// Se le puede transferir usando: asamblea, impuestos, fondo_comunitario
	_, _ = database.Pool.Exec(ctx, `
		INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, balance, credit_limit, debit_limit, is_assembly_owned, is_approved)
		SELECT gen_random_uuid(), $1, 'asamblea', 'Asamblea General', 'organization', 'active', 0, 999999999, 999999999, true, true
		WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'asamblea' AND node_domain = $1)`,
		seedDomain)

	// Seed: configuracion de asamblea (quorum, frecuencia, aprobaciones)
	// Los datos se guardan con LOCAL_NODE_DOMAIN
	if err := database.SeedAssemblyConfig(ctx, seedDomain); err != nil {
		log.Printf("Warning: failed to seed assembly config: %v", err)
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

	handler := api.NewHandler(ledgerSvc, accountsSvc, pricingSvc, cryptoSvc, db.LOCAL_NODE_DOMAIN, database.Pool)
	handler.MultiSig = payments.NewMultiSigPayments(database.Pool, db.LOCAL_NODE_DOMAIN)
	federationHandler := api.NewFederationHandler(database.Pool, cfg.Node.Domain)

	// Load node's Ed25519 private key for E2E encrypted federation transport.
	// The key is loaded from NODE_PRIVATE_KEY env var (base64-encoded).
	// If not set, the transport operates in verify-only mode (can verify
	// incoming signatures but can't sign/encrypt outgoing messages).
	nodePrivKeyB64 := os.Getenv("NODE_PRIVATE_KEY")
	if nodePrivKeyB64 != "" && nodePrivKeyB64 != "PENDIENTE" {
		if err := federationHandler.SetTransportPrivateKey(nodePrivKeyB64); err != nil {
			log.Printf("Warning: failed to load NODE_PRIVATE_KEY for federation transport: %v", err)
			log.Printf("         Federation propagation will be limited (verify-only mode)")
		} else {
			log.Printf("Federation transport: node private key loaded (E2E encryption active)")
		}
	} else {
		log.Printf("Warning: NODE_PRIVATE_KEY not set. Federation propagation in verify-only mode.")
		log.Printf("         Set NODE_PRIVATE_KEY env var (base64) to enable full E2E propagation.")
	}

	// Start federation gossip in background for automatic catch-up and sync.
	// The gossip loop runs every 60 seconds and handles:
	//   - Balance sync with peers
	//   - Bilateral limits sync
	//   - Node levels sync
	//   - Sponsorships sync
	//   - Chain reconciliation
	//   - Catch-up from peers (on startup)
	go func() {
		federationHandler.Gossip.Start(ctx)
	}()

	orgsSvc := accounts.NewOrganizations(database.Pool)
	orgHandler := api.NewOrganizationHandler(orgsSvc, cfg.Node.Domain)
	paymentsSvc := payments.New(database.Pool, cfg.Node.Domain)
	paymentsHandler := api.NewPaymentsHandler(paymentsSvc, cfg.Node.Domain, authMiddleware, accountsSvc)
	dexSvc := external.NewDEX(database.Pool, cfg.Node.Domain)
	storeSvc := external.NewStore(database.Pool, db.LOCAL_NODE_DOMAIN)
	externalHandler := api.NewExternalHandler(dexSvc, storeSvc, cfg.Node.Domain, authMiddleware, database.Pool)
	recoverySvc := accounts.NewRecovery(database.Pool)
	recoveryHandler := api.NewRecoveryHandler(recoverySvc, database.Pool, cfg.Node.Domain, jwtSecret)
	departmentsSvc := accounts.NewDepartments(database.Pool)
	departmentsHandler := api.NewDepartmentsHandler(departmentsSvc, cfg.Node.Domain, authMiddleware, database.Pool)
	nfcTerminalsSvc := payments.NewNFCTerminals(database.Pool, db.LOCAL_NODE_DOMAIN)

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
	nfcTerminalHandler.MultiSig = handler.MultiSig

	setupHandler := api.NewSetupHandler(database.Pool, accountsSvc, jwtSecret, cfg.Node.Domain, cfg.Node.Name)

	// Network handler (red privada federada con OpenWrt - opcional)
	networkHandler := api.NewNetworkHandler(database.Pool, cfg.Node.Domain)

	// Services handler (catalogo de servicios federados/autohospedados)
	federatedServicesHandler := api.NewFederatedServicesHandler(database.Pool, cfg.Node.Domain)

	router := api.NewRouterWithAuthAndBasePath(handler, authHandlers, federationHandler, orgHandler, paymentsHandler, externalHandler, recoveryHandler, departmentsHandler, nfcTerminalHandler, setupHandler, networkHandler, federatedServicesHandler, cfg.API.CORSOrigins, authMiddleware, database.Pool, demoBasePath, cfg)

	// Iniciar scheduler de notificaciones automaticas (avisos de votacion por cerrar, asambleas proximas)
	notifScheduler := api.NewNotificationScheduler(database.Pool, cfg.Node.Domain)
	notifScheduler.Start()
	defer notifScheduler.Stop()

	// Iniciar scheduler de cobros de mensualidades (servicios de organizaciones)
	subScheduler := api.NewSubscriptionScheduler(database.Pool, cfg.Node.Domain)
	subScheduler.Start()
	defer subScheduler.Stop()

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.API.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Node %s starting on port %d", cfg.Node.Name, cfg.API.Port)
		log.Printf("========================================")
		log.Printf("  Nodo:        http://localhost:%d", cfg.API.Port)
		log.Printf("  POS Web:     Instalar desde Servicios Federados en la plataforma")
		log.Printf("               (o descargar desde Servicios Federados > Punto de Venta Web)")
		log.Printf("========================================")
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

func (a *passkeyAdapter) BeginRegistration(userID uuid.UUID, username, displayName string, existingCreds [][]byte, rpID, rpName string) (interface{}, error) {
	return a.pm.BeginRegistration(userID, username, displayName, existingCreds, rpID, rpName)
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

func (a *passkeyAdapter) BeginLogin(credentialIDs [][]byte, rpID string) (interface{}, error) {
	return a.pm.BeginLogin(credentialIDs, rpID)
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
