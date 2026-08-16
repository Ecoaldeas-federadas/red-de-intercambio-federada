package config

import (
	"fmt"
	"os"

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
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	Name         string `yaml:"name"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	SSLMode      string `yaml:"ssl_mode"`
	SSLRootCert  string `yaml:"ssl_root_cert"`
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
	NodeMultilateralNegative     int64 `yaml:"node_multilateral_negative"`
	NodeMultilateralPositive     int64 `yaml:"node_multilateral_positive"`
	DefaultIndividualNegative    int64 `yaml:"default_individual_negative"`
	DefaultIndividualPositive    int64 `yaml:"default_individual_positive"`
	DefaultOrganizationNegative  int64 `yaml:"default_organization_negative"`
	DefaultOrganizationPositive  int64 `yaml:"default_organization_positive"`
}

type TaxesConfig struct {
	Individual    IndividualTaxConfig     `yaml:"individual"`
	Organization  OrganizationTaxConfig   `yaml:"organization"`
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
	AccountUsername    string   `yaml:"account_username"`
	MultisigRequired   int      `yaml:"multisig_required"`
	MultisigAuthorizers []string `yaml:"multisig_authorizers"`
}

type APIConfig struct {
	Port        int      `yaml:"port"`
	CORSOrigins []string `yaml:"cors_origins"`
	RateLimit   int      `yaml:"rate_limit"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	if cfg.API.Port == 0 {
		cfg.API.Port = 8080
	}
	if cfg.Federation.ListenPort == 0 {
		cfg.Federation.ListenPort = 8443
	}
	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5433
	}

	return &cfg, nil
}
