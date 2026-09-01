// Package cards — sandbox.go
//
// Sandbox JavaScript (Goja) para ejecutar drivers NFC dinamicos (.nfcpkg).
// El sandbox expone una API limitada y segura: db, crypto, bcrypt, log.
// No hay acceso a filesystem, red, os, eval, ni require.
// Timeout de 5 segundos por ejecucion. Memoria limitada.

package cards

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/dop251/goja"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SandboxTimeout es el tiempo maximo de ejecucion de un driver.
const SandboxTimeout = 5 * time.Second

// SandboxMaxMemory es el limite de memoria del runtime Goja (en bytes).
const SandboxMaxMemory = 16 * 1024 * 1024 // 16MB

// SandboxDB es la interfaz de base de datos expuesta al driver JS.
type SandboxDB struct {
	pool       *pgxpool.Pool
	nodeDomain string
}

// SandboxCrypto es la interfaz criptografica expuesta al driver JS.
type SandboxCrypto struct{}

// SandboxBcrypt es la interfaz de hashing expuesta al driver JS.
type SandboxBcrypt struct{}

// SandboxContext es el objeto "ctx" que se pasa al driver JS.
type SandboxContext struct {
	DB         *SandboxDB
	Crypto     *SandboxCrypto
	Bcrypt     *SandboxBcrypt
	NodeDomain string
	TerminalID string
}

// CompiledDriver es un driver JS compilado y cacheado.
type CompiledDriver struct {
	Program *goja.Program
}

// driverCache cachea drivers compilados por tipo.
var (
	driverCacheMu sync.RWMutex
	driverCache   = map[string]*CompiledDriver{}
)

// CompileDriver compila driver.js y lo cachea.
// Se llama una vez al instalar un driver.
func CompileDriver(cardType, driverSource string) (*CompiledDriver, error) {
	program, err := goja.Compile("driver.js", driverSource, false)
	if err != nil {
		return nil, fmt.Errorf("compilando driver.js: %w", err)
	}

	cd := &CompiledDriver{
		Program: program,
	}
	driverCacheMu.Lock()
	driverCache[cardType] = cd
	driverCacheMu.Unlock()
	return cd, nil
}

// GetCompiledDriver retorna el driver compilado del cache, o nil.
func GetCompiledDriver(cardType string) *CompiledDriver {
	driverCacheMu.RLock()
	defer driverCacheMu.RUnlock()
	return driverCache[cardType]
}

// RemoveCompiledDriver elimina un driver del cache.
func RemoveCompiledDriver(cardType string) {
	driverCacheMu.Lock()
	delete(driverCache, cardType)
	driverCacheMu.Unlock()
}

// callMethod ejecuta un metodo de NfcDriver en el sandbox con timeout.
// Crea un runtime nuevo cada vez (para aislar ejecuciones).
func callMethod(
	ctx context.Context,
	cardType, driverSource, methodName string,
	prepareCtx func(runtime *goja.Runtime, sandboxCtx *SandboxContext),
	args []func(runtime *goja.Runtime) goja.Value,
) (interface{}, error) {
	runtime := goja.New()

	// Compilar si no esta en cache
	cd := GetCompiledDriver(cardType)
	if cd == nil {
		var err error
		cd, err = CompileDriver(cardType, driverSource)
		if err != nil {
			return nil, err
		}
	}

	// Ejecutar el programa para definir NfcDriver
	if _, err := runtime.RunProgram(cd.Program); err != nil {
		return nil, fmt.Errorf("ejecutando driver.js: %w", err)
	}

	// Obtener el objeto NfcDriver
	nfcDriver := runtime.Get("NfcDriver")
	if nfcDriver == nil || goja.IsUndefined(nfcDriver) {
		return nil, fmt.Errorf("driver.js no define el objeto NfcDriver")
	}

	driverObj := nfcDriver.ToObject(runtime)

	// Obtener el metodo
	methodVal := driverObj.Get(methodName)
	if methodVal == nil || goja.IsUndefined(methodVal) {
		return nil, fmt.Errorf("NfcDriver.%s no esta definido", methodName)
	}

	// Asegurar que es una funcion
	method, ok := goja.AssertFunction(methodVal)
	if !ok {
		return nil, fmt.Errorf("NfcDriver.%s no es una funcion", methodName)
	}

	// Crear y exponer el contexto del sandbox
	sandboxCtx := &SandboxContext{
		DB:     &SandboxDB{},
		Crypto: &SandboxCrypto{},
		Bcrypt: &SandboxBcrypt{},
	}
	if prepareCtx != nil {
		prepareCtx(runtime, sandboxCtx)
	}
	runtime.Set("ctx", sandboxCtx)

	// Convertir args
	gojaArgs := make([]goja.Value, len(args))
	for i, argFn := range args {
		gojaArgs[i] = argFn(runtime)
	}

	// Timeout
	ctx, cancel := context.WithTimeout(ctx, SandboxTimeout)
	defer cancel()

	done := make(chan struct{})
	var result interface{}
	var execErr error

	go func() {
		defer close(done)
		defer func() {
			if r := recover(); r != nil {
				execErr = fmt.Errorf("panic en driver: %v", r)
			}
		}()

		callResult, err := method(nfcDriver, gojaArgs...)
		if err != nil {
			execErr = fmt.Errorf("NfcDriver.%s: %w", methodName, err)
			return
		}
		result = gojaToInterface(callResult)
	}()

	select {
	case <-done:
		return result, execErr
	case <-ctx.Done():
		runtime.Interrupt("timeout")
		return nil, fmt.Errorf("timeout: NfcDriver.%s excedio %v", methodName, SandboxTimeout)
	}
}

