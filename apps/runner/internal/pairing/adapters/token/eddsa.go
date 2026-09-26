// Package token signs the boot JWT with the host's Ed25519 key. It is the one
// place golang-jwt is named on this side of the hexagon.
package token

import (
	"crypto/ed25519"

	"github.com/golang-jwt/jwt/v5"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

var _ app.TokenSigner = (*Signer)(nil)

// Signer produces EdDSA JWTs.
type Signer struct{}

// New builds the signer.
func New() *Signer { return &Signer{} }

// Sign renders the claims as a compact EdDSA JWT.
func (s *Signer) Sign(key ed25519.PrivateKey, c domain.BootClaims) (string, error) {
	claims := jwt.RegisteredClaims{
		Issuer:    c.Issuer,
		Subject:   c.Subject,
		Audience:  jwt.ClaimStrings{c.Audience},
		ID:        c.ID,
		IssuedAt:  jwt.NewNumericDate(c.IssuedAt),
		ExpiresAt: jwt.NewNumericDate(c.ExpiresAt),
	}
	return jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims).SignedString(key)
}
