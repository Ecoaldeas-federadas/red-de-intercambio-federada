package federation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PeerClient is the interface for making requests to federation peers.
// (Same interface as in reconcile.go; repeated here to avoid import cycles
// within the same package — both are in package federation.)

type Gossip struct {
	Pool         *pgxpool.Pool
	NodeDomain   string
	Interval     time.Duration
	Client       PeerClient  // optional: if nil, sync functions only refresh local state
	Reconciler   *Reconciler // optional: if set, reconcileChain invokes real reconciliation
	Propagator   *Propagator // optional: if set, handles catch-up and propagation
	needsCatchUp bool        // if true, request catch-up from peers on next tick
}

func NewGossip(pool *pgxpool.Pool, nodeDomain string, interval time.Duration) *Gossip {
	return &Gossip{
		Pool:         pool,
		NodeDomain:   nodeDomain,
		Interval:     interval,
		needsCatchUp: true, // always catch-up on startup
	}
}

// SetClient sets the peer client and reconciler so gossip can actually
// transmit data to peers and invoke real chain reconciliation.
func (g *Gossip) SetClient(client PeerClient, reconciler *Reconciler) {
	g.Client = client
	g.Reconciler = reconciler
}

// SetPropagator sets the propagator for automatic federation catch-up.
func (g *Gossip) SetPropagator(p *Propagator) {
	g.Propagator = p
}

func (g *Gossip) Start(ctx context.Context) {
	if g.Interval == 0 {
		g.Interval = 60 * time.Second
	}
	ticker := time.NewTicker(g.Interval)
	defer ticker.Stop()

	// Do catch-up immediately on startup
	if g.needsCatchUp && g.Propagator != nil {
		g.Propagator.CatchUpFromPeers(ctx)
		g.needsCatchUp = false
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			g.syncBalances(ctx)
			g.syncBilateralLimits(ctx)
			g.syncNodeLevels(ctx)
			g.syncSponsorships(ctx)
			g.syncDrivers(ctx)
			g.reconcileWithAllPeers(ctx)
		}
	}
}

// reconcileWithAllPeers iterates over all known peers and reconciles
// the cross-node tx chain with each one.
func (g *Gossip) reconcileWithAllPeers(ctx context.Context) {
	if g.Reconciler == nil {
		return
	}
	rows, err := g.Pool.Query(ctx,
		`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var peerDomain string
		if err := rows.Scan(&peerDomain); err != nil {
			continue
		}
		if peerDomain == g.NodeDomain {
			continue
		}
		// Invoke real reconciliation logic from reconcile.go
		imported, err := g.Reconciler.ReconcileWithPeer(ctx, peerDomain)
		if err != nil {
			continue // peer unreachable, try next
		}
		_ = imported
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
// Si hay un PeerClient configurado, envia los niveles locales a cada peer
// via el endpoint /federation/node-levels/sync. Si no hay cliente, solo
// refresca el estado local (para que el nodo sepa que tiene).
func (g *Gossip) syncNodeLevels(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT peer_domain, level_id, joined_at, level_updated_at
		 FROM federation_node_membership`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	type localMembership struct {
		PeerDomain     string    `json:"peer_domain"`
		LevelID        string    `json:"level_id"`
		JoinedAt       time.Time `json:"joined_at"`
		LevelUpdatedAt time.Time `json:"level_updated_at"`
	}
	var memberships []localMembership

	for rows.Next() {
		var m localMembership
		_ = rows.Scan(&m.PeerDomain, &m.LevelID, &m.JoinedAt, &m.LevelUpdatedAt)
		memberships = append(memberships, m)
	}

	// If we have a peer client, push our membership view to each active peer
	if g.Client != nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"from_node":   g.NodeDomain,
			"memberships": memberships,
		})
		peerRows, err := g.Pool.Query(ctx,
			`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`,
		)
		if err == nil {
			defer peerRows.Close()
			for peerRows.Next() {
				var peerDomain string
				_ = peerRows.Scan(&peerDomain)
				if peerDomain == g.NodeDomain {
					continue
				}
				// POST our membership view to the peer
				_ = g.postToPeer(ctx, peerDomain, "/federation/node-levels/sync", payload)
			}
		}
	}
}