// gojaToInterface convierte un valor Goja a interface{} de Go.
func gojaToInterface(v goja.Value) interface{} {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	return v.Export()
}

// ===== SandboxDB =====
// Expone db.queryOne(query, args) y db.execute(query, args) al driver JS.

// QueryOne ejecuta una query que retorna una fila.
// Retorna un objeto JS con las columnas, o null si no hay resultado.
func (db *SandboxDB) QueryOne(query string, args []interface{}) map[string]interface{} {
	if db.pool == nil {
		return nil
	}
	rows, err := db.pool.Query(context.Background(), query, args...)
	if err != nil {
		log.Printf("sandbox db.queryOne error: %v", err)
		return nil
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	if rows.Next() {
		values, err := rows.Values()
		if err != nil {
			log.Printf("sandbox db.queryOne scan error: %v", err)
			return nil
		}
		result := make(map[string]interface{})
		for i, field := range fields {
			result[field.Name] = values[i]
		}
		return result
	}
	return nil
}

// Execute ejecuta una query que no retorna filas (INSERT, UPDATE, DELETE).
func (db *SandboxDB) Execute(query string, args []interface{}) {
	if db.pool == nil {
		return
	}
	_, err := db.pool.Exec(context.Background(), query, args...)
	if err != nil {
		log.Printf("sandbox db.execute error: %v", err)
	}
}

// GetPinHash retorna el hash de PIN de un usuario.
func (db *SandboxDB) GetPinHash(userID string) string {
	if db.pool == nil {
		return ""
	}
	var pinHash string
	err := db.pool.QueryRow(context.Background(),
		"SELECT pin_hash FROM nfc_cards WHERE user_id = $1 AND is_active = true ORDER BY issued_at DESC LIMIT 1",
		userID).Scan(&pinHash)
	if err != nil {
		return ""
	}
	return pinHash
}

// SetPool configura el pool de DB (se llama antes de ejecutar el driver).
func (db *SandboxDB) SetPool(pool *pgxpool.Pool, nodeDomain string) {
	db.pool = pool
	db.nodeDomain = nodeDomain
}

// ===== SandboxCrypto =====
// Expone crypto.randomBytes(n), crypto.toHex(bytes), crypto.uuid(), etc.

// RandomBytes genera n bytes aleatorios.
func (c *SandboxCrypto) RandomBytes(n int) []byte {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return buf
}

// ToHex convierte bytes a string hex.
func (c *SandboxCrypto) ToHex(b []byte) string {
	return hex.EncodeToString(b)
}

// FromHex convierte string hex a bytes.
func (c *SandboxCrypto) FromHex(s string) []byte {
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil
	}
	return b
}

// UUID genera un UUID v4.
func (c *SandboxCrypto) UUID() string {
	return uuid.New().String()
}

// Hash calcula SHA256 de los datos.
func (c *SandboxCrypto) Hash(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}

// HashHex calcula SHA256 y retorna hex.
func (c *SandboxCrypto) HashHex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// ===== SandboxBcrypt =====
// Expone bcrypt.hash(password) y bcrypt.verify(password, hash).

// Hash hashea un password con bcrypt.
func (b *SandboxBcrypt) Hash(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return ""
	}
	return string(hash)
}

