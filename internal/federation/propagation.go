package federation

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Propagator handles automatic propagation of federation data across the network.
// When a new node joins via a sponsor, the sponsor propagates the new node's
// info to all its peers. Each peer establishes an individual 1-to-1 relationship
// with the new node and re-propagates to its own peers (exponential chain).
//
// Key principles:
//   - Each node has its own individual certificate/key (no shared key)
//   - If one certificate is compromised, only that node is affected
//   - Propagation is best-effort; offline nodes catch up on reconnect
//   - Idempotency prevents infinite loops in the propagation chain
type Propagator struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	Transport  *EncryptedTransport
}

// NewPropagator creates a new Propagator.
func NewPropagator(pool *pgxpool.Pool, nodeDomain string, transport *EncryptedTransport) *Propagator {
	return &Propagator{
		Pool:       pool,
		NodeDomain: nodeDomain,
		Transport:  transport,
	}
}

// PropagationMessageType identifies the type of propagated message.
type PropagationMessageType string

const (
	MsgPropNewPeer      PropagationMessageType = "new_peer"
	MsgPropMembership   PropagationMessageType = "membership_update"
	MsgPropBlock        PropagationMessageType = "unilateral_block"
	MsgPropUnblock      PropagationMessageType = "unilateral_unblock"
	MsgPropExpulsion    PropagationMessageType = "expulsion"
	MsgPropCatchUpReq   PropagationMessageType = "catch_up_request"
	MsgPropCatchUpResp  PropagationMessageType = "catch_up_response"
)

// PropagationMessage is the payload inside the encrypted envelope.
type PropagationMessage struct {
	Type            PropagationMessageType `json:"type"`
	FromNode        string                  `json:"from_node"`
	Timestamp       int64                   `json:"timestamp"`
	MessageID       string                  `json:"message_id"`

	// For new_peer propagation
	NewDomain       string `json:"new_domain,omitempty"`
	NewPublicKey    string `json:"new_public_key,omitempty"`
	NewEndpoint     string `json:"new_endpoint,omitempty"`
	NewNodeName     string `json:"new_node_name,omitempty"`
	SponsorDomain   string `json:"sponsor_domain,omitempty"`
	MembershipLevel string `json:"membership_level,omitempty"`
	SponsorshipAmt  int64  `json:"sponsorship_amt,omitempty"`

	// For membership_update
	PeerDomain      string `json:"peer_domain,omitempty"`
	NewLevelID      string `json:"new_level_id,omitempty"`
	ProposalID      string `json:"proposal_id,omitempty"`

	// For unilateral_block / unblock
	BlockedDomain   string `json:"blocked_domain,omitempty"`
	BlockReason     string `json:"block_reason,omitempty"`

	// For expulsion
	ExpelledDomain  string `json:"expelled_domain,omitempty"`
	ExpulsionReason string `json:"expulsion_reason,omitempty"`

	// For catch_up_response — contains all federation data
	CatchUpData     *CatchUpData `json:"catch_up_data,omitempty"`
}

// CatchUpData contains all federation state for a node to catch up.
type CatchUpData struct {
	Peers        []CatchUpPeer        `json:"peers"`
	Memberships  []CatchUpMembership  `json:"memberships"`
	Sponsorships []CatchUpSponsorship `json:"sponsorships"`
	Blocks       []CatchUpBlock       `json:"blocks"`
	Expelled     []CatchUpExpelled    `json:"expelled"`
}

type CatchUpPeer struct {
	Domain     string `json:"domain"`
	PublicKey  string `json:"public_key"`
	Endpoint   string `json:"endpoint"`
	NodeName   string `json:"node_name"`
	AutoAccepted bool `json:"auto_accepted"`
	PropagatedBy string `json:"propagated_by"`
}

type CatchUpMembership struct {
	PeerDomain    string `json:"peer_domain"`
	LevelID       string `json:"level_id"`
	SponsoredBy   string `json:"sponsored_by"`
	SponsorshipHeld int64 `json:"sponsorship_held"`
}

type CatchUpSponsorship struct {
	SponsorDomain   string `json:"sponsor_domain"`
	SponsoredDomain string `json:"sponsored_domain"`
	AmountHeld      int64  `json:"amount_held"`
	Status          string `json:"status"`
}

type CatchUpBlock struct {
	BlockerDomain string `json:"blocker_domain"`
	BlockedDomain string `json:"blocked_domain"`
	Reason        string `json:"reason"`
}

