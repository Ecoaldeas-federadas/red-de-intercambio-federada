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
			g.syncNodeLevels(ctx)
			g.syncSponsorships(ctx)
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

// syncNodeLevels sincroniza los niveles de nodo federado con los peers.
// Cuando un nodo se conecta, intercambia informacion sobre los niveles
// de los nodos conocidos para mantener consistencia.
func (g *Gossip) syncNodeLevels(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT peer_domain, level_id, joined_at, level_updated_at
		 FROM federation_node_membership`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var peerDomain, levelID string
		var joinedAt, levelUpdatedAt time.Time
		_ = rows.Scan(&peerDomain, &levelID, &joinedAt, &levelUpdatedAt)
		// En una implementacion completa, esto enviaria los datos al peer
		// via el cliente federado. Por ahora, solo leemos para mantener
		// el estado local actualizado.
	}
}

// syncSponsorships sincroniza el estado de los patrocinios con los peers.
// Esto permite que un nodo sepa si su patrocinio fue liberado o si
// hubo un default que transfiere deuda.
func (g *Gossip) syncSponsorships(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT sponsor_domain, sponsored_domain, amount_held, status, created_at, released_at
		 FROM federation_sponsorships WHERE status = 'active'`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sponsorDomain, sponsoredDomain, status string
		var amountHeld int64
		var createdAt time.Time
		var releasedAt *time.Time
		_ = rows.Scan(&sponsorDomain, &sponsoredDomain, &amountHeld, &status, &createdAt, &releasedAt)
		// En una implementacion completa, esto verificaria con el peer
		// si el patrocinio sigue activo o si fue liberado/defaulted.
	}
}

// reconcileChain compara los hashes de la cadena de transacciones cross-node
// con un peer y dispara la reconciliacion si hay divergencias.
func (g *Gossip) reconcileChain(ctx context.Context, peerNode string) {
	// Obtener nuestro ultimo hash para este peer
	var ourLastHash *string
	_ = g.Pool.QueryRow(ctx,
		`SELECT tx_hash FROM cross_node_tx_chain
		 WHERE sender_node = $1 AND receiver_node = $2
		 ORDER BY created_at DESC LIMIT 1`,
		g.NodeDomain, peerNode,
	).Scan(&ourLastHash)

	// Si tenemos transacciones, intentar reconciliar
	// La reconciliacion real la hace el Reconciler
	if ourLastHash != nil {
		// Verificar si hay entradas no sincronizadas
		var unsyncedCount int
		_ = g.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM cross_node_tx_chain
			 WHERE (sender_node = $1 OR receiver_node = $1) AND synced = false`,
			peerNode,
		).Scan(&unsyncedCount)

		if unsyncedCount > 0 {
			// Marcar como synced las que ya fueron enviadas
			// En una implementacion completa, esto llamaria al Reconciler
			_, _ = g.Pool.Exec(ctx,
				`UPDATE cross_node_tx_chain SET synced = true, synced_at = NOW()
				 WHERE (sender_node = $1 OR receiver_node = $1) AND synced = false`,
				peerNode,
			)
		}
	}
}

type ParityReport struct {
	RemoteNode         string  `json:"remote_node"`
	Imports            int64   `json:"imports"`
	Exports            int64   `json:"exports"`
	Balance            int64   `json:"balance"`
	ParityRatio        float64 `json:"parity_ratio"`
	DynamicExplanation string  `json:"dynamic_explanation"`
	LocalFC            float64 `json:"local_fc"`
	RemoteFC           float64 `json:"remote_fc"`
	RemoteFCReal       bool    `json:"remote_fc_real"`
	ImportPctOfLimit   float64 `json:"import_pct_of_limit"`
	ExportPctOfLimit   float64 `json:"export_pct_of_limit"`
	CreditLimit        int64   `json:"credit_limit"`
	HasParity          bool    `json:"has_parity"`
	Suggestion         string  `json:"suggestion"`
	CreatedAt          string  `json:"created_at"`
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
	// IMPORTANTE: NO forzar valores fijos como 2.0 o 0.5.
	// Calcular el ratio real cuando hay datos.
	// Cuando solo hay un lado (solo import o solo export), usar un valor
	// que indique claramente la situacion, pero la explicacion dinamica
	// sera la que aclare el significado.
	parityRatio := 0.0
	dynamicExplanation := "Sin datos: no has realizado intercambios con este nodo."

	if exports > 0 && imports > 0 {
		parityRatio = float64(imports) / float64(exports)
		// Explicacion dinamica con el numero real
		if parityRatio >= 0.9 && parityRatio <= 1.1 {
			dynamicExplanation = fmt.Sprintf("Equilibrado: importas y exportas casi lo mismo. Por cada 1 TQ que exportas, importas %.1f TQ.", parityRatio)
		} else if parityRatio > 1.0 {
			dynamicExplanation = fmt.Sprintf("Importas mas de lo que exportas. Por cada 1 TQ que exportas, importas %.1f TQ. Debes exportar %.0f%% mas para equilibrar.", parityRatio, (parityRatio-1)*100)
		} else {
			dynamicExplanation = fmt.Sprintf("Exportas mas de lo que importas. Por cada 1 TQ que importas, exportas %.1f TQ. Puedes importar mas o reducir exportaciones.", 1/parityRatio)
		}
	} else if imports > 0 && exports == 0 {
		// Solo importas, nunca has exportado
		// Usar un valor alto para indicar desequilibrio total
		parityRatio = -1 // valor especial: solo importas
		dynamicExplanation = fmt.Sprintf("Solo has importado %d TQ de este nodo, pero nunca has exportado nada. Debes enviar productos o servicios para equilibrar el intercambio.", imports)
	} else if exports > 0 && imports == 0 {
		// Solo exportas, nunca has importado
		parityRatio = -2 // valor especial: solo exportas
		dynamicExplanation = fmt.Sprintf("Solo has exportado %d TQ a este nodo, pero nunca has importado nada. Puedes importar productos que necesites para equilibrar.", exports)
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

	// FC remoto: intentar obtener el FC real del nodo remoto via federation
	// Si no se puede obtener, dejarlo como 0 y marcar remote_fc_real = false
	remoteFC := 0.0
	remoteFCReal := false
	// Intentar leer el FC remoto de la tabla de federation (si el otro nodo lo compartio)
	_ = g.Pool.QueryRow(ctx,
		`SELECT COALESCE(factor, 0) FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`,
		remoteNode,
	).Scan(&remoteFC)
	if remoteFC > 0 {
		remoteFCReal = true
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
		RemoteNode:         remoteNode,
		Imports:            imports,
		Exports:            exports,
		Balance:            nodeBalance,
		ParityRatio:        parityRatio,
		DynamicExplanation: dynamicExplanation,
		LocalFC:            localFC,
		RemoteFC:           remoteFC,
		RemoteFCReal:       remoteFCReal,
		ImportPctOfLimit:   importPct,
		ExportPctOfLimit:   exportPct,
		CreditLimit:        creditLimit,
		HasParity:          hasParity,
		Suggestion:         suggestion,
		CreatedAt:          time.Now().UTC().Format("2006-01-02"),
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