// Verify verifica un password contra un hash bcrypt.
func (b *SandboxBcrypt) Verify(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// ===== Funciones de ejecucion de metodos del driver =====

// ExecuteDriverProvision ejecuta NfcDriver.provision() en el sandbox.
func ExecuteDriverProvision(
	ctx context.Context,
	cardType, driverSource string,
	pool *pgxpool.Pool,
	nodeDomain string,
	userID, cardUID, initialPIN string,
) (interface{}, error) {
	return callMethod(ctx, cardType, driverSource, "provision",
		func(runtime *goja.Runtime, sandboxCtx *SandboxContext) {
			sandboxCtx.NodeDomain = nodeDomain
			sandboxCtx.DB.SetPool(pool, nodeDomain)
		},
		[]func(runtime *goja.Runtime) goja.Value{
			func(r *goja.Runtime) goja.Value { return r.ToValue(userID) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(cardUID) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(initialPIN) },
		},
	)
}

// ExecuteDriverPreAuth ejecuta NfcDriver.preAuth() en el sandbox.
func ExecuteDriverPreAuth(
	ctx context.Context,
	cardType, driverSource string,
	pool *pgxpool.Pool,
	nodeDomain, terminalID, username, pin string,
	amount int64,
) (interface{}, error) {
	return callMethod(ctx, cardType, driverSource, "preAuth",
		func(runtime *goja.Runtime, sandboxCtx *SandboxContext) {
			sandboxCtx.NodeDomain = nodeDomain
			sandboxCtx.TerminalID = terminalID
			sandboxCtx.DB.SetPool(pool, nodeDomain)
		},
		[]func(runtime *goja.Runtime) goja.Value{
			func(r *goja.Runtime) goja.Value { return r.ToValue(username) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(pin) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(amount) },
		},
	)
}

// ExecuteDriverConfirm ejecuta NfcDriver.confirm() en el sandbox.
func ExecuteDriverConfirm(
	ctx context.Context,
	cardType, driverSource string,
	pool *pgxpool.Pool,
	nodeDomain, terminalID, cardUID string,
	readOK, writeOK bool,
	writtenPages int,
) (interface{}, error) {
	return callMethod(ctx, cardType, driverSource, "confirm",
		func(runtime *goja.Runtime, sandboxCtx *SandboxContext) {
			sandboxCtx.NodeDomain = nodeDomain
			sandboxCtx.TerminalID = terminalID
			sandboxCtx.DB.SetPool(pool, nodeDomain)
		},
		[]func(runtime *goja.Runtime) goja.Value{
			func(r *goja.Runtime) goja.Value { return r.ToValue(cardUID) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(readOK) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(writeOK) },
			func(r *goja.Runtime) goja.Value { return r.ToValue(writtenPages) },
		},
	)
}

// ExecuteDriverCleanupExpired ejecuta NfcDriver.cleanupExpired() en el sandbox.
func ExecuteDriverCleanupExpired(
	ctx context.Context,
	cardType, driverSource string,
	pool *pgxpool.Pool,
	nodeDomain string,
) error {
	_, err := callMethod(ctx, cardType, driverSource, "cleanupExpired",
		func(runtime *goja.Runtime, sandboxCtx *SandboxContext) {
			sandboxCtx.NodeDomain = nodeDomain
			sandboxCtx.DB.SetPool(pool, nodeDomain)
		},
		nil,
	)
	return err
}

// ValidateDriverSource verifica que driver.js define NfcDriver con los 4 metodos.
func ValidateDriverSource(driverSource string) error {
	runtime := goja.New()
	program, err := goja.Compile("driver.js", driverSource, false)
	if err != nil {
		return fmt.Errorf("error de sintaxis: %w", err)
	}
	if _, err := runtime.RunProgram(program); err != nil {
		return fmt.Errorf("error ejecutando: %w", err)
	}

	nfcDriver := runtime.Get("NfcDriver")
	if nfcDriver == nil || goja.IsUndefined(nfcDriver) {
		return fmt.Errorf("no define el objeto NfcDriver")
	}

	obj := nfcDriver.ToObject(runtime)
	required := []string{"provision", "preAuth", "confirm", "cleanupExpired"}
	for _, methodName := range required {
		m := obj.Get(methodName)
		if m == nil || goja.IsUndefined(m) {
			return fmt.Errorf("NfcDriver.%s no esta definido", methodName)
		}
		if _, ok := goja.AssertFunction(m); !ok {
			return fmt.Errorf("NfcDriver.%s no es una funcion", methodName)
		}
	}

	// Verificar type
	typeVal := obj.Get("type")
	if typeVal == nil || goja.IsUndefined(typeVal) {
		return fmt.Errorf("NfcDriver.type no esta definido")
	}

	return nil
}
