// Package domain is the host's identity: the keypair it proves itself with,
// the control plane it belongs to, and the pin it refuses to talk to anyone
// else by.
package domain

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// TokenPrefix marks a registration token, so a user who pastes the wrong
// secret is told which one they pasted rather than getting a 401 an hour later.
const TokenPrefix = "opr_reg_" //nolint:gosec // a prefix to recognise tokens by, not a credential

// BootTokenTTL is how long the JWT a runner signs on each dial is good for.
// Short, because it is minted on demand and never stored.
const BootTokenTTL = 5 * time.Minute

// Channel is the release channel a host follows.
type Channel string

// Channels.
const (
	ChannelStable Channel = "stable"
	ChannelBeta   Channel = "beta"
)

// Valid reports whether the channel is one we publish.
func (c Channel) Valid() bool { return c == ChannelStable || c == ChannelBeta }

// Identity is what `runner register` writes and everything else reads. It is
// persisted as config.json; the private key is a separate 0600 file, because
// the config is printed by `runner status` and the key never is.
type Identity struct {
	HostID string `json:"hostId"`
	Name   string `json:"name"`
	// ControlPlaneURL is the only origin this runner will speak to.
	ControlPlaneURL string `json:"controlPlaneUrl"`
	// Fingerprint pins the control plane's public key (F6).
	Fingerprint string `json:"fingerprint"`
	// PublicKey is this host's own key, base64, kept for display and for
	// proving to a user that a rotation actually happened.
	PublicKey string `json:"publicKey"`
	// ReleaseBaseURL is where signed artifacts are fetched from.
	ReleaseBaseURL string  `json:"releaseBaseUrl,omitempty"`
	Channel        Channel `json:"channel"`
	// PinnedVersion freezes this host: no automatic update while it is set.
	PinnedVersion string `json:"pinnedVersion,omitempty"`
	// WorkspacesPath is where sessions' checkouts live when the user chose a
	// directory other than the default at install. Empty means the default.
	// It is a local setting, so a fresh registration keeps it.
	WorkspacesPath string    `json:"workspacesPath,omitempty"`
	RegisteredAt   time.Time `json:"registeredAt"`
	// RevokedAt is when the control plane refused this host as unpaired. The
	// identity is kept, so `status` can say what happened and `uninstall` can
	// still sign its call; the daemon stops dialling, and a fresh registration
	// replaces it without --force.
	RevokedAt *time.Time `json:"revokedAt,omitempty"`
}

// Revoked reports whether the control plane has unpaired this host.
func (i Identity) Revoked() bool { return i.RevokedAt != nil }

// Sentinel conditions of this context.
var (
	ErrNotPaired      = errors.New("host is not paired")
	ErrAlreadyPaired  = errors.New("host is already paired")
	ErrTokenShape     = errors.New("registration token has the wrong shape")
	ErrControlPlane   = errors.New("control plane URL is not usable")
	ErrKeyPermissions = errors.New("private key is readable by others")
)

// Validate reports an identity that could not have come from a registration.
func (i Identity) Validate() error {
	if i.HostID == "" {
		return fmt.Errorf("%w: no host id", ErrNotPaired)
	}
	if err := ValidateControlPlaneURL(i.ControlPlaneURL); err != nil {
		return err
	}
	if !i.Channel.Valid() {
		return fmt.Errorf("%w: unknown channel %q", ErrNotPaired, i.Channel)
	}
	return nil
}

// Pinned reports whether automatic updates are frozen on this host.
func (i Identity) Pinned() bool { return i.PinnedVersion != "" }

// ValidateControlPlaneURL refuses anything that is not an absolute HTTPS URL,
// with one exception for local development against a loopback control plane.
func ValidateControlPlaneURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return fmt.Errorf("%w: %q", ErrControlPlane, raw)
	}
	if u.Scheme == "https" {
		return nil
	}
	if u.Scheme == "http" && isLoopback(u.Hostname()) {
		return nil
	}
	return fmt.Errorf("%w: %q is not https", ErrControlPlane, raw)
}

func isLoopback(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// ValidateToken checks the shape of a registration token before it is spent.
// It cannot tell a valid token from an expired one — only the control plane
// can — but it can tell a token from a pasted session cookie.
func ValidateToken(token string) error {
	token = strings.TrimSpace(token)
	if !strings.HasPrefix(token, TokenPrefix) || len(token) <= len(TokenPrefix)+16 {
		return fmt.Errorf("%w: expected a %s… token from Settings → Add host", ErrTokenShape, TokenPrefix)
	}
	return nil
}

// GenerateKey makes the host's Ed25519 keypair. It is generated on the host
// and the private half never leaves it: registration sends the public key, so
// the control plane cannot impersonate one of its own hosts.
func GenerateKey() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	return ed25519.GenerateKey(rand.Reader)
}

// EncodePublicKey renders a public key for the wire and for config.json.
func EncodePublicKey(pub ed25519.PublicKey) string {
	return base64.StdEncoding.EncodeToString(pub)
}

// KeyFingerprint is the SHA-256 of a public key as colon-free hex, the form
// shown next to a host in the console.
func KeyFingerprint(pub ed25519.PublicKey) string {
	sum := sha256.Sum256(pub)
	return hex.EncodeToString(sum[:])
}

// BootClaims are the claims of the short-lived JWT signed on every dial.
type BootClaims struct {
	Issuer    string
	Subject   string
	Audience  string
	ID        string
	IssuedAt  time.Time
	ExpiresAt time.Time
}

// NewBootClaims builds the claims for a dial at `now`.
func NewBootClaims(i Identity, jti string, now time.Time) BootClaims {
	return BootClaims{
		Issuer:    i.HostID,
		Subject:   i.HostID,
		Audience:  i.ControlPlaneURL,
		ID:        jti,
		IssuedAt:  now,
		ExpiresAt: now.Add(BootTokenTTL),
	}
}