type CatchUpExpelled struct {
	NodeDomain string `json:"node_domain"`
	Reason     string `json:"reason"`
}

// PropagateNewPeer broadcasts a new node's info to all active peers.
// The sponsor calls this after confirming a federation pairing.
// Each peer establishes an individual 1-to-1 relationship with the new node
// and re-propagates to its own peers (exponential chain).
func (p *Propagator) PropagateNewPeer(ctx context.Context, newDomain, newPublicKey, newEndpoint, newNodeName, sponsorDomain, membershipLevel string, sponsorshipAmt int64) error {
	if p.Transport == nil || !p.Transport.HasPrivateKey() {
		log.Printf("Propagator: transport not available, skipping propagation of %s", newDomain)
		return nil
	}

	msg := PropagationMessage{
		Type:            MsgPropNewPeer,
		FromNode:        p.NodeDomain,
		Timestamp:       time.Now().Unix(),
		MessageID:       GenerateMessageID(),
		NewDomain:       newDomain,
		NewPublicKey:    newPublicKey,
		NewEndpoint:     newEndpoint,
		NewNodeName:     newNodeName,
		SponsorDomain:   sponsorDomain,
		MembershipLevel: membershipLevel,
		SponsorshipAmt:  sponsorshipAmt,
	}

	// Get all active peers to propagate to
	peers, err := p.getActivePeerDomains(ctx)
	if err != nil {
		return fmt.Errorf("getting active peers: %w", err)
	}

	propagated := 0
	for _, peerDomain := range peers {
		if peerDomain == newDomain || peerDomain == p.NodeDomain {
			continue
		}
		// Send via encrypted transport
		if err := p.Transport.SendToPeer(ctx, peerDomain, "/api/federation/propagate/peer", msg); err != nil {
			log.Printf("Propagator: failed to propagate new peer %s to %s: %v", newDomain, peerDomain, err)
			continue
		}
		propagated++
	}

	log.Printf("Propagator: propagated new peer %s to %d/%d active peers", newDomain, propagated, len(peers))
	return nil
}

// ReceivePropagatedPeer processes a new_peer propagation message from another node.
// It establishes an individual 1-to-1 relationship with the new node and
// re-propagates to its own peers (exponential chain).
func (p *Propagator) ReceivePropagatedPeer(ctx context.Context, msg *PropagationMessage) error {
	if msg.NewDomain == "" || msg.NewPublicKey == "" {
		return fmt.Errorf("invalid propagation message: missing new_domain or new_public_key")
	}

	// Don't register ourselves
	if msg.NewDomain == p.NodeDomain {
		return nil
	}

	// Check if we already know this node (idempotency — prevents loops)
	var alreadyKnown bool
	_ = p.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM node_federation_keys WHERE peer_domain = $1)`,
		msg.NewDomain,
	).Scan(&alreadyKnown)

	if alreadyKnown {
		// Already know this node — don't re-propagate (prevents infinite loops)
		log.Printf("Propagator: already know %s, skipping re-propagation", msg.NewDomain)
		return nil
	}

	// Register the new node as a peer (auto-accepted via propagation)
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO node_federation_keys (peer_domain, peer_public_key, peer_endpoint, status, mutual_verified, auto_accepted, propagated_by, created_at, updated_at)
		VALUES ($1, $2, $3, 'active', false, true, $4, NOW(), NOW())
		ON CONFLICT (peer_domain) DO UPDATE SET peer_public_key = $2, peer_endpoint = $3, status = 'active', propagated_by = $4, updated_at = NOW()`,
		msg.NewDomain, msg.NewPublicKey, msg.NewEndpoint, msg.FromNode,
	)
	if err != nil {
		return fmt.Errorf("registering propagated peer: %w", err)
	}

	// Cache the endpoint for direct communication
	_, _ = p.Pool.Exec(ctx, `
		INSERT INTO federation_peer_endpoints (node_domain, endpoint, public_key, node_name, last_updated, discovered_via)
		VALUES ($1, $2, $3, $4, NOW(), $5)
		ON CONFLICT (node_domain) DO UPDATE SET endpoint = $2, public_key = $3, node_name = $4, last_updated = NOW()`,
		msg.NewDomain, msg.NewEndpoint, msg.NewPublicKey, msg.NewNodeName, msg.FromNode,
	)

	// Create membership at level 1 (new) with the original sponsor
	_, err = p.Pool.Exec(ctx, `
		INSERT INTO federation_node_membership (peer_domain, level_id, joined_at, level_updated_at, sponsored_by, sponsored_at, sponsor_limit_held)
		VALUES ($1, 'new', NOW(), NOW(), $2, NOW(), $3)
		ON CONFLICT (peer_domain) DO UPDATE SET level_id = 'new', level_updated_at = NOW(), sponsored_by = $2, sponsor_limit_held = $3`,
		msg.NewDomain, msg.SponsorDomain, msg.SponsorshipAmt,
	)
	if err != nil {
		log.Printf("Propagator: warning creating membership for %s: %v", msg.NewDomain, err)
	}

	// Create sponsorship record (the original sponsor is responsible)
	if msg.SponsorDomain != "" && msg.SponsorshipAmt > 0 {
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO federation_sponsorships (sponsor_domain, sponsored_domain, amount_held, status, created_at)
			VALUES ($1, $2, $3, 'active', NOW())
			ON CONFLICT (sponsor_domain, sponsored_domain) DO UPDATE SET amount_held = $3, status = 'active'`,
			msg.SponsorDomain, msg.NewDomain, msg.SponsorshipAmt,
		)
	}

	// Also add to known_nodes
	_, _ = p.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_via, last_seen)
		VALUES ($1, false, false, false, $2, NOW())
		ON CONFLICT (node_domain) DO UPDATE SET last_seen = NOW()`,
		msg.NewDomain, "propagation:"+msg.FromNode,
	)

	log.Printf("Propagator: registered propagated peer %s (sponsor: %s, propagated by: %s)",
		msg.NewDomain, msg.SponsorDomain, msg.FromNode)

	// Re-propagate to our own peers (exponential chain)
	// This establishes 1-to-1 relationships between our peers and the new node
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		p.PropagateNewPeer(bgCtx, msg.NewDomain, msg.NewPublicKey, msg.NewEndpoint, msg.NewNodeName,
			msg.SponsorDomain, msg.MembershipLevel, msg.SponsorshipAmt)
	}()

	return nil
}

