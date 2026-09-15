// Package domain holds the API-key aggregate: what a key is, how one is
// generated and how a presented secret is checked. It knows nothing about
// HTTP or storage.
package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
)

// TokenPrefix marks a key minted by this service, so a bearer value can be
// routed to the right verifier and recognised in a leak scan.
const TokenPrefix = "flr"

// displayChars of the secret are kept in the non-secret display prefix, the
// same convention `apps/api` uses for `oppenheimer_pat_a1b2c3`.
const displayChars = 6

const secretBytes = 32

// Key is a stored credential. The secret is never stored: only its hash.
type Key struct {
	ID   string
	Name string
	// Prefix is the non-secret display form, e.g. `flr_k3x9…_a1b2c3`.
	Prefix string
	// Hash is the hex SHA-256 of the full token. Tokens carry 256 bits of
	// randomness, so a fast hash is the right choice; a password KDF would
	// only slow down every request.
	Hash       string
	Scopes     []scope.Scope
	CreatedBy  string
	CreatedAt  time.Time
	ExpiresAt  *time.Time
	RevokedAt  *time.Time
	LastUsedAt *time.Time
}

// Generate mints a key and returns the one-time plaintext token.
func Generate(name string, granted []scope.Scope, createdBy string, expiresAt *time.Time, now time.Time) (Key, string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Key{}, "", ErrNameRequired
	}
	if len(granted) == 0 {
		return Key{}, "", ErrScopesRequired
	}
	if expiresAt != nil && !expiresAt.After(now) {
		return Key{}, "", ErrExpiryInPast
	}

	id, err := randomID()
	if err != nil {
		return Key{}, "", err
	}
	raw := make([]byte, secretBytes)
	if _, err := rand.Read(raw); err != nil {
		return Key{}, "", err
	}
	secret := base64.RawURLEncoding.EncodeToString(raw)
	token := TokenPrefix + "_" + id + "_" + secret

	key := Key{
		ID:        id,
		Name:      name,
		Prefix:    TokenPrefix + "_" + id + "_" + secret[:displayChars],
		Hash:      HashToken(token),
		Scopes:    append([]scope.Scope(nil), granted...),
		CreatedBy: createdBy,
		CreatedAt: now,
		ExpiresAt: expiresAt,
	}
	return key, token, nil
}

// randomID is 80 bits of randomness as 16 lowercase base32 characters:
// unguessable, URL-safe, and short enough to read aloud.
func randomID() (string, error) {
	raw := make([]byte, 10)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)), nil
}

// HashToken is the stored form of a token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// IsToken reports whether a bearer value has this service's key shape.
func IsToken(token string) bool {
	return strings.HasPrefix(token, TokenPrefix+"_")
}

// ParseToken extracts the key id from a token so the store can look it up
// before the (constant-time) hash comparison.
func ParseToken(token string) (id string, ok bool) {
	// The secret is base64url and may itself contain "_", so split at most twice.
	parts := strings.SplitN(token, "_", 3)
	if len(parts) != 3 || parts[0] != TokenPrefix || parts[1] == "" || parts[2] == "" {
		return "", false
	}
	return parts[1], true
}

// Matches compares a presented token to the stored hash in constant time.
func (k *Key) Matches(token string) bool {
	presented := HashToken(token)
	return subtle.ConstantTimeCompare([]byte(presented), []byte(k.Hash)) == 1
}

// Active reports whether the key may authenticate at `now`.
func (k *Key) Active(now time.Time) bool {
	if k.RevokedAt != nil {
		return false
	}
	if k.ExpiresAt != nil && !now.Before(*k.ExpiresAt) {
		return false
	}
	return true
}

// Revoke marks the key unusable. Revoking twice is a no-op error the
// caller reports as a conflict.
func (k *Key) Revoke(now time.Time) error {
	if k.RevokedAt != nil {
		return ErrAlreadyRevoked
	}
	k.RevokedAt = &now
	return nil
}

// Sentinel validation errors the use case maps to problems.
var (
	ErrNameRequired   = errors.New("name is required")
	ErrScopesRequired = errors.New("at least one scope is required")
	ErrExpiryInPast   = errors.New("expiry must be in the future")
)
