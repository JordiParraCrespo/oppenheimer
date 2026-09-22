package token

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/sha512"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/curve25519"
	"golang.org/x/crypto/hkdf"
)

// SealInfo is the HKDF info string both halves of the scheme use; the other
// half is `apps/api/src/relay/infrastructure/seal.util.ts`, which documents it.
const SealInfo = "oppenheimer credentials.grant v1"

const (
	ephemeralBytes = 32
	nonceBytes     = 12
	tagBytes       = 16
)

// ErrSealed is what every malformed or tampered box answers, so a caller
// cannot learn which check refused it.
var ErrSealed = errors.New("sealed box rejected")

// Unseal opens a box the control plane sealed to this host's key:
// `ephemeral X25519 public (32) ‖ nonce (12) ‖ ciphertext ‖ tag (16)`, AES-256-GCM
// under HKDF-SHA256(X25519(host private, ephemeral public), salt = ephemeral ‖
// host Ed25519 public, info = SealInfo).
func Unseal(key ed25519.PrivateKey, sealed []byte) ([]byte, error) {
	if len(key) != ed25519.PrivateKeySize || len(sealed) < ephemeralBytes+nonceBytes+tagBytes {
		return nil, ErrSealed
	}
	ephemeral := sealed[:ephemeralBytes]
	nonce := sealed[ephemeralBytes : ephemeralBytes+nonceBytes]
	box := sealed[ephemeralBytes+nonceBytes:]

	// The X25519 private scalar of an Ed25519 key is the clamped low half of
	// SHA-512(seed) — the same derivation Ed25519 itself uses for signing.
	digest := sha512.Sum512(key.Seed())
	scalar := digest[:32]
	scalar[0] &= 248
	scalar[31] &= 127
	scalar[31] |= 64
	shared, err := curve25519.X25519(scalar, ephemeral)
	if err != nil {
		return nil, ErrSealed
	}
	hostPublic := key.Public().(ed25519.PublicKey)
	salt := append(append([]byte{}, ephemeral...), hostPublic...)
	aeadKey := make([]byte, 32)
	if _, err := io.ReadFull(hkdf.New(sha256.New, shared, salt, []byte(SealInfo)), aeadKey); err != nil {
		return nil, ErrSealed
	}
	block, err := aes.NewCipher(aeadKey)
	if err != nil {
		return nil, ErrSealed
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrSealed
	}
	plain, err := gcm.Open(nil, nonce, box, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrSealed, err)
	}
	return plain, nil
}

// Unsealer is the adapter form of Unseal, for the pairing service's port.
type Unsealer struct{}

// Unseal implements app.Unsealer.
func (Unsealer) Unseal(key ed25519.PrivateKey, sealed []byte) ([]byte, error) {
	return Unseal(key, sealed)
}
