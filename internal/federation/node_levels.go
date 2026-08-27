package federation

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NodeLevels manages federation node levels, membership, sponsorships,
// and auto-upgrade logic with reciprocity and average limit checks.
type NodeLevels struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewNodeLevels(pool *pgxpool.Pool, nodeDomain string) *NodeLevels {
	return &NodeLevels{Pool: pool, NodeDomain: nodeDomain}
}

// NodeLevel represents a federation node level configuration
type NodeLevel struct {
	ID                     string  `json:"id"`
	Name                   string  `json:"name"`
	Description            string  `json:"description"`
	Level                  int     `json:"level"`
	GlobalCreditLimit      int64   `json:"global_credit_limit"`
	GlobalDebitLimit       int64   `json:"global_debit_limit"`
	HasVoice               bool    `json:"has_voice"`
	HasVote                bool    `json:"has_vote"`
	CanSponsor             bool    `json:"can_sponsor"`
	MinDaysAtLevel         int     `json:"min_days_at_level"`
	MinDaysAfterLastLevel  int     `json:"min_days_after_last_level"`
	AutoUpgrade            bool    `json:"auto_upgrade"`
	UpgradeTo              *string `json:"upgrade_to"`
	RequireReciprocity     bool    `json:"require_reciprocity"`
	ReciprocityMinBalance  int64   `json:"reciprocity_min_balance"`
	ReciprocityMaxBalance  int64   `json:"reciprocity_max_balance"`
	RequireAvgLimit        bool    `json:"require_avg_limit"`
	AvgLimitRatio          float64 `json:"avg_limit_ratio"`
	IsSystem               bool    `json:"is_system"`
	IsActive               bool    `json:"is_active"`
	IsException            bool    `json:"is_exception"`
	ExceptionVoteThreshold float64 `json:"exception_vote_threshold"`
}

// NodeMembership represents a node's membership in the federation
type NodeMembership struct {
	PeerDomain          string     `json:"peer_domain"`
	LevelID             string     `json:"level_id"`
	LevelName           string     `json:"level_name"`
	LevelNumber         int        `json:"level_number"`
	JoinedAt            time.Time  `json:"joined_at"`
	LevelUpdatedAt      time.Time  `json:"level_updated_at"`
	LastLevelApprovedAt *time.Time `json:"last_level_approved_at"`
	SponsoredBy         *string    `json:"sponsored_by"`
	SponsoredAt         *time.Time `json:"sponsored_at"`
	SponsorLimitHeld    int64      `json:"sponsor_limit_held"`
	MinBalanceReached   int64      `json:"min_balance_reached"`
	MaxBalanceReached   int64      `json:"max_balance_reached"`
	TotalVolume         int64      `json:"total_volume"`
	AvgLimitCalculated  int64      `json:"avg_limit_calculated"`
	LastMetricsUpdated  *time.Time `json:"last_metrics_updated"`
}

