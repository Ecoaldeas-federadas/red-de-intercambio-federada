package federation

import (
	"testing"
)

// TestShuffleStrings verifies that shuffleStrings produces a permutation
// containing the same elements.
func TestShuffleStrings(t *testing.T) {
	original := []string{"123456", "234567", "345678", "456789"}
	shuffled := make([]string, len(original))
	copy(shuffled, original)
	shuffleStrings(shuffled)

	// Same length
	if len(shuffled) != len(original) {
		t.Errorf("shuffle changed length: %d vs %d", len(shuffled), len(original))
	}

	// Same elements (order may differ)
	seen := make(map[string]bool)
	for _, s := range shuffled {
		seen[s] = true
	}
	for _, s := range original {
		if !seen[s] {
			t.Errorf("shuffle lost element: %s", s)
		}
	}
}

// TestGenerateFederationPairingCode verifies code generation produces 6-digit codes.
func TestGenerateFederationPairingCode(t *testing.T) {
	for i := 0; i < 100; i++ {
		code, err := generateFederationPairingCode()
		if err != nil {
			t.Fatalf("error generating code: %v", err)
		}
		if len(code) != 6 {
			t.Errorf("code length = %d, want 6 (code: %s)", len(code), code)
		}
		for _, c := range code {
			if c < '0' || c > '9' {
				t.Errorf("code contains non-digit: %s", code)
			}
		}
	}
}

// TestVerifyChainEntryValidFormat verifies that a chain entry with correct format
// can be verified (the hash computation doesn't panic).
func TestVerifyChainEntryValidFormat(t *testing.T) {
	entry := &ChainEntry{
		TxID:              "test-tx-id",
		PoolType:          "global",
		SenderNode:        "nodeA",
		ReceiverNode:      "nodeB",
		Amount:            100,
		SenderSignature:   "sigA",
		ReceiverSignature: "sigB",
		PrevHash:          "",
		TxHash:            "dummy",
	}
	// VerifyChainEntry should return false (hash doesn't match "dummy")
	// but should not panic
	result := (&Reconciler{}).VerifyChainEntry(entry)
	if result {
		t.Error("VerifyChainEntry should return false for mismatched hash")
	}
}
