package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

// Connect se conecta a la BD. Si el usuario/BD no existen, intenta crearlos
// conectandose como superusuario (yugabyte en YugabyteDB, postgres en PostgreSQL).
func Connect(ctx context.Context, connString string) (*DB, error) {
	// Intentar conectar normalmente
	pool, err := pgxpool.New(ctx, connString)
	if err == nil {
		if err = pool.Ping(ctx); err == nil {
			return &DB{Pool: pool}, nil
		}
		pool.Close()
	}

	// Si falla, intentar crear el rol y la BD como superusuario
	if err := ensureDatabaseExists(ctx, connString); err != nil {
		return nil, fmt.Errorf("pinging database: %w (tried auto-create: %v)", err, err)
	}

	// Reintentar conexion
	pool, err = pgxpool.New(ctx, connString)
	if err != nil {
		return nil, fmt.Errorf("connecting to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database after create: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// ensureDatabaseExists se conecta como superusuario y crea el rol y la BD si no existen.
func ensureDatabaseExists(ctx context.Context, connString string) error {
	// Parsear el conn string para extraer host, port, user, password, dbname
	// Conn string formato: postgres://user:pass@host:port/dbname?sslmode=...
	cfg, err := pgx.ParseConfig(connString)
	if err != nil {
		return fmt.Errorf("parse conn string: %w", err)
	}

	host := cfg.Host
	port := uint16(5433)
	if cfg.Port != 0 {
		port = cfg.Port
	}
	dbName := cfg.Database
	dbUser := cfg.User
	dbPass := cfg.Password

	// Conectar como superusuario (yugabyte sin password en YugabyteDB)
	adminConnStr := fmt.Sprintf("postgres://yugabyte@%s:%d/yugabyte?sslmode=disable", host, port)

	// Esperar a que la BD responda (hasta 60 segundos)
	var adminConn *pgx.Conn
	for i := 0; i < 30; i++ {
		adminConn, err = pgx.Connect(ctx, adminConnStr)
		if err == nil {
			break
		}
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		// Intentar con postgres como fallback
		adminConnStr = fmt.Sprintf("postgres://postgres@%s:%d/postgres?sslmode=disable", host, port)
		for i := 0; i < 10; i++ {
			adminConn, err = pgx.Connect(ctx, adminConnStr)
			if err == nil {
				break
			}
			time.Sleep(2 * time.Second)
		}
	}
	if err != nil {
		return fmt.Errorf("could not connect as admin: %w", err)
	}
	defer adminConn.Close(ctx)

	// Crear el rol si no existe
	createRoleSQL := fmt.Sprintf(
		"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '%s') THEN CREATE ROLE %s WITH LOGIN SUPERUSER PASSWORD '%s'; END IF; END $$;",
		dbUser, dbUser, dbPass,
	)
	if _, err := adminConn.Exec(ctx, createRoleSQL); err != nil {
		// Si DO $$ no funciona (YugabyteDB a veces no lo soporta), intentar directo
		_, _ = adminConn.Exec(ctx, fmt.Sprintf("CREATE ROLE %s WITH LOGIN SUPERUSER PASSWORD '%s';", dbUser, dbPass))
	}

	// Crear la BD si no existe (con colocation para reducir tabletas en YugabyteDB)
	var dbExists bool
	err = adminConn.QueryRow(ctx,
		"SELECT EXISTS(SELECT FROM pg_database WHERE datname = $1)", dbName).Scan(&dbExists)
	if err == nil && !dbExists {
		// COLOCATION = true hace que las tablas compartan una misma tableta,
		// reduciendo drasticamente el numero de tabletas del cluster.
		// Solo tablas grandes deben opt-out con WITH (COLOCATION = false).
		_, err = adminConn.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s WITH COLOCATION = true;", dbName))
		if err != nil {
			// Si COLOCATION no es soportado (PostgreSQL normal), crear sin colocation
			_, err = adminConn.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s;", dbName))
			if err != nil {
				return fmt.Errorf("create database: %w", err)
			}
		}
	}

	// Dar permisos al usuario sobre la BD
	_, _ = adminConn.Exec(ctx, fmt.Sprintf("GRANT ALL PRIVILEGES ON DATABASE %s TO %s;", dbName, dbUser))

	return nil
}

func (d *DB) Close() {
	if d.Pool != nil {
		d.Pool.Close()
	}
}

func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	// Crear tabla de tracking de migraciones si no existe
	_, err := d.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("creating schema_migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("reading migrations dir: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".sql" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		// Verificar si ya se ejecuto
		var exists bool
		err := d.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename = $1)`, file).Scan(&exists)
		if err != nil {
			return fmt.Errorf("checking migration %s: %w", file, err)
		}
		if exists {
			continue // Ya ejecutada, saltar
		}

		path := filepath.Join(migrationsDir, file)
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", file, err)
		}

		// Dividir el SQL en sentencias individuales y ejecutarlas una por una.
		// YugabyteDB no soporta reintentos en transacciones multi-statement
		// enviadas via el protocolo simple (error SQLSTATE 40001).
		// Ejecutar sentencia por sentencia permite que YugabyteDB reintente
		// automaticamente cada sentencia cuando hay conflictos de transaccion.
		statements := splitSQLStatements(string(content))
		if len(statements) == 0 {
			// Si no se pudieron dividir (o solo hay comentarios), ejecutar todo junto
			if err := execWithRetry(ctx, d.Pool, string(content), file, 0); err != nil {
				return fmt.Errorf("executing migration %s: %w", file, err)
			}
		} else {
			for i, stmt := range statements {
				stmt = strings.TrimSpace(stmt)
				if stmt == "" {
					continue
				}
				if err := execWithRetry(ctx, d.Pool, stmt, file, i); err != nil {
					return fmt.Errorf("executing migration %s (statement %d): %w", file, i+1, err)
				}
			}
		}

		// Marcar como ejecutada
		_, err = d.Pool.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, file)
		if err != nil {
			return fmt.Errorf("marking migration %s as done: %w", file, err)
		}

		log.Printf("Migration %s completed (%d statements)", file, len(statements))
	}

	return nil
}

// execWithRetry ejecuta una sentencia SQL con reintentos para conflictos
// de transaccion de YugabyteDB (SQLSTATE 40001).
func execWithRetry(ctx context.Context, pool *pgxpool.Pool, sql string, filename string, stmtNum int) error {
	maxRetries := 5
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		_, err := pool.Exec(ctx, sql)
		if err == nil {
			return nil
		}
		lastErr = err

		// Verificar si es un error de conflicto de transaccion (retryable)
		var pgErr *pgconn.PgError
		if !errorAs(err, &pgErr) {
			return err // No es un error de PG, no reintentar
		}

		// SQLSTATE 40001 = serialization conflict (retryable en YugabyteDB)
		// SQLSTATE 40P01 = deadlock detected (retryable)
		if pgErr.Code != "40001" && pgErr.Code != "40P01" {
			return err // No es retryable
		}

		// Esperar antes de reintentar (backoff exponencial)
		wait := time.Duration(attempt+1) * 200 * time.Millisecond
		time.Sleep(wait)
	}
	return fmt.Errorf("after %d retries (%s stmt %d): %w", maxRetries, filename, stmtNum, lastErr)
}

// splitSQLStatements divide un archivo SQL en sentencias individuales,
// respetando strings, dollar-quotes, comentarios y bloques DO $$.
func splitSQLStatements(sql string) []string {
	var statements []string
	var buf strings.Builder
	var current strings.Builder

	runes := []rune(sql)
	n := len(runes)
	i := 0

	for i < n {
		// Saltar espacios en blanco entre sentencias
		for i < n && (runes[i] == ' ' || runes[i] == '\t' || runes[i] == '\n' || runes[i] == '\r') {
			current.WriteRune(runes[i])
			i++
		}
		if i >= n {
			break
		}

		// Comentario de linea: -- ... \n
		if i+1 < n && runes[i] == '-' && runes[i+1] == '-' {
			for i < n && runes[i] != '\n' {
				current.WriteRune(runes[i])
				i++
			}
			continue
		}

		// Comentario de bloque: /* ... */
		if i+1 < n && runes[i] == '/' && runes[i+1] == '*' {
			current.WriteRune(runes[i])
			current.WriteRune(runes[i+1])
			i += 2
			for i+1 < n && !(runes[i] == '*' && runes[i+1] == '/') {
				current.WriteRune(runes[i])
				i++
			}
			if i+1 < n {
				current.WriteRune(runes[i])
				current.WriteRune(runes[i+1])
				i += 2
			}
			continue
		}

		// Dollar-quoted string: $tag$ ... $tag$ (incluye $$ ... $$)
		if runes[i] == '$' {
			// Intentar leer el tag completo: $tag$
			tagStart := i
			i++
			tagBuf := strings.Builder{}
			tagBuf.WriteRune('$')
			for i < n && runes[i] != '$' && ((runes[i] >= 'a' && runes[i] <= 'z') || (runes[i] >= 'A' && runes[i] <= 'Z') || (runes[i] >= '0' && runes[i] <= '9') || runes[i] == '_') {
				tagBuf.WriteRune(runes[i])
				i++
			}
			if i < n && runes[i] == '$' {
				tagBuf.WriteRune('$')
				tag := tagBuf.String()
				current.WriteString(tag)
				i++

				// Buscar el tag de cierre
				for i < n {
					if runes[i] == '$' {
						// Verificar si es el tag de cierre
						closeBuf := strings.Builder{}
						closeBuf.WriteRune('$')
						j := i + 1
						for j < n && runes[j] != '$' && ((runes[j] >= 'a' && runes[j] <= 'z') || (runes[j] >= 'A' && runes[j] <= 'Z') || (runes[j] >= '0' && runes[j] <= '9') || runes[j] == '_') {
							closeBuf.WriteRune(runes[j])
							j++
						}
						if j < n && runes[j] == '$' {
							closeBuf.WriteRune('$')
							if closeBuf.String() == tag {
								current.WriteString(closeBuf.String())
								i = j + 1
								break
							}
						}
					}
					current.WriteRune(runes[i])
					i++
				}
				continue
			}
			// No era un dollar-quote, restaurar
			i = tagStart
		}

		// Single-quoted string: ' ... ' (con '' como escape)
		if runes[i] == '\'' {
			current.WriteRune(runes[i])
			i++
			for i < n {
				if runes[i] == '\'' {
					if i+1 < n && runes[i+1] == '\'' {
						// Escape ''
						current.WriteRune('\'')
						current.WriteRune('\'')
						i += 2
						continue
					}
					// Cierre del string
					current.WriteRune('\'')
					i++
					break
				}
				current.WriteRune(runes[i])
				i++
			}
			continue
		}

		// Semicolon = fin de sentencia
		if runes[i] == ';' {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				buf.WriteString(stmt)
				statements = append(statements, buf.String())
				buf.Reset()
			}
			current.Reset()
			i++
			continue
		}

		current.WriteRune(runes[i])
		i++
	}

	// Ultima sentencia sin semicolon (si la hay)
	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}

// errorAs es un wrapper para errors.As que funciona con pgconn.PgError
func errorAs(err error, target interface{}) bool {
	if pgErr, ok := err.(*pgconn.PgError); ok {
		// target es **pgconn.PgError
		if t, ok := target.(**pgconn.PgError); ok {
			*t = pgErr
			return true
		}
	}
	return false
}

// LOCAL_NODE_DOMAIN es el valor fijo que se guarda en la base de datos
// para identificar los datos del nodo local. NUNCA se guarda el nombre
// real del dominio en las tablas de datos locales.
//
// Esto significa que si cambias el dominio del nodo, NO hay que migrar
// ningun dato: todos los datos locales siguen apuntando a __LOCAL__.
//
// El dominio real solo se guarda en node_config.node_domain (una sola
// fila) y se usa para federacion, URLs publicas, e identificarse ante
// otros nodos.
const LOCAL_NODE_DOMAIN = "__LOCAL__"

// ResolveNodeDomain devuelve el valor que se debe usar para guardar y
// buscar datos del nodo local en la base de datos.
//
// SIEMPRE devuelve LOCAL_NODE_DOMAIN ("__LOCAL__") para datos locales.
// No importa cual sea el dominio real del nodo, los datos locales se
// guardan con este valor fijo.
//
// Si el header trae un dominio de OTRO nodo (federacion), se devuelve
// ese dominio para que los datos federados se guarden con el dominio
// del nodo remoto correcto.
//
// Orden de resolucion:
//  1. Si headerDomain es un dominio remoto (no vacio y no el nuestro),
//     devolverlo tal cual (datos federados de otro nodo)
//  2. Para datos locales: devolver LOCAL_NODE_DOMAIN
func ResolveNodeDomain(ctx context.Context, pool *pgxpool.Pool, headerDomain, configDomain string) string {
	// Si el header trae un dominio, verificar si es el nuestro o un remoto
	if headerDomain != "" {
		// Obtener nuestro dominio real
		actual := ActualNodeDomain(ctx, pool, configDomain)
		// Si el header es nuestro dominio real, usar LOCAL
		if headerDomain == actual {
			return LOCAL_NODE_DOMAIN
		}
		// Si el header es localhost y no tenemos dominio configurado,
		// tambien es local
		if headerDomain == "localhost" && (actual == "" || actual == "localhost") {
			return LOCAL_NODE_DOMAIN
		}
		// Algunos clientes (ej: POS Android) pueden enviar host+path
		// (ej: "feria.loanstly.com/main"). El path no es parte del dominio.
		// Si el header empieza con el dominio real seguido de "/", tratar como local.
		if actual != "" && strings.HasPrefix(headerDomain, actual+"/") {
			return LOCAL_NODE_DOMAIN
		}
		// Si es un dominio diferente, es de otro nodo (federacion)
		// Devolverlo tal cual para guardar datos federados
		return headerDomain
	}
	// Sin header: es una operacion local
	return LOCAL_NODE_DOMAIN
}

// ActualNodeDomain devuelve el dominio REAL del nodo (ej: mi-aldea.org).
// Se usa para federacion, URLs publicas, e identificarse ante otros nodos.
// NO se usa para guardar datos locales (para eso se usa ResolveNodeDomain).
//
// Orden:
// 1. node_config (dominio real guardado al instalar)
// 2. configDomain (del config.yaml)
// 3. "" (vacio)
func ActualNodeDomain(ctx context.Context, pool *pgxpool.Pool, configDomain string) string {
	var domain string
	_ = pool.QueryRow(ctx, `SELECT node_domain FROM node_config WHERE initialized = true LIMIT 1`).Scan(&domain)
	if domain != "" {
		return domain
	}
	return configDomain
}

// MigrateDomainData convierte todos los datos que tienen el dominio real
// (o 'localhost') guardado en node_domain al valor fijo LOCAL_NODE_DOMAIN.
//
// Esta funcion se ejecuta UNA SOLA VEZ al actualizar el nodo, para
// corregir datos antiguos que se guardaron con el nombre literal del
// dominio. Despues de esta migracion, todos los datos locales usan
// __LOCAL__ y nunca mas habra que migrar nada si cambia el dominio.
//
// NO toca tablas de nodos remotos (node_federation_keys, discovered_nodes,
// etc.) porque esas tienen dominios de OTROS nodos.
func MigrateDomainData(ctx context.Context, pool *pgxpool.Pool) error {
	// Obtener el dominio real actual para saber que convertir
	actualDomain := ActualNodeDomain(ctx, pool, "")
	domainsToConvert := []string{}
	if actualDomain != "" && actualDomain != LOCAL_NODE_DOMAIN {
		domainsToConvert = append(domainsToConvert, actualDomain)
	}
	// Tambien convertir 'localhost' y 'default' que son dominios legacy
	domainsToConvert = append(domainsToConvert, "localhost", "default")

	// Tablas con columna node_domain que pertenecen al nodo local.
	// NO incluimos tablas de nodos remotos.
	tables := []struct {
		name   string
		column string
	}{
		{"users", "node_domain"},
		{"products", "node_domain"},
		{"transactions", "node_domain"},
		{"ledger_entries", "node_domain"},
		// NO incluimos node_config: esa tabla guarda el dominio real
		{"tax_config", "node_domain"},
		{"assembly_config", "node_domain"},
		{"assembly_quorum_config", "node_domain"},
		{"assembly_frequency_config", "node_domain"},
		{"assembly_sessions", "node_domain"},
		{"assembly_sessions_scoped", "node_domain"},
		{"assembly_decisions", "node_domain"},
		{"assembly_attendance", "node_domain"},
		{"assembly_notifications", "node_domain"},
		{"assembly_proposal_votes", "node_domain"},
		{"governance_rules", "node_domain"},
		{"public_settings", "node_domain"},
		{"public_pages", "node_domain"},
		{"energy_tariff", "node_domain"},
		{"member_levels", "node_domain"},
		{"organization_levels", "node_domain"},
		{"notification_gateway_config", "node_domain"},
		{"subscription_configs", "node_domain"},
		{"departments", "node_domain"},
		{"product_compositions", "node_domain"},
		{"assembly_quorum_config_scoped", "node_domain"},
		{"energy_tariff_changes", "node_domain"},
		{"scoped_assembly_proposals", "node_domain"},
		{"organization_board_members", "node_domain"},
		{"node_board_members", "node_domain"},
		{"node_expulsion_votes", "node_domain"},
		{"recovery_config", "node_domain"},
		{"external_currency_rates", "node_domain"},
		{"node_discovery_config", "node_domain"},
		{"calculator_categories", "node_domain"},
		{"calculator_parameters", "node_domain"},
		// NFC tables: deben usar LOCAL_NODE_DOMAIN como el resto
		{"nfc_terminals", "node_domain"},
		{"nfc_server_keys", "node_domain"},
		{"nfc_card_type_config", "node_domain"},
		{"nfc_card_keys", "node_domain"},
		{"terminal_pairing_requests", "node_domain"},
		{"card_key_rotations", "node_domain"},
	}

	migrated := 0
	for _, t := range tables {
		// Verificar si la tabla existe
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = $1 AND column_name = $2
			)`, t.name, t.column).Scan(&exists)
		if err != nil || !exists {
			continue
		}

		// Convertir cada dominio legacy a LOCAL_NODE_DOMAIN
		for _, oldDomain := range domainsToConvert {
			ct, err := pool.Exec(ctx,
				fmt.Sprintf(`UPDATE %s SET %s = $1 WHERE %s = $2`, t.name, t.column, t.column),
				LOCAL_NODE_DOMAIN, oldDomain)
			if err != nil {
				log.Printf("MigrateDomainData: error updating %s: %v", t.name, err)
				continue
			}
			if ct.RowsAffected() > 0 {
				migrated += int(ct.RowsAffected())
				log.Printf("MigrateDomainData: %s: %d rows '%s' -> '%s'", t.name, ct.RowsAffected(), oldDomain, LOCAL_NODE_DOMAIN)
			}
		}
	}

	log.Printf("MigrateDomainData: total %d rows converted to '%s'", migrated, LOCAL_NODE_DOMAIN)
	return nil
}
