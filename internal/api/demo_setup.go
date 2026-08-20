package api

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// DemoAutoSetup configura automaticamente un nodo demo sin necesidad del wizard.
// Crea: admin demo, niveles de miembro, departamentos, roles, node_config.
// No toca ningun otro dominio - solo configura el dominio demo.
func DemoAutoSetup(ctx context.Context, db *pgxpool.Pool, jwtSecret, nodeDomain, nodeName string) error {
	log.Println("Demo: running auto-setup for domain:", nodeDomain)

	// 0. Limpiar datos viejos del dominio demo (por si acaso)
	// Esto asegura que un reset siempre empiece limpio
	tables := []string{"transactions", "governance_rules", "role_permissions", "roles",
		"departments", "organizations", "user_credentials", "users", "products",
		"member_levels", "public_pages", "node_config"}
	for _, t := range tables {
		db.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE node_domain = $1", t))
	}
	// Tambien borrar paginas viejas con node_domain = "localhost" que pudo haber
	// sembrado el codigo viejo en la BD fmc_demo
	db.Exec(ctx, `DELETE FROM public_pages WHERE node_domain = 'localhost'`)
	db.Exec(ctx, `DELETE FROM member_levels WHERE node_domain = 'localhost'`)
	db.Exec(ctx, `DELETE FROM products WHERE node_domain = 'localhost'`)
	db.Exec(ctx, `DELETE FROM users WHERE node_domain = 'localhost'`)
	db.Exec(ctx, `DELETE FROM node_config WHERE node_domain = 'localhost'`)
	log.Println("Demo: cleaned old data")

	// 1. Copiar niveles de miembro desde default/localhost
	var levelCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM member_levels WHERE node_domain = $1`, nodeDomain).Scan(&levelCount)
	if levelCount == 0 {
		sourceDomain := ""
		for _, candidate := range []string{"default", "localhost"} {
			var c int
			db.QueryRow(ctx, `SELECT COUNT(*) FROM member_levels WHERE node_domain = $1`, candidate).Scan(&c)
			if c > 0 {
				sourceDomain = candidate
				break
			}
		}
		if sourceDomain != "" {
			db.Exec(ctx, `
				INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
					credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
					auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
					can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
					can_request_limit_increase, is_system, is_active)
				SELECT gen_random_uuid(), $1, name, description, level, has_voice, has_vote, counts_in_quorum,
					credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
					auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
					can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
					can_request_limit_increase, is_system, is_active
				FROM member_levels WHERE node_domain = $2`,
				nodeDomain, sourceDomain)
		}
	}

	// 2. Generar claves Ed25519 para el admin demo
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return fmt.Errorf("demo: failed to generate keypair: %w", err)
	}
	pubKeyHex := hex.EncodeToString(pubKey)

	encryptedPrivKey, err := encryptPrivateKey(privKey, "demo1234")
	if err != nil {
		return fmt.Errorf("demo: failed to encrypt key: %w", err)
	}

	salt := make([]byte, 16)
	rand.Read(salt)

	// 3. Obtener nivel mas alto para el admin
	var memberLevelID string
	db.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&memberLevelID)
	if memberLevelID == "" {
		memberLevelID = uuid.New().String()
		db.Exec(ctx, `
			INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, credit_limit, debit_limit)
			VALUES ($1, $2, 'Admin', 'Administrator', 99, true, true, true, 1000000, 1000000)`,
			memberLevelID, nodeDomain)
	}

	// 4. Crear usuario admin demo
	var adminUserID uuid.UUID
	err = db.QueryRow(ctx, `
		INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, membership_status, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
		VALUES ($1, 'demo', 'Usuario Demo', 'individual', $2, 'active', 500, 500, $3, $4, $5)
		ON CONFLICT DO NOTHING
		RETURNING id`,
		nodeDomain, memberLevelID, pubKeyHex, encryptedPrivKey, salt).Scan(&adminUserID)
	if err != nil {
		// Ya existe, obtener el ID
		db.QueryRow(ctx, `SELECT id FROM users WHERE username = 'demo' AND node_domain = $1`, nodeDomain).Scan(&adminUserID)
	}
	if adminUserID == uuid.Nil {
		return fmt.Errorf("demo: could not create or find demo user")
	}

	// Marcar como super admin
	db.Exec(ctx, `UPDATE users SET is_super_admin = true, super_admin_enabled = true WHERE id = $1`, adminUserID)

	// 5. Crear credencial (password)
	pinHash, _ := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)
	db.Exec(ctx, `
		INSERT INTO user_credentials (user_id, password_hash, created_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id) DO UPDATE SET password_hash = $2`,
		adminUserID, pinHash)

	// 6. Crear departamento y rol admin
	deptID := uuid.New()
	db.Exec(ctx, `
		INSERT INTO departments (id, name, description, group_type, is_active, created_at)
		VALUES ($1, 'Administracion Demo', 'Departamento demo', 'department', true, NOW())
		ON CONFLICT DO NOTHING`, deptID)

	roleID := uuid.New()
	db.Exec(ctx, `
		INSERT INTO roles (id, department_id, name, description, is_active, created_at)
		VALUES ($1, $2, 'Administrador Demo', 'Rol admin demo', true, NOW())
		ON CONFLICT DO NOTHING`, roleID, deptID)

	db.Exec(ctx, `
		INSERT INTO department_members (id, department_id, user_id, role_id, joined_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT DO NOTHING`, uuid.New(), deptID, adminUserID, roleID)

	// Asignar todos los permisos al rol
	rows, err := db.Query(ctx, `SELECT id FROM permissions`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pid uuid.UUID
			rows.Scan(&pid)
			db.Exec(ctx, `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, roleID, pid)
		}
	}

	// 7. Generar claves del nodo para federacion
	nodePubKey, nodePrivKey, _ := ed25519.GenerateKey(rand.Reader)
	nodePubKeyHex := hex.EncodeToString(nodePubKey)
	encryptedNodePrivKey, _ := encryptPrivateKey(nodePrivKey, "demo1234")

	// 8. Guardar node_config
	_, err = db.Exec(ctx, `
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
		return fmt.Errorf("demo: failed to save node config: %w", err)
	}

	// 9. Habilitar usuario demo en demo_user_config
	db.Exec(ctx, `UPDATE demo_user_config SET is_enabled = true`)

	log.Println("Demo: auto-setup completed. Admin user: demo / demo1234")
	return nil
}