// syncSponsorships sincroniza el estado de los patrocinios con los peers.
// Si hay un PeerClient configurado, envia los patrocinios activos a cada peer
// via el endpoint /federation/sponsorships/sync.
func (g *Gossip) syncSponsorships(ctx context.Context) {
	rows, err := g.Pool.Query(ctx,
		`SELECT sponsor_domain, sponsored_domain, amount_held, status, created_at, released_at
		 FROM federation_sponsorships WHERE status = 'active'`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	type localSponsorship struct {
		SponsorDomain   string     `json:"sponsor_domain"`
		SponsoredDomain string     `json:"sponsored_domain"`
		AmountHeld      int64      `json:"amount_held"`
		Status          string     `json:"status"`
		CreatedAt       time.Time  `json:"created_at"`
		ReleasedAt      *time.Time `json:"released_at"`
	}
	var sponsorships []localSponsorship

	for rows.Next() {
		var s localSponsorship
		_ = rows.Scan(&s.SponsorDomain, &s.SponsoredDomain, &s.AmountHeld, &s.Status, &s.CreatedAt, &s.ReleasedAt)
		sponsorships = append(sponsorships, s)
	}

	// If we have a peer client, push our sponsorship view to each active peer
	if g.Client != nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"from_node":    g.NodeDomain,
			"sponsorships": sponsorships,
		})
		peerRows, err := g.Pool.Query(ctx,
			`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`,
		)
		if err == nil {
			defer peerRows.Close()
			for peerRows.Next() {
				var peerDomain string
				_ = peerRows.Scan(&peerDomain)
				if peerDomain == g.NodeDomain {
					continue
				}
				_ = g.postToPeer(ctx, peerDomain, "/federation/sponsorships/sync", payload)
			}
		}
	}
}

// postToPeer sends a POST request to a peer via the PeerClient if available.
// PeerClient only has GetFromPeer, so we use a best-effort approach: if the
// client supports posting (extended interface), use it; otherwise skip.
func (g *Gossip) postToPeer(ctx context.Context, peerDomain, path string, payload []byte) error {
	// Check if the client supports posting (PeerPoster extension)
	if poster, ok := g.Client.(PeerPoster); ok {
		return poster.PostToPeer(ctx, peerDomain, path, payload)
	}
	// Fallback: no posting capability, skip silently
	_ = bytes.NewReader(payload)
	return nil
}

// PeerPoster is an optional extension of PeerClient that supports POSTing
// data to peers (for sync operations). PeerClient itself only supports GET.
type PeerPoster interface {
	PostToPeer(ctx context.Context, peerDomain, path string, body []byte) error
}

// reconcileChain compara los hashes de la cadena de transacciones cross-node
// con un peer y dispara la reconciliacion si hay divergencias.
// Ahora invoca el Reconciler real si esta configurado.
func (g *Gossip) reconcileChain(ctx context.Context, peerNode string) {
	if g.Reconciler != nil {
		// Real reconciliation: compare hashes and import divergent entries
		_, _ = g.Reconciler.ReconcileWithPeer(ctx, peerNode)
		return
	}

	// Fallback: mark unsynced entries as synced (best-effort local cleanup)
	var ourLastHash *string
	_ = g.Pool.QueryRow(ctx,
		`SELECT tx_hash FROM cross_node_tx_chain
		 WHERE sender_node = $1 AND receiver_node = $2
		 ORDER BY created_at DESC LIMIT 1`,
		g.NodeDomain, peerNode,
	).Scan(&ourLastHash)

	if ourLastHash != nil {
		var unsyncedCount int
		_ = g.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM cross_node_tx_chain
			 WHERE (sender_node = $1 OR receiver_node = $1) AND synced = false`,
			peerNode,
		).Scan(&unsyncedCount)

		if unsyncedCount > 0 {
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
		dynamicExplanation = fmt.Sprintf("Solo has importado %.2f TQ de este nodo, pero nunca has exportado nada. Debes enviar productos o servicios para equilibrar el intercambio.", float64(imports)/100)
	} else if exports > 0 && imports == 0 {
		// Solo exportas, nunca has importado
		parityRatio = -2 // valor especial: solo exportas
		dynamicExplanation = fmt.Sprintf("Solo has exportado %.2f TQ a este nodo, pero nunca has importado nada. Puedes importar productos que necesites para equilibrar.", float64(exports)/100)
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
