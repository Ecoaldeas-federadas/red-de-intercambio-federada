package ledger

import (
	"testing"
)

// TestPoolTypeConstants verifies that pool type constants are distinct.
func TestPoolTypeConstants(t *testing.T) {
	if PoolTypeGlobal == PoolTypeBilateral {
		t.Error("PoolTypeGlobal and PoolTypeBilateral should be different")
	}
	if PoolTypeGlobal != "global" {
		t.Errorf("PoolTypeGlobal = %s, want 'global'", PoolTypeGlobal)
	}
	if PoolTypeBilateral != "bilateral" {
		t.Errorf("PoolTypeBilateral = %s, want 'bilateral'", PoolTypeBilateral)
	}
}

// TestAccountCategoryConstants verifies that new categories are distinct from old ones.
func TestAccountCategoryConstants(t *testing.T) {
	categories := []AccountCategory{
		CategoryUserBalance,
		CategoryNodeBridge,
		CategoryNodeBridgeGlobal,
		CategoryNodeBridgeBilateral,
		CategoryFund,
		CategoryExternalBridge,
	}
	seen := make(map[AccountCategory]bool)
	for _, c := range categories {
		if seen[c] {
			t.Errorf("duplicate category: %s", c)
		}
		seen[c] = true
	}

	// Verify the new categories are distinct from the old node_bridge
	if CategoryNodeBridgeGlobal == CategoryNodeBridge {
		t.Error("CategoryNodeBridgeGlobal should be different from CategoryNodeBridge")
	}
	if CategoryNodeBridgeBilateral == CategoryNodeBridge {
		t.Error("CategoryNodeBridgeBilateral should be different from CategoryNodeBridge")
	}
	if CategoryNodeBridgeGlobal == CategoryNodeBridgeBilateral {
		t.Error("CategoryNodeBridgeGlobal should be different from CategoryNodeBridgeBilateral")
	}
}

// TestCrossNodeTransferParamsPoolType verifies that PoolType field exists and defaults correctly.
func TestCrossNodeTransferParamsPoolType(t *testing.T) {
	p := CrossNodeTransferParams{}
	if p.PoolType != "" {
		t.Errorf("default PoolType = %s, want empty", p.PoolType)
	}
	p.PoolType = PoolTypeGlobal
	if p.PoolType != PoolTypeGlobal {
		t.Errorf("PoolType = %s, want %s", p.PoolType, PoolTypeGlobal)
	}
	p.PoolType = PoolTypeBilateral
	if p.PoolType != PoolTypeBilateral {
		t.Errorf("PoolType = %s, want %s", p.PoolType, PoolTypeBilateral)
	}
}
