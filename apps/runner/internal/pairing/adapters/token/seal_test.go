package token_test

import (
	"crypto/ed25519"
	"encoding/hex"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/token"
)

// The vector was produced by the control plane's half
// (`apps/api/src/relay/infrastructure/seal.util.ts`) for the Ed25519 seed
// 0x01..0x20; opening it here is what proves the two halves agree.
const (
	vectorPublic = "79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664"
	vectorSealed = "e1f9c2faca2faceb526d407578ad4d4c8c021e8a11acf23675e1beffcbe3e632e2c0176d0a4cf8297e18993c500e9ed58af26efa2382b0ff0616bfee1b6ed5a055738af8fc02b02deeaa009eb4dab228d56dab692d7ff1c7"
	vectorPlain  = "ghs_example_token_0123456789"
)

func vectorKey(t *testing.T) ed25519.PrivateKey {
	t.Helper()
	seed := make([]byte, ed25519.SeedSize)
	for i := range seed {
		seed[i] = byte(i + 1)
	}
	key := ed25519.NewKeyFromSeed(seed)
	if got := hex.EncodeToString(key.Public().(ed25519.PublicKey)); got != vectorPublic {
		t.Fatalf("public key %s does not match the vector's %s", got, vectorPublic)
	}
	return key
}

func TestUnsealOpensWhatTheControlPlaneSealed(t *testing.T) {
	sealed, _ := hex.DecodeString(vectorSealed)
	plain, err := token.Unseal(vectorKey(t), sealed)
	if err != nil {
		t.Fatalf("unseal: %v", err)
	}
	if string(plain) != vectorPlain {
		t.Fatalf("plaintext = %q", plain)
	}
}

func TestUnsealRefusesATamperedBoxAndTheWrongKey(t *testing.T) {
	sealed, _ := hex.DecodeString(vectorSealed)
	tampered := append([]byte{}, sealed...)
	tampered[len(tampered)-1] ^= 1
	if _, err := token.Unseal(vectorKey(t), tampered); !errors.Is(err, token.ErrSealed) {
		t.Fatalf("tampered box: %v", err)
	}
	_, other, _ := ed25519.GenerateKey(nil)
	if _, err := token.Unseal(other, sealed); !errors.Is(err, token.ErrSealed) {
		t.Fatalf("wrong key: %v", err)
	}
	if _, err := token.Unseal(vectorKey(t), sealed[:40]); !errors.Is(err, token.ErrSealed) {
		t.Fatalf("short box: %v", err)
	}
}
