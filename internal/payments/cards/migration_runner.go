// Package cards — migration_runner.go
//
// Ejecuta migraciones SQL de paquetes .nfcpkg en una transaccion.
// Solo permite DDL (CREATE, ALTER, CREATE INDEX).
// Si cualquier statement falla, se hace rollback completo.

package cards

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// forbiddenStatements son statements que NO se permiten en migraciones de drivers.
// Solo se permite DDL (CREATE, ALTER, CREATE INDEX, DROP IF EXISTS de tablas propias).
var forbiddenStatements = []string{
	"INSERT", "UPDATE", "DELETE", "TRUNCATE", "COPY",
	"GRANT", "REVOKE", "ALTER ROLE", "ALTER SYSTEM",
	"CREATE ROLE", "DROP ROLE", "CREATE USER", "DROP USER",
	"SELECT INTO", "MERGE",
}

// allowedDDLPatterns son patrones de DDL permitidos.
var allowedDDLPatterns = regexp.MustCompile(`(?i)^\s*(CREATE\s+(TABLE|INDEX|UNIQUE)|ALTER\s+TABLE|DROP\s+(TABLE|INDEX)\s+IF\s+EXISTS)`)

// RunMigration ejecuta una migracion SQL en una transaccion.
// Solo permite DDL. Si falla, hace rollback.
func RunMigration(ctx context.Context, pool *pgxpool.Pool, migrationSQL string) error {
	if migrationSQL == "" {
		return nil // nada que hacer
	}

	// Validar que no hay statements prohibidos
	if err := validateMigration(migrationSQL); err != nil {
		return err
	}

	// Dividir en statements individuales (split por ;)
	statements := splitSQLStatements(migrationSQL)
	if len(statements) == 0 {
		return nil
	}

	// Ejecutar en transaccion
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciando transaccion: %w", err)
	}
	defer tx.Rollback(ctx)

	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("statement %d fallo (rollback automatico): %w\nSQL: %s", i+1, err, truncate(stmt, 200))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commitando migracion: %w", err)
	}

	return nil
}

// validateMigration verifica que el SQL solo contiene DDL permitido.
func validateMigration(sql string) error {
	statements := splitSQLStatements(sql)
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		// Verificar que empieza con DDL permitido
		if !allowedDDLPatterns.MatchString(stmt) {
			return fmt.Errorf("statement %d no es DDL permitido (solo CREATE/ALTER/DROP): %s", i+1, truncate(stmt, 100))
		}

		// Verificar que no contiene statements prohibidos
		upperStmt := strings.ToUpper(stmt)
		for _, forbidden := range forbiddenStatements {
			if strings.Contains(upperStmt, forbidden) {
				return fmt.Errorf("statement %d contiene '%s' que no esta permitido en migraciones de drivers", i+1, forbidden)
			}
		}
	}
	return nil
}

// splitSQLStatements divide SQL en statements individuales por ;
// Respetando strings y comentarios.
func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	inLineComment := false
	inBlockComment := false

	for i := 0; i < len(sql); i++ {
		ch := sql[i]
		next := byte(0)
		if i+1 < len(sql) {
			next = sql[i+1]
		}

		switch {
		case inLineComment:
			current.WriteByte(ch)
			if ch == '\n' {
				inLineComment = false
			}
		case inBlockComment:
			current.WriteByte(ch)
			if ch == '*' && next == '/' {
				current.WriteByte(next)
				i++
				inBlockComment = false
			}
		case inSingleQuote:
			current.WriteByte(ch)
			if ch == '\'' {
				inSingleQuote = false
			}
		case inDoubleQuote:
			current.WriteByte(ch)
			if ch == '"' {
				inDoubleQuote = false
			}
		default:
			if ch == '-' && next == '-' {
				inLineComment = true
				current.WriteByte(ch)
				current.WriteByte(next)
				i++
			} else if ch == '/' && next == '*' {
				inBlockComment = true
				current.WriteByte(ch)
				current.WriteByte(next)
				i++
			} else if ch == '\'' {
				inSingleQuote = true
				current.WriteByte(ch)
			} else if ch == '"' {
				inDoubleQuote = true
				current.WriteByte(ch)
			} else if ch == ';' {
				stmt := strings.TrimSpace(current.String())
				if stmt != "" {
					statements = append(statements, stmt)
				}
				current.Reset()
			} else {
				current.WriteByte(ch)
			}
		}
	}

	// Ultimo statement sin ;
	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