// Sponsorship represents a sponsorship relationship (padrino)
type Sponsorship struct {
	ID              uuid.UUID  `json:"id"`
	SponsorDomain   string     `json:"sponsor_domain"`
	SponsoredDomain string     `json:"sponsored_domain"`
	AmountHeld      int64      `json:"amount_held"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	ReleasedAt      *time.Time `json:"released_at"`
}

// GetAllLevels returns all federation node levels
func (nl *NodeLevels) GetAllLevels(ctx context.Context) ([]NodeLevel, error) {
	rows, err := nl.Pool.Query(ctx, `
		SELECT id, name, COALESCE(description, ''), level, global_credit_limit, global_debit_limit,
		       has_voice, has_vote, can_sponsor, min_days_at_level, min_days_after_last_level,
		       auto_upgrade, upgrade_to, require_reciprocity, reciprocity_min_balance, reciprocity_max_balance,
		       require_avg_limit, avg_limit_ratio, is_system, is_active, is_exception, exception_vote_threshold
		FROM federation_node_levels
		WHERE is_active = true
		ORDER BY level`)
	if err != nil {
		return nil, fmt.Errorf("getting node levels: %w", err)
	}
	defer rows.Close()

	var levels []NodeLevel
	for rows.Next() {
		var l NodeLevel
		var upgradeTo *string
		if err := rows.Scan(&l.ID, &l.Name, &l.Description, &l.Level,
			&l.GlobalCreditLimit, &l.GlobalDebitLimit,
			&l.HasVoice, &l.HasVote, &l.CanSponsor,
			&l.MinDaysAtLevel, &l.MinDaysAfterLastLevel,
			&l.AutoUpgrade, &upgradeTo,
			&l.RequireReciprocity, &l.ReciprocityMinBalance, &l.ReciprocityMaxBalance,
			&l.RequireAvgLimit, &l.AvgLimitRatio,
			&l.IsSystem, &l.IsActive, &l.IsException, &l.ExceptionVoteThreshold); err != nil {
			continue
		}
		l.UpgradeTo = upgradeTo
		levels = append(levels, l)
	}
	return levels, nil
}

// GetLevel returns a specific level by ID
func (nl *NodeLevels) GetLevel(ctx context.Context, levelID string) (*NodeLevel, error) {
	var l NodeLevel
	var upgradeTo *string
	err := nl.Pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(description, ''), level, global_credit_limit, global_debit_limit,
		       has_voice, has_vote, can_sponsor, min_days_at_level, min_days_after_last_level,
		       auto_upgrade, upgrade_to, require_reciprocity, reciprocity_min_balance, reciprocity_max_balance,
		       require_avg_limit, avg_limit_ratio, is_system, is_active, is_exception, exception_vote_threshold
		FROM federation_node_levels WHERE id = $1`,
		levelID,
	).Scan(&l.ID, &l.Name, &l.Description, &l.Level,
		&l.GlobalCreditLimit, &l.GlobalDebitLimit,
		&l.HasVoice, &l.HasVote, &l.CanSponsor,
		&l.MinDaysAtLevel, &l.MinDaysAfterLastLevel,
		&l.AutoUpgrade, &upgradeTo,
		&l.RequireReciprocity, &l.ReciprocityMinBalance, &l.ReciprocityMaxBalance,
		&l.RequireAvgLimit, &l.AvgLimitRatio,
		&l.IsSystem, &l.IsActive, &l.IsException, &l.ExceptionVoteThreshold)
	if err != nil {
		return nil, fmt.Errorf("getting level: %w", err)
	}
	l.UpgradeTo = upgradeTo
	return &l, nil
}

// GetNodeLevel returns the NodeLevel for a peer domain by looking up its membership.
// This is the domain-based level lookup (counterpart to GetLevel which takes a level ID).
func (nl *NodeLevels) GetNodeLevel(ctx context.Context, peerDomain string) (*NodeLevel, error) {
	membership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return nil, err
	}
	return nl.GetLevel(ctx, membership.LevelID)
}

// GetMembership returns the membership info for a peer node
func (nl *NodeLevels) GetMembership(ctx context.Context, peerDomain string) (*NodeMembership, error) {
	var m NodeMembership
	var sponsoredBy *string
	var sponsoredAt, lastLevelApproved, lastMetrics *time.Time
	err := nl.Pool.QueryRow(ctx, `
		SELECT m.peer_domain, m.level_id, l.name, l.level,
		       m.joined_at, m.level_updated_at, m.last_level_approved_at,
		       m.sponsored_by, m.sponsored_at, m.sponsor_limit_held,
		       m.min_balance_reached, m.max_balance_reached, m.total_volume,
		       m.avg_limit_calculated, m.last_metrics_updated
		FROM federation_node_membership m
		JOIN federation_node_levels l ON m.level_id = l.id
		WHERE m.peer_domain = $1`,
		peerDomain,
	).Scan(&m.PeerDomain, &m.LevelID, &m.LevelName, &m.LevelNumber,
		&m.JoinedAt, &m.LevelUpdatedAt, &lastLevelApproved,
		&sponsoredBy, &sponsoredAt, &m.SponsorLimitHeld,
		&m.MinBalanceReached, &m.MaxBalanceReached, &m.TotalVolume,
		&m.AvgLimitCalculated, &lastMetrics)
	if err != nil {
		return nil, fmt.Errorf("getting membership: %w", err)
	}
	m.SponsoredBy = sponsoredBy
	m.SponsoredAt = sponsoredAt
	m.LastLevelApprovedAt = lastLevelApproved
	m.LastMetricsUpdated = lastMetrics
	return &m, nil
}

