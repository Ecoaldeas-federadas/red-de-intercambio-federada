package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
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

		_, err = d.Pool.Exec(ctx, string(content))
		if err != nil {
			return fmt.Errorf("executing migration %s: %w", file, err)
		}

		// Marcar como ejecutada
		_, err = d.Pool.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, file)
		if err != nil {
			return fmt.Errorf("marking migration %s as done: %w", file, err)
		}
	}

	return nil
}
