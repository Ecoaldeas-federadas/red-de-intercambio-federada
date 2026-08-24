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
	RemoteNode       string  `json:"remote_node"`
	Imports          int64   `json:"imports"`
	Exports          int64   `json:"exports"`
	Balance          int64   `json:"balance"`
	ParityRatio      float64 `json:"parity_ratio"`
	LocalFC          float64 `json:"local_fc"`
	RemoteFC         float64 `json:"remote_fc"`
	ImportPctOfLimit float64 `json:"import_pct_of_limit"`
	ExportPctOfLimit float64 `json:"export_pct_of_limit"`
	CreditLimit      int64   `json:"credit_limit"`
	HasParity        bool    `json:"has_parity"`
	Suggestion       string  `json:"suggestion"`
	CreatedAt        string  `json:"created_at"`
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

	// Tambien buscar transacciones federadas para este nodo
	if imports == 0 && exports == 0 {
		rows2, _ := g.Pool.Query(ctx, `
			SELECT 
				CASE WHEN receiver_node = $1 THEN amount ELSE 0 END as imports,
				CASE WHEN sender_node = $1 THEN amount ELSE 0 END as exports
			FROM transactions 
			WHERE tx_type = 'federation_transfer' AND (sender_node = $1 OR receiver_node = $1)`,
			remoteNode,
		)
		if rows2 != nil {
			defer rows2.Close()
			for rows2.Next() {
				var imp, exp int64
				_ = rows2.Scan(&imp, &exp)
				imports += imp
				exports += exp
			}
		}
	}

	// Balance = imports - exports (mecanica de saldo cero, no acumulacion bancaria)
	// Si importas mas de lo que exportas, el balance es positivo (te deben).
	// Si exportas mas de lo que importas, el balance es negativo (debes).
	// El objetivo es tender a 0 (equilibrio).
	nodeBalance := imports - exports

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

	// Calcular parity_ratio: 1.0 = equilibrado
	parityRatio := 0.0
	if exports > 0 && imports > 0 {
		parityRatio = float64(imports) / float64(exports)
	} else if imports > 0 {
		parityRatio = 2.0 // solo importas
	} else if exports > 0 {
		parityRatio = 0.5 // solo exportas
	}

	// Obtener FC local
	var localFC float64
	_ = g.Pool.QueryRow(ctx,
		`SELECT COALESCE(factor, 5.0) FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`,
		g.NodeDomain,
	).Scan(&localFC)
	if localFC == 0 {
		localFC = 5.0
	}

	// FC remoto: no podemos saberlo, usar valor estimado basado en el balance
	remoteFC := localFC // por defecto igual
	// Si hay balance negativo, el otro nodo tiene FC ligeramente diferente
	if nodeBalance != 0 && (imports > 0 || exports > 0) {
		// Estimacion simple: si importas mas, su FC es menor (mas barato)
		if imports > exports {
			remoteFC = localFC * 0.9
		} else if exports > imports {
			remoteFC = localFC * 1.1
		}
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
		Balance:          nodeBalance,
		ParityRatio:      parityRatio,
		LocalFC:          localFC,
		RemoteFC:         remoteFC,
		ImportPctOfLimit: importPct,
		ExportPctOfLimit: exportPct,
		CreditLimit:      creditLimit,
		HasParity:        hasParity,
		Suggestion:       suggestion,
		CreatedAt:        time.Now().UTC().Format("2006-01-02"),
	}, nil
}

type Warning struct {
	RemoteNode string  `json:"remote_node"`
	LimitType  string  `json:"limit_type"`
	UsagePct   float64 `json:"usage_pct"`
	Threshold  int     `json:"threshold"`
	Message    string  `json:"message"`
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
	NodeBilateralBaseLimit    int64
	WarningThreshold1         int
	WarningThreshold2         int
	WarningThreshold3         int
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
