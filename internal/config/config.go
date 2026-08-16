package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Node       NodeConfig       `yaml:"node"`
	Database   DatabaseConfig   `yaml:"database"`
	Federation FederationConfig `yaml:"federation"`
	Limits     LimitsConfig     `yaml:"limits"`
	Taxes      TaxesConfig      `yaml:"taxes"`
	Fund       FundConfig       `yaml:"fund"`
	API        APIConfig        `yaml:"api"`
}

type NodeConfig struct {
	Domain            string `yaml:"domain"`
	Name              string `yaml:"name"`
	PrivateKeyPath    string `yaml:"private_key_path"`
	CertificatePath   string `yaml:"certificate_path"`
	CACertificatePath string `yaml:"ca_certificate_path"`
}

type DatabaseConfig struct {
	Host        string `yaml:"host"`
	Port        int    `yaml:"port"`
	Name        string `yaml:"name"`
	User        string `yaml:"user"`
	Password    string `yaml:"password"`
	SSLMode     string `yaml:"ssl_mode"`
	SSLRootCert string `yaml:"ssl_root_cert"`
}

func (d DatabaseConfig) ConnString() string {
	if d.Password == "" {
		d.Password = os.Getenv("DB_PASSWORD")
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

type FederationConfig struct {
	ListenPort         int      `yaml:"listen_port"`
	MTLSRequired       bool     `yaml:"mtls_required"`
	KnownNodes         []string `yaml:"known_nodes"`
	GossipInterval     string   `yaml:"gossip_interval"`
	BalanceSyncEnabled bool     `yaml:"balance_sync_enabled"`
}

type LimitsConfig struct {
	NodeMultilateralNegative    int64 `yaml:"node_multilateral_negative"`
	NodeMultilateralPositive    int64 `yaml:"node_multilateral_positive"`
	DefaultIndividualNegative   int64 `yaml:"default_individual_negative"`
	DefaultIndividualPositive   int64 `yaml:"default_individual_positive"`
	DefaultOrganizationNegative int64 `yaml:"default_organization_negative"`
	DefaultOrganizationPositive int64 `yaml:"default_organization_positive"`
}

type TaxesConfig struct {
	Individual   IndividualTaxConfig   `yaml:"individual"`
	Organization OrganizationTaxConfig `yaml:"organization"`
}

type IndividualTaxConfig struct {
	Rate    float64 `yaml:"rate"`
	Enabled bool    `yaml:"enabled"`
}

type OrganizationTaxConfig struct {
	DefaultRate float64            `yaml:"default_rate"`
	ByType      map[string]float64 `yaml:"by_type"`
}

type FundConfig struct {
	AccountUsername     string   `yaml:"account_username"`
	MultisigRequired    int      `yaml:"multisig_required"`
	MultisigAuthorizers []string `yaml:"multisig_authorizers"`
}

type APIConfig struct {
	Port        int      `yaml:"port"`
	CORSOrigins []string `yaml:"cors_origins"`
	RateLimit   int      `yaml:"rate_limit"`
}

// defaultConfig retorna una configuracion segura por defecto.
// El servidor puede arrancar sin config.yaml y ser seguro.
// Los unicos campos vacios son node.name y node.domain, que se configuran
// en el setup wizard la primera vez.
func defaultConfig() *Config {
	// Generar una contraseña aleatoria segura para la BD si no hay una
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = generateSecureToken(24)
	}

	// Generar JWT secret aleatorio si no hay uno
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = generateSecureToken(32)
		// Lo guardamos en el entorno para que main.go lo use
		os.Setenv("JWT_SECRET", jwtSecret)
	}

	return &Config{
		Node: NodeConfig{
			Domain: "", // se configura en el setup wizard
			Name:   "", // se configura en el setup wizard
		},
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     5433,
			Name:     getEnvOrDefault("DB_NAME", "fmc_node"),
			User:     getEnvOrDefault("DB_USER", "fmc"),
			Password: dbPassword,
			SSLMode:  "disable",
		},
		Federation: FederationConfig{
			ListenPort:         8443,
			MTLSRequired:       true,
			KnownNodes:         []string{},
			GossipInterval:     "60s",
			BalanceSyncEnabled: true,
		},
		Limits: LimitsConfig{
			NodeMultilateralNegative:    -10000000,
			NodeMultilateralPositive:    10000000,
			DefaultIndividualNegative:   -50000,
			DefaultIndividualPositive:   50000,
			DefaultOrganizationNegative: -5000000,
			DefaultOrganizationPositive: 5000000,
		},
		Taxes: TaxesConfig{
			Individual: IndividualTaxConfig{
				Rate:    0.0,
				Enabled: false,
			},
			Organization: OrganizationTaxConfig{
				DefaultRate: 0.05,
				ByType: map[string]float64{
					"commerce":       0.05,
					"services":       0.03,
					"public_service": 0.0,
					"cooperative":    0.02,
				},
			},
		},
		Fund: FundConfig{
			AccountUsername:     "fund",
			MultisigRequired:    3,
			MultisigAuthorizers: []string{},
		},
		API: APIConfig{
			Port:        8080,
			CORSOrigins: []string{"http://localhost:3000", "http://localhost:8080"},
			RateLimit:   100,
		},
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// generateSecureToken genera un token hexadecimal aleatorio seguro.
func generateSecureToken(numBytes int) string {
	b := make([]byte, numBytes)
	if _, err := rand.Read(b); err != nil {
		// Fallback extremadamente improbable
		return strings.Repeat("x", numBytes*2)
	}
	return hex.EncodeToString(b)
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// No hay config.yaml — usar defaults seguros y arrancar.
			// El setup wizard configurara node.name y node.domain.
			cfg := defaultConfig()
			return cfg, nil
		}
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	// Aplicar defaults para campos vacios
	if cfg.API.Port == 0 {
		cfg.API.Port = 8080
	}
	if cfg.Federation.ListenPort == 0 {
		cfg.Federation.ListenPort = 8443
	}
	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5433
	}
	if cfg.Database.Host == "" {
		cfg.Database.Host = "localhost"
	}
	if cfg.Database.Name == "" {
		cfg.Database.Name = "fmc_node"
	}
	if cfg.Database.User == "" {
		cfg.Database.User = "fmc"
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Database.Password == "" {
		cfg.Database.Password = os.Getenv("DB_PASSWORD")
	}
	if len(cfg.API.CORSOrigins) == 0 {
		cfg.API.CORSOrigins = []string{"http://localhost:3000", "http://localhost:8080"}
	}

	// Defaults de limits si estan en cero
	if cfg.Limits.NodeMultilateralNegative == 0 {
		cfg.Limits.NodeMultilateralNegative = -10000000
	}
	if cfg.Limits.NodeMultilateralPositive == 0 {
		cfg.Limits.NodeMultilateralPositive = 10000000
	}
	if cfg.Limits.DefaultIndividualNegative == 0 {
		cfg.Limits.DefaultIndividualNegative = -50000
	}
	if cfg.Limits.DefaultIndividualPositive == 0 {
		cfg.Limits.DefaultIndividualPositive = 50000
	}
	if cfg.Limits.DefaultOrganizationNegative == 0 {
		cfg.Limits.DefaultOrganizationNegative = -5000000
	}
	if cfg.Limits.DefaultOrganizationPositive == 0 {
		cfg.Limits.DefaultOrganizationPositive = 5000000
	}

	// Defaults de taxes
	if cfg.Taxes.Organization.DefaultRate == 0 {
		cfg.Taxes.Organization.DefaultRate = 0.05
	}
	if cfg.Taxes.Organization.ByType == nil {
		cfg.Taxes.Organization.ByType = map[string]float64{
			"commerce":       0.05,
			"services":       0.03,
			"public_service": 0.0,
			"cooperative":    0.02,
		}
	}

	return &cfg, nil
}