// PropagateMembershipUpdate broadcasts a membership level change to all peers.
func (p *Propagator) PropagateMembershipUpdate(ctx context.Context, peerDomain, newLevelID, proposalID string) error {
	if p.Transport == nil || !p.Transport.HasPrivateKey() {
		return nil
	}

	msg := PropagationMessage{
		Type:       MsgPropMembership,
		FromNode:   p.NodeDomain,
		Timestamp:  time.Now().Unix(),
		MessageID:  GenerateMessageID(),
		PeerDomain: peerDomain,
		NewLevelID: newLevelID,
		ProposalID: proposalID,
	}

	peers, err := p.getActivePeerDomains(ctx)
	if err != nil {
		return err
	}

	for _, peerDomain := range peers {
		if peerDomain == p.NodeDomain {
			continue
		}
		if err := p.Transport.SendToPeer(ctx, peerDomain, "/api/federation/propagate/membership", msg); err != nil {
			log.Printf("Propagator: failed to propagate membership update to %s: %v", peerDomain, err)
		}
	}
	return nil
}

// ReceiveMembershipUpdate processes a membership update from another node.
func (p *Propagator) ReceiveMembershipUpdate(ctx context.Context, msg *PropagationMessage) error {
	if msg.PeerDomain == "" || msg.NewLevelID == "" {
		return fmt.Errorf("invalid membership update message")
	}

	_, err := p.Pool.Exec(ctx, `
		UPDATE federation_node_membership
		SET level_id = $2, level_updated_at = NOW(), last_level_approved_at = NOW()
		WHERE peer_domain = $1`,
		msg.PeerDomain, msg.NewLevelID,
	)
	if err != nil {
		return fmt.Errorf("updating membership: %w", err)
	}

	// If upgrading from level 1 to level 2, release sponsorship
	if msg.NewLevelID == "accepted" {
		_, _ = p.Pool.Exec(ctx, `
			UPDATE federation_sponsorships SET status = 'released', released_at = NOW()
			WHERE sponsored_domain = $1 AND status = 'active'`,
			msg.PeerDomain,
		)
	}

	log.Printf("Propagator: updated membership for %s to level %s", msg.PeerDomain, msg.NewLevelID)
	return nil
}

