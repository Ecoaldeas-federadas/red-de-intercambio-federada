package federation

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Gossip struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	Interval   time.Duration
}

func NewGossip(pool *pgxpool.Pool, nodeDomain string, interval time.Duration) *Gossip {
	return &Gossip{
		Pool:       pool,
		NodeDomain: nodeDomain,
		Interval:   interval,
	}
}

func (g *Gossip) Start(ctx context.Context) {
	ticker := time.NewTicker(g.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			g.syncBalances(ctx)
			g.syncBilateralLimits(ctx)
		}
	}
}

func (g *Gossip) syncBalances(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT remote_node, balance, last_hash FROM node_balance`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var remoteNode string
		var balance int64
		var lastHash *string
		_ = rows.Scan(&remoteNode, &balance, &lastHash)
	}
}

func (g *Gossip) syncBilateralLimits(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT local_node, remote_node, credit_limit, debit_limit, is_customized, local_approved, remote_confirmed
		 FROM bilateral_limits WHERE is_active = true`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var localNode, remoteNode string
		var creditLimit, debitLimit int64
		var isCustomized, localApproved, remoteConfirmed bool
		_ = rows.Scan(&localNode, &remoteNode, &creditLimit, &debitLimit, &isCustomized, &localApproved, &remoteConfirmed)
	}
}

type ParityReport struct {
	RemoteNode      string  `json:"remote_node"`
	Imports         int64   `json:"imports"`
	Exports         int64   `json:"exports"`
	Balance         int64   `json:"balance"`
	ImportPctOfLimit float64 `json:"import_pct_of_limit"`
	ExportPctOfLimit float64 `json:"export_pct_of_limit"`
	HasParity       bool    `json:"has_parity"`
	Suggestion      string  `json:"suggestion"`
}

func (g *Gossip) GetParityReport(ctx context.Context, remoteNode string) (*ParityReport, error) {
	var imports, exports int64

	rows, err := g.Pool.Query(ctx, `
		SELECT 
			CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END as imports,
			CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END as exports
		FROM ledger_entries 
		WHERE account_category = 'node_bridge' AND counterpart_node = $1`,
		remoteNode,
	)
	if err != nil {
		return nil, fmt.Errorf("querying parity: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var imp, exp int64
		_ = rows.Scan(&imp, &exp)
		imports += imp
		exports += exp
	}

	var creditLimit int64
	err = g.Pool.QueryRow(ctx,
		`SELECT COALESCE(credit_limit, 0) FROM bilateral_limits WHERE local_node = $1 AND remote_node = $2 AND is_active = true`,
		g.NodeDomain, remoteNode,
	).Scan(&creditLimit)
	if err != nil {
		var baseLimit int64
		_ = g.Pool.QueryRow(ctx,
			`SELECT node_bilateral_base_limit FROM federation_global_config ORDER BY id DESC LIMIT 1`,
		).Scan(&baseLimit)
		creditLimit = baseLimit
	}

	importPct := 0.0
	exportPct := 0.0
	if creditLimit > 0 {
		importPct = float64(imports) / float64(creditLimit) * 100
		exportPct = float64(exports) / float64(creditLimit) * 100
	}

	var parityThreshold int
	_ = g.Pool.QueryRow(ctx,
		`SELECT parity_suggestion_threshold FROM federation_global_config ORDER BY id DESC LIMIT 1`,
	).Scan(&parityThreshold)
	if parityThreshold == 0 {
		parityThreshold = 80
	}

	hasParity := importPct > float64(parityThreshold) && exportPct > float64(parityThreshold)

	suggestion := ""
	if hasParity {
		suggestion = "Paridad alta detectada: se sugiere aumentar el limite bilateral en la asamblea"
	} else if importPct > float64(parityThreshold) && exportPct < float64(parityThreshold)/2 {
		suggestion = "Disparidad detectada: alto import, bajo export. No se recomienda aumentar el limite"
	}

	return &ParityReport{
		RemoteNode:       remoteNode,
		Imports:          imports,
		Exports:          exports,
		Balance:          exports - imports,
		ImportPctOfLimit: importPct,
		ExportPctOfLimit: exportPct,
		HasParity:        hasParity,
		Suggestion:       suggestion,
	}, nil
}

type Warning struct {
	RemoteNode string `json:"remote_node"`
	LimitType  string `json:"limit_type"`
	UsagePct   float64 `json:"usage_pct"`
	Threshold  int    `json:"threshold"`
	Message    string `json:"message"`
}

func (g *Gossip) GetActiveWarnings(ctx context.Context) ([]Warning, error) {
	var warnings []Warning

	cfg, err := g.getFederationConfig(ctx)
	if err != nil {
		return nil, err
	}

	thresholds := []int{cfg.WarningThreshold1, cfg.WarningThreshold2, cfg.WarningThreshold3}

	rows, err := g.Pool.Query(ctx,
		`SELECT remote_node, balance FROM node_balance`,
	)
	if err != nil {
		return nil, fmt.Errorf("querying node balances: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var remoteNode string
		var balance int64
		_ = rows.Scan(&remoteNode, &balance)

		var creditLimit int64
		err = g.Pool.QueryRow(ctx,
			`SELECT COALESCE(credit_limit, 0) FROM bilateral_limits WHERE local_node = $1 AND remote_node = $2 AND is_active = true`,
			g.NodeDomain, remoteNode,
		).Scan(&creditLimit)
		if err != nil {
			creditLimit = cfg.NodeBilateralBaseLimit
		}

		if creditLimit > 0 {
			usagePct := float64(balance) / float64(creditLimit) * 100
			for _, threshold := range thresholds {
				if usagePct >= float64(threshold) {
					warnings = append(warnings, Warning{
						RemoteNode: remoteNode,
						LimitType:  "bilateral",
						UsagePct:   usagePct,
						Threshold:  threshold,
						Message:    fmt.Sprintf("Nodo %s al %.1f%% del limite bilateral (%d%%)", remoteNode, usagePct, threshold),
					})
					break
				}
			}
		}
	}

	return warnings, nil
}

type federationConfig struct {
	NodeBilateralBaseLimit   int64
	WarningThreshold1        int
	WarningThreshold2        int
	WarningThreshold3        int
	ParitySuggestionThreshold int
}

func (g *Gossip) getFederationConfig(ctx context.Context) (*federationConfig, error) {
	var cfg federationConfig
	err := g.Pool.QueryRow(ctx, `
		SELECT node_bilateral_base_limit, warning_threshold_1, warning_threshold_2, warning_threshold_3, parity_suggestion_threshold
		FROM federation_global_config ORDER BY id DESC LIMIT 1`,
	).Scan(&cfg.NodeBilateralBaseLimit, &cfg.WarningThreshold1, &cfg.WarningThreshold2, &cfg.WarningThreshold3, &cfg.ParitySuggestionThreshold)
	if err != nil {
		return nil, fmt.Errorf("getting federation config: %w", err)
	}
	return &cfg, nil
}
