// Package app holds the pairing use cases: redeem a registration token, read
// the identity back, mint a boot token. Every side effect — the files, the
// network, the signature — is a port.
package app

import (
	"context"
	"crypto/ed25519"
	"encoding/json"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

// Store persists the identity and the private key. Implementations keep the
// key 0600 and the directory 0700; `Load` reports ErrKeyPermissions rather
// than reading a key anyone else can (F8).
type Store interface {
	Load() (domain.Identity, ed25519.PrivateKey, error)
	Save(domain.Identity, ed25519.PrivateKey) error
	SaveIdentity(domain.Identity) error
	Clear() error
}

// RegisterRequest is what a host sends to redeem its token. Facts are opaque
// here: the host inventory is another context's domain, and this one only
// forwards it.
type RegisterRequest struct {
	Token     string          `json:"token"`
	Name      string          `json:"name"`
	PublicKey string          `json:"publicKey"`
	Facts     json.RawMessage `json:"facts,omitempty"`
}

// RegisterResponse is what the control plane answers with: the host's id and
// the key fingerprint the runner pins from then on.
type RegisterResponse struct {
	HostID         string `json:"hostId"`
	Fingerprint    string `json:"fingerprint"`
	Channel        string `json:"channel,omitempty"`
	ReleaseBaseURL string `json:"releaseBaseUrl,omitempty"`
}

// ControlPlane is the registration endpoint. `Revoke` is the uninstall half:
// it tells the control plane this host is gone, authenticated by the boot
// assertion rather than by the spent registration token — which is also how
// the host names itself, so no id is passed.
type ControlPlane interface {
	Register(ctx context.Context, baseURL string, req RegisterRequest) (RegisterResponse, error)
	Revoke(ctx context.Context, baseURL, assertion string) error
}

// TokenSigner turns claims into the compact JWT a dial carries.
type TokenSigner interface {
	Sign(key ed25519.PrivateKey, claims domain.BootClaims) (string, error)
}

// Unsealer opens a box the control plane sealed to this host's key (F7).
type Unsealer interface {
	Unseal(key ed25519.PrivateKey, sealed []byte) ([]byte, error)
}