// PropagateUnilateralBlock broadcasts a unilateral block to all peers.
// This tells other nodes that this node has blocked commerce with blockedDomain.
// Other nodes should be aware but are not required to block.
func (p *Propagator) PropagateUnilateralBlock(ctx context.Context, blockedDomain, reason string) error {
	if p.Transport == nil || !p.Transport.HasPrivateKey() {
		return nil
	}

	// Record locally
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO federation_unilateral_blocks (blocker_domain, blocked_domain, reason, blocked_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (blocker_domain, blocked_domain) DO UPDATE SET reason = $3, blocked_at = NOW()`,
		p.NodeDomain, blockedDomain, reason,
	)
	if err != nil {
		return fmt.Errorf("recording unilateral block: %w", err)
	}

	msg := PropagationMessage{
		Type:          MsgPropBlock,
		FromNode:      p.NodeDomain,
		Timestamp:     time.Now().Unix(),
		MessageID:     GenerateMessageID(),
		BlockedDomain: blockedDomain,
		BlockReason:   reason,
	}

	peers, _ := p.getActivePeerDomains(ctx)
	for _, peerDomain := range peers {
		if peerDomain == p.NodeDomain {
			continue
		}
		if err := p.Transport.SendToPeer(ctx, peerDomain, "/api/federation/propagate/block", msg); err != nil {
			log.Printf("Propagator: failed to propagate block to %s: %v", peerDomain, err)
		}
	}

	log.Printf("Propagator: blocked %s and propagated to peers", blockedDomain)
	return nil
}

// ReceiveUnilateralBlock processes a block notification from another node.
func (p *Propagator) ReceiveUnilateralBlock(ctx context.Context, msg *PropagationMessage) error {
	_, err := p.Pool.Exec(ctx, `
		INSERT INTO federation_unilateral_blocks (blocker_domain, blocked_domain, reason, blocked_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (blocker_domain, blocked_domain) DO UPDATE SET reason = $3, blocked_at = NOW()`,
		msg.FromNode, msg.BlockedDomain, msg.BlockReason,
	)
	if err != nil {
		return fmt.Errorf("recording propagated block: %w", err)
	}
	log.Printf("Propagator: recorded block from %s against %s", msg.FromNode, msg.BlockedDomain)
	return nil
}

// PropagateExpulsion broadcasts a federation expulsion order.
// This is executed after a federation vote approves the expulsion.
// Each node individually removes the expelled node from its tables.
func (p *Propagator) PropagateExpulsion(ctx context.Context, expelledDomain, reason string) error {
	if p.Transport == nil || !p.Transport.HasPrivateKey() {
		return nil
	}

	// Execute locally first
	p.executeExpulsion(ctx, expelledDomain, reason)

	msg := PropagationMessage{
		Type:            MsgPropExpulsion,
		FromNode:        p.NodeDomain,
		Timestamp:       time.Now().Unix(),
		MessageID:       GenerateMessageID(),
		ExpelledDomain:  expelledDomain,
		ExpulsionReason: reason,
	}

	peers, _ := p.getActivePeerDomains(ctx)
	for _, peerDomain := range peers {
		if peerDomain == p.NodeDomain || peerDomain == expelledDomain {
			continue
		}
		if err := p.Transport.SendToPeer(ctx, peerDomain, "/api/federation/propagate/expulsion", msg); err != nil {
			log.Printf("Propagator: failed to propagate expulsion to %s: %v", peerDomain, err)
		}
	}

	log.Printf("Propagator: expelled %s and propagated order to peers", expelledDomain)
	return nil
}

// ReceiveExpulsionOrder processes an expulsion order from another node.
// Each node executes the expulsion individually.
func (p *Propagator) ReceiveExpulsionOrder(ctx context.Context, msg *PropagationMessage) error {
	if msg.ExpelledDomain == "" {
		return fmt.Errorf("invalid expulsion message: missing expelled_domain")
	}
	// Don't expel ourselves
	if msg.ExpelledDomain == p.NodeDomain {
		return nil
	}
	p.executeExpulsion(ctx, msg.ExpelledDomain, msg.ExpulsionReason)
	log.Printf("Propagator: executed expulsion of %s (ordered by federation)", msg.ExpelledDomain)
	return nil
}

// executeExpulsion removes a node from all federation tables locally.
func (p *Propagator) executeExpulsion(ctx context.Context, expelledDomain, reason string) {
	// Mark as expelled in known_nodes
	_, _ = p.Pool.Exec(ctx, `
		UPDATE federation_known_nodes SET is_expelled = true WHERE node_domain = $1`,
		expelledDomain,
	)

	// Remove from federation keys (revoke the individual certificate)
	_, _ = p.Pool.Exec(ctx, `
		UPDATE node_federation_keys SET status = 'removed' WHERE peer_domain = $1`,
		expelledDomain,
	)

	// Remove from peer endpoints cache
	_, _ = p.Pool.Exec(ctx, `
		DELETE FROM federation_peer_endpoints WHERE node_domain = $1`,
		expelledDomain,
	)

	// Record in expelled nodes table if it exists
	_, _ = p.Pool.Exec(ctx, `
		INSERT INTO federation_expelled_nodes (node_domain, reason, expelled_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (node_domain) DO UPDATE SET reason = $2, expelled_at = NOW()`,
		expelledDomain, reason,
	)
}

// CatchUpFromPeers requests catch-up data from an active peer.
// Used when a node comes back online after being offline.
func (p *Propagator) CatchUpFromPeers(ctx context.Context) error {
	if p.Transport == nil || !p.Transport.HasPrivateKey() {
		return nil
	}

	peers, err := p.getActivePeerDomains(ctx)
	if err != nil || len(peers) == 0 {
		return nil
	}

	// Try each peer until one responds with catch-up data
	for _, peerDomain := range peers {
		msg := PropagationMessage{
			Type:      MsgPropCatchUpReq,
			FromNode:  p.NodeDomain,
			Timestamp: time.Now().Unix(),
			MessageID: GenerateMessageID(),
		}

		// Send catch-up request — the response will be processed by ReceiveCatchUpData
		if err := p.Transport.SendToPeer(ctx, peerDomain, "/api/federation/propagate/catch-up", msg); err != nil {
			continue
		}
		// Success — one peer is enough for catch-up
		log.Printf("Propagator: catch-up request sent to %s", peerDomain)
		return nil
	}

	log.Printf("Propagator: no peers available for catch-up")
	return nil
}

// GetCatchUpData returns all federation data for a catch-up response.
func (p *Propagator) GetCatchUpData(ctx context.Context) *CatchUpData {
	data := &CatchUpData{}

	// Peers
	rows, err := p.Pool.Query(ctx, `
		SELECT peer_domain, peer_public_key, COALESCE(peer_endpoint, ''), COALESCE(peer_name, ''),
		       auto_accepted, COALESCE(propagated_by, '')
		FROM node_federation_keys WHERE status = 'active'`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var peer CatchUpPeer
			if err := rows.Scan(&peer.Domain, &peer.PublicKey, &peer.Endpoint, &peer.NodeName,
				&peer.AutoAccepted, &peer.PropagatedBy); err != nil {
				continue
			}
			data.Peers = append(data.Peers, peer)
		}
	}

	// Memberships
	rows, err = p.Pool.Query(ctx, `
		SELECT peer_domain, level_id, COALESCE(sponsored_by, ''), COALESCE(sponsor_limit_held, 0)
		FROM federation_node_membership`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var m CatchUpMembership
			if err := rows.Scan(&m.PeerDomain, &m.LevelID, &m.SponsoredBy, &m.SponsorshipHeld); err != nil {
				continue
			}
			data.Memberships = append(data.Memberships, m)
		}
	}

	// Sponsorships
	rows, err = p.Pool.Query(ctx, `
		SELECT sponsor_domain, sponsored_domain, amount_held, status
		FROM federation_sponsorships WHERE status = 'active'`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s CatchUpSponsorship
			if err := rows.Scan(&s.SponsorDomain, &s.SponsoredDomain, &s.AmountHeld, &s.Status); err != nil {
				continue
			}
			data.Sponsorships = append(data.Sponsorships, s)
		}
	}

	// Blocks
	rows, err = p.Pool.Query(ctx, `
		SELECT blocker_domain, blocked_domain, COALESCE(reason, '')
		FROM federation_unilateral_blocks`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var b CatchUpBlock
			if err := rows.Scan(&b.BlockerDomain, &b.BlockedDomain, &b.Reason); err != nil {
				continue
			}
			data.Blocks = append(data.Blocks, b)
		}
	}

	// Expelled nodes
	rows, err = p.Pool.Query(ctx, `
		SELECT node_domain, COALESCE(reason, '') FROM federation_expelled_nodes`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var e CatchUpExpelled
			if err := rows.Scan(&e.NodeDomain, &e.Reason); err != nil {
				continue
			}
			data.Expelled = append(data.Expelled, e)
		}
	}

	return data
}

// ReceiveCatchUpData applies catch-up data from another node.
func (p *Propagator) ReceiveCatchUpData(ctx context.Context, data *CatchUpData) error {
	if data == nil {
		return nil
	}

	// Apply peers
	for _, peer := range data.Peers {
		if peer.Domain == p.NodeDomain {
			continue
		}
		// Check if already known
		var known bool
		_ = p.Pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM node_federation_keys WHERE peer_domain = $1)`,
			peer.Domain,
		).Scan(&known)
		if known {
			continue
		}
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO node_federation_keys (peer_domain, peer_public_key, peer_endpoint, peer_name, status, auto_accepted, propagated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'active', $5, $6, NOW(), NOW())
			ON CONFLICT DO NOTHING`,
			peer.Domain, peer.PublicKey, peer.Endpoint, peer.NodeName, peer.AutoAccepted, peer.PropagatedBy,
		)
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO federation_peer_endpoints (node_domain, endpoint, public_key, node_name, last_updated, discovered_via)
			VALUES ($1, $2, $3, $4, NOW(), 'catch_up')
			ON CONFLICT (node_domain) DO UPDATE SET endpoint = $2, public_key = $3, node_name = $4, last_updated = NOW()`,
			peer.Domain, peer.Endpoint, peer.PublicKey, peer.NodeName,
		)
	}

	// Apply memberships
	for _, m := range data.Memberships {
		if m.PeerDomain == p.NodeDomain {
			continue
		}
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO federation_node_membership (peer_domain, level_id, joined_at, level_updated_at, sponsored_by, sponsor_limit_held)
			VALUES ($1, $2, NOW(), NOW(), $3, $4)
			ON CONFLICT (peer_domain) DO UPDATE SET level_id = $2, sponsored_by = $3, sponsor_limit_held = $4`,
			m.PeerDomain, m.LevelID, m.SponsoredBy, m.SponsorshipHeld,
		)
	}

	// Apply sponsorships
	for _, s := range data.Sponsorships {
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO federation_sponsorships (sponsor_domain, sponsored_domain, amount_held, status, created_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (sponsor_domain, sponsored_domain) DO UPDATE SET amount_held = $3, status = $4`,
			s.SponsorDomain, s.SponsoredDomain, s.AmountHeld, s.Status,
		)
	}

	// Apply blocks
	for _, b := range data.Blocks {
		_, _ = p.Pool.Exec(ctx, `
			INSERT INTO federation_unilateral_blocks (blocker_domain, blocked_domain, reason, blocked_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT DO NOTHING`,
			b.BlockerDomain, b.BlockedDomain, b.Reason,
		)
	}

	// Apply expelled nodes
	for _, e := range data.Expelled {
		p.executeExpulsion(ctx, e.NodeDomain, e.Reason)
	}

	log.Printf("Propagator: applied catch-up data (%d peers, %d memberships, %d blocks, %d expelled)",
		len(data.Peers), len(data.Memberships), len(data.Blocks), len(data.Expelled))
	return nil
}

// IsBlocked checks if either node has unilaterally blocked the other.
func (p *Propagator) IsBlocked(ctx context.Context, domainA, domainB string) (bool, error) {
	var blocked bool
	err := p.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM federation_unilateral_blocks
		 WHERE (blocker_domain = $1 AND blocked_domain = $2)
		    OR (blocker_domain = $2 AND blocked_domain = $1))`,
		domainA, domainB,
	).Scan(&blocked)
	if err != nil {
		return false, err
	}
	return blocked, nil
}

// getActivePeerDomains returns all active peer domains.
func (p *Propagator) getActivePeerDomains(ctx context.Context) ([]string, error) {
	rows, err := p.Pool.Query(ctx,
		`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var peers []string
	for rows.Next() {
		var domain string
		if err := rows.Scan(&domain); err != nil {
			continue
		}
		peers = append(peers, domain)
	}
	return peers, nil
}

// ParsePropagationMessage parses a decrypted payload into a PropagationMessage.
func ParsePropagationMessage(data []byte) (*PropagationMessage, error) {
	var msg PropagationMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("unmarshaling propagation message: %w", err)
	}
	return &msg, nil
}