// GetEffectiveLimit returns the effective global credit limit for a node,
// considering its level and any active sponsorship holdbacks.
func (nl *NodeLevels) GetEffectiveLimit(ctx context.Context, peerDomain string) (int64, error) {
	membership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		// No membership -> use default from federation_global_config
		var defaultLimit int64
		_ = nl.Pool.QueryRow(ctx,
			`SELECT node_global_credit_limit FROM federation_global_config ORDER BY id DESC LIMIT 1`,
		).Scan(&defaultLimit)
		return defaultLimit, nil
	}

	level, err := nl.GetLevel(ctx, membership.LevelID)
	if err != nil {
		return 0, err
	}

	// Subtract active sponsorship holdbacks
	var heldAmount int64
	_ = nl.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_held), 0) FROM federation_sponsorships
		 WHERE sponsor_domain = $1 AND status = 'active'`,
		peerDomain,
	).Scan(&heldAmount)

	effectiveLimit := level.GlobalCreditLimit - heldAmount
	if effectiveLimit < 0 {
		effectiveLimit = 0
	}
	return effectiveLimit, nil
}

// SponsorNewNode creates a sponsorship: the sponsor's limit is reduced by the new node's limit.
// The sponsor must be level 2+ with can_sponsor=true and have enough remaining limit.
func (nl *NodeLevels) SponsorNewNode(ctx context.Context, sponsorDomain, newDomain string, amountHeld int64) error {
	// Verify sponsor is level 2+ with can_sponsor
	sponsorMembership, err := nl.GetMembership(ctx, sponsorDomain)
	if err != nil {
		return fmt.Errorf("sponsor not found in federation: %w", err)
	}

	sponsorLevel, err := nl.GetLevel(ctx, sponsorMembership.LevelID)
	if err != nil {
		return fmt.Errorf("getting sponsor level: %w", err)
	}

	if !sponsorLevel.CanSponsor {
		return fmt.Errorf("sponsor level %s cannot sponsor new nodes", sponsorLevel.Name)
	}

	// Calculate sponsor's current effective limit
	effectiveLimit, err := nl.GetEffectiveLimit(ctx, sponsorDomain)
	if err != nil {
		return fmt.Errorf("getting sponsor effective limit: %w", err)
	}

	// Check if sponsor has enough limit remaining
	if effectiveLimit-amountHeld <= 0 {
		return fmt.Errorf("sponsor does not have enough limit: effective %d - held %d would be <= 0", effectiveLimit, amountHeld)
	}

	// Create the sponsorship
	_, err = nl.Pool.Exec(ctx, `
		INSERT INTO federation_sponsorships (sponsor_domain, sponsored_domain, amount_held, status, created_at)
		VALUES ($1, $2, $3, 'active', NOW())
		ON CONFLICT (sponsor_domain, sponsored_domain) DO UPDATE SET amount_held = $3, status = 'active'`,
		sponsorDomain, newDomain, amountHeld,
	)
	if err != nil {
		return fmt.Errorf("creating sponsorship: %w", err)
	}

	// Create membership for the new node at level 1 ('new')
	_, err = nl.Pool.Exec(ctx, `
		INSERT INTO federation_node_membership (peer_domain, level_id, joined_at, level_updated_at, sponsored_by, sponsored_at, sponsor_limit_held)
		VALUES ($1, 'new', NOW(), NOW(), $2, NOW(), $3)
		ON CONFLICT (peer_domain) DO UPDATE SET level_id = 'new', level_updated_at = NOW(), sponsored_by = $2, sponsored_at = NOW(), sponsor_limit_held = $3`,
		newDomain, sponsorDomain, amountHeld,
	)
	if err != nil {
		return fmt.Errorf("creating membership: %w", err)
	}

	return nil
}

// ReleaseSponsorship releases a sponsorship when the sponsored node upgrades to level 2.
func (nl *NodeLevels) ReleaseSponsorship(ctx context.Context, sponsorDomain, sponsoredDomain string) error {
	_, err := nl.Pool.Exec(ctx, `
		UPDATE federation_sponsorships SET status = 'released', released_at = NOW()
		WHERE sponsor_domain = $1 AND sponsored_domain = $2 AND status = 'active'`,
		sponsorDomain, sponsoredDomain,
	)
	if err != nil {
		return fmt.Errorf("releasing sponsorship: %w", err)
	}
	return nil
}

// TransferDebtToSponsor transfers debt from a sponsored node to its sponsor on default.
// It marks the sponsorship as defaulted AND creates a real ledger entry that
// formally transfers the debt to the sponsor's global bridge account.
func (nl *NodeLevels) TransferDebtToSponsor(ctx context.Context, sponsorDomain, sponsoredDomain string, debtAmount int64) error {
	// Mark sponsorship as defaulted
	_, err := nl.Pool.Exec(ctx, `
		UPDATE federation_sponsorships SET status = 'defaulted', released_at = NOW()
		WHERE sponsor_domain = $1 AND sponsored_domain = $2 AND status = 'active'`,
		sponsorDomain, sponsoredDomain,
	)
	if err != nil {
		return fmt.Errorf("marking sponsorship as defaulted: %w", err)
	}

	// Create the actual ledger entry transferring the debt to the sponsor.
	// This records a sponsor_debt transaction in the ledger so the sponsor's
	// bridge balance reflects the assumed debt.
	_, err = nl.Pool.Exec(ctx, `
		INSERT INTO transactions (id, tx_type, sender_node, receiver_node, amount, tax_amount,
			user_signature, node_signature, prev_hash, current_hash, external_id, status, metadata, created_at)
		VALUES ($1, 'sponsor_debt', $2, $3, $4, 0, '', '', '', '', $5, 'confirmed', $6, NOW())`,
		uuid.New(), sponsoredDomain, sponsorDomain, debtAmount,
		fmt.Sprintf("sponsor_debt:%s:%s", sponsoredDomain, sponsorDomain),
		`{"type":"sponsor_debt_transfer","sponsor_domain":"`+sponsorDomain+`","sponsored_domain":"`+sponsoredDomain+`","debt_amount":`+fmt.Sprintf("%d", debtAmount)+`}`,
	)
	if err != nil {
		return fmt.Errorf("creating sponsor debt ledger transaction: %w", err)
	}

	// Post the ledger entries: debit sponsored node's bridge, credit sponsor's bridge
	// We insert directly into ledger_entries since we don't have a Ledger instance here.
	// The entries use account_category = 'node_bridge_global' with counterpart_node
	// to track the balance per node.
	txID, _ := uuid.New().MarshalBinary()
	_ = txID // suppress unused

	// Use a fresh UUID for the transaction ID we just created
	var createdTxID string
	_ = nl.Pool.QueryRow(ctx,
		`SELECT id::text FROM transactions WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1`,
		fmt.Sprintf("sponsor_debt:%s:%s", sponsoredDomain, sponsorDomain),
	).Scan(&createdTxID)

	if createdTxID != "" {
		// Debit the sponsored node's global bridge (reduces its debt)
		_, _ = nl.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, pool_type, created_at)
			VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'debit', $2, 'node_bridge_global', $3, 'global', NOW())`,
			createdTxID, debtAmount, sponsoredDomain,
		)
		// Credit the sponsor's global bridge (assumes the debt)
		_, _ = nl.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, pool_type, created_at)
			VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'credit', $2, 'node_bridge_global', $3, 'global', NOW())`,
			createdTxID, debtAmount, sponsorDomain,
		)
	}

	return nil
}

// CanProposeUpgrade checks if a node can be proposed for a level upgrade.
// Verifies min_days_at_level and min_days_after_last_level.
func (nl *NodeLevels) CanProposeUpgrade(ctx context.Context, peerDomain string) (bool, string, error) {
	membership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return false, "node not found in federation", nil
	}

	level, err := nl.GetLevel(ctx, membership.LevelID)
	if err != nil {
		return false, "level not found", nil
	}

	// Check min_days_at_level
	daysAtLevel := int(time.Since(membership.LevelUpdatedAt).Hours() / 24)
	if daysAtLevel < level.MinDaysAtLevel {
		return false, fmt.Sprintf("node has been at level for %d days, minimum is %d", daysAtLevel, level.MinDaysAtLevel), nil
	}

	// Check min_days_after_last_level
	if level.MinDaysAfterLastLevel > 0 && membership.LastLevelApprovedAt != nil {
		daysSinceLastApproval := int(time.Since(*membership.LastLevelApprovedAt).Hours() / 24)
		if daysSinceLastApproval < level.MinDaysAfterLastLevel {
			return false, fmt.Sprintf("only %d days since last level approval, minimum is %d", daysSinceLastApproval, level.MinDaysAfterLastLevel), nil
		}
	}

	return true, "", nil
}

// CheckAutoUpgrade checks if a node qualifies for automatic upgrade.
// Verifies reciprocity (min/max balance) and average limit.
func (nl *NodeLevels) CheckAutoUpgrade(ctx context.Context, peerDomain string) (bool, string, error) {
	membership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return false, "node not found in federation", nil
	}

	level, err := nl.GetLevel(ctx, membership.LevelID)
	if err != nil {
		return false, "level not found", nil
	}

	if !level.AutoUpgrade || level.UpgradeTo == nil {
		return false, "auto-upgrade not enabled for this level", nil
	}

	// Check min_days_at_level
	daysAtLevel := int(time.Since(membership.LevelUpdatedAt).Hours() / 24)
	if daysAtLevel < level.MinDaysAtLevel {
		return false, fmt.Sprintf("only %d days at level, minimum is %d", daysAtLevel, level.MinDaysAtLevel), nil
	}

	// Update metrics before checking
	if err := nl.UpdateMetrics(ctx, peerDomain); err != nil {
		return false, fmt.Sprintf("error updating metrics: %v", err), nil
	}

	// Re-read membership after metrics update
	membership, err = nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return false, "error re-reading membership", nil
	}

	// Check reciprocity: node must have both contributed (positive balance) and received (negative balance)
	if level.RequireReciprocity {
		if membership.MinBalanceReached > -level.ReciprocityMinBalance {
			return false, fmt.Sprintf("reciprocity: min balance %d not low enough (need <= -%d)", membership.MinBalanceReached, level.ReciprocityMinBalance), nil
		}
		if membership.MaxBalanceReached < level.ReciprocityMaxBalance {
			return false, fmt.Sprintf("reciprocity: max balance %d not high enough (need >= %d)", membership.MaxBalanceReached, level.ReciprocityMaxBalance), nil
		}
	}

	// Check average limit: the smaller of |total_positive| and |total_negative| must exceed ratio * current_limit
	if level.RequireAvgLimit {
		requiredAvgLimit := int64(float64(level.GlobalCreditLimit) * level.AvgLimitRatio)
		if membership.AvgLimitCalculated < requiredAvgLimit {
			return false, fmt.Sprintf("average limit %d below required %d (ratio %.2f of %d)", membership.AvgLimitCalculated, requiredAvgLimit, level.AvgLimitRatio, level.GlobalCreditLimit), nil
		}
	}

	return true, "", nil
}

// UpgradeNodeLevel upgrades a node to a new level.
// If upgrading from level 1 to level 2, releases the sponsorship.
func (nl *NodeLevels) UpgradeNodeLevel(ctx context.Context, peerDomain, newLevelID string, proposalID *uuid.UUID) error {
	// Get current membership to find sponsor
	currentMembership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return fmt.Errorf("getting current membership: %w", err)
	}

	// Update the membership
	_, err = nl.Pool.Exec(ctx, `
		UPDATE federation_node_membership
		SET level_id = $2, level_updated_at = NOW(), last_level_approved_at = NOW(),
		    upgraded_by_proposal = $3, sponsor_limit_held = 0
		WHERE peer_domain = $1`,
		peerDomain, newLevelID, proposalID,
	)
	if err != nil {
		return fmt.Errorf("upgrading node level: %w", err)
	}

	// If upgrading from level 1 ('new') to level 2 ('accepted'), release sponsorship
	if currentMembership.LevelID == "new" && newLevelID == "accepted" && currentMembership.SponsoredBy != nil {
		if err := nl.ReleaseSponsorship(ctx, *currentMembership.SponsoredBy, peerDomain); err != nil {
			// Log but don't fail the upgrade
			fmt.Printf("WARNING: error releasing sponsorship for %s: %v\n", peerDomain, err)
		}
	}

	return nil
}

// UpdateMetrics recalculates the metrics for a node: min/max balance, total volume, average limit.
func (nl *NodeLevels) UpdateMetrics(ctx context.Context, peerDomain string) error {
	// Calculate min and max balance from global pool entries
	// We need to compute the running balance over time
	rows, err := nl.Pool.Query(ctx, `
		SELECT amount, entry_type, created_at
		FROM ledger_entries
		WHERE account_category = 'node_bridge_global' AND counterpart_node = $1
		ORDER BY created_at`,
		peerDomain,
	)
	if err != nil {
		return fmt.Errorf("querying global entries: %w", err)
	}
	defer rows.Close()

	var runningBalance int64
	var minBalance, maxBalance int64
	var totalPositive, totalNegative int64
	var totalVolume int64

	for rows.Next() {
		var amount int64
		var entryType string
		var createdAt time.Time
		if err := rows.Scan(&amount, &entryType, &createdAt); err != nil {
			continue
		}
		if entryType == "credit" {
			runningBalance += amount
			totalPositive += amount
		} else {
			runningBalance -= amount
			totalNegative += amount
		}
		if runningBalance < minBalance {
			minBalance = runningBalance
		}
		if runningBalance > maxBalance {
			maxBalance = runningBalance
		}
		totalVolume += amount
	}

	// Average limit = smaller of |totalPositive| and |totalNegative|
	absPositive := totalPositive
	absNegative := -totalNegative
	if totalNegative > 0 {
		absNegative = totalNegative
	}
	var avgLimit int64
	if absPositive < absNegative {
		avgLimit = absPositive
	} else {
		avgLimit = absNegative
	}

	// Update the membership
	_, err = nl.Pool.Exec(ctx, `
		UPDATE federation_node_membership
		SET min_balance_reached = $2, max_balance_reached = $3, total_volume = $4,
		    avg_limit_calculated = $5, last_metrics_updated = NOW()
		WHERE peer_domain = $1`,
		peerDomain, minBalance, maxBalance, totalVolume, avgLimit,
	)
	if err != nil {
		return fmt.Errorf("updating metrics: %w", err)
	}

	return nil
}

// GetActiveSponsorships returns all active sponsorships for a given sponsor
func (nl *NodeLevels) GetActiveSponsorships(ctx context.Context, sponsorDomain string) ([]Sponsorship, error) {
	rows, err := nl.Pool.Query(ctx, `
		SELECT id, sponsor_domain, sponsored_domain, amount_held, status, created_at, released_at
		FROM federation_sponsorships
		WHERE sponsor_domain = $1 AND status = 'active'
		ORDER BY created_at DESC`,
		sponsorDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("getting sponsorships: %w", err)
	}
	defer rows.Close()

	var sponsorships []Sponsorship
	for rows.Next() {
		var s Sponsorship
		var releasedAt *time.Time
		if err := rows.Scan(&s.ID, &s.SponsorDomain, &s.SponsoredDomain,
			&s.AmountHeld, &s.Status, &s.CreatedAt, &releasedAt); err != nil {
			continue
		}
		s.ReleasedAt = releasedAt
		sponsorships = append(sponsorships, s)
	}
	return sponsorships, nil
}

// GetAllSponsorships returns all sponsorships (for admin panel)
func (nl *NodeLevels) GetAllSponsorships(ctx context.Context) ([]Sponsorship, error) {
	rows, err := nl.Pool.Query(ctx, `
		SELECT id, sponsor_domain, sponsored_domain, amount_held, status, created_at, released_at
		FROM federation_sponsorships
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("getting all sponsorships: %w", err)
	}
	defer rows.Close()

	var sponsorships []Sponsorship
	for rows.Next() {
		var s Sponsorship
		var releasedAt *time.Time
		if err := rows.Scan(&s.ID, &s.SponsorDomain, &s.SponsoredDomain,
			&s.AmountHeld, &s.Status, &s.CreatedAt, &releasedAt); err != nil {
			continue
		}
		s.ReleasedAt = releasedAt
		sponsorships = append(sponsorships, s)
	}
	return sponsorships, nil
}

// CanVote checks if a node has voting rights (level 2+)
func (nl *NodeLevels) CanVote(ctx context.Context, peerDomain string) bool {
	membership, err := nl.GetMembership(ctx, peerDomain)
	if err != nil {
		return false
	}
	level, err := nl.GetLevel(ctx, membership.LevelID)
	if err != nil {
		return false
	}
	return level.HasVote
}

// CountVotingNodes returns the number of nodes with voting rights
func (nl *NodeLevels) CountVotingNodes(ctx context.Context) (int, error) {
	var count int
	err := nl.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM federation_node_membership m
		JOIN federation_node_levels l ON m.level_id = l.id
		WHERE l.has_vote = true AND l.is_active = true`,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting voting nodes: %w", err)
	}
	return count, nil
}
