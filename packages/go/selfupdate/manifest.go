// Package selfupdate is the domain-agnostic half of a binary that updates
// itself: the signed release manifest, the verified download, and the atomic
// swap of the binary on disk. It knows nothing about what the binary does —
// the policy (when to update, which channel, what a safe moment is) belongs
// to the service, as `apps/runner/internal/updates` shows.
//
// The trust chain is one sentence: a release manifest is signed with an
// offline Ed25519 key whose public half is compiled into the binary, and an
// artifact is only ever written to disk after its SHA-256 matches the digest
// in that manifest. A server can therefore choose which version a host is
// offered, and can never choose what code it runs.
package selfupdate

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"strings"
)

// Schema is the value every manifest carries, so an old binary rejects a
// future format instead of misreading it.
const Schema = "oppenheimer.release/v1"

// Errors returned by parsing and verification. Callers map these onto their
// own catalog; nothing here knows about HTTP.
var (
	ErrSchema       = errors.New("selfupdate: unknown manifest schema")
	ErrSignature    = errors.New("selfupdate: manifest signature does not verify")
	ErrNoKeys       = errors.New("selfupdate: no release public keys compiled in")
	ErrNoArtifact   = errors.New("selfupdate: manifest has no artifact for this target")
	ErrDigest       = errors.New("selfupdate: artifact digest does not match the manifest")
	ErrSize         = errors.New("selfupdate: artifact is larger than the manifest says")
	ErrMemberAbsent = errors.New("selfupdate: archive does not contain the expected file")
)

// Artifact is one downloadable build.
type Artifact struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

// Manifest is what a release server serves and an offline key signs. The
// bytes are signed verbatim, so a manifest is verified before it is parsed
// into anything a decision is made on.
type Manifest struct {
	Schema       string `json:"schema"`
	Channel      string `json:"channel"`
	Version      string `json:"version"`
	ReleasedAt   string `json:"releasedAt"`
	MinSupported string `json:"minSupported"`
	Notes        string `json:"notes,omitempty"`
	// Urgent marks a release that must not wait for a quiet moment. It is
	// inside the signed document on purpose: the release says it, not the
	// server handing the document out.
	Urgent    bool                `json:"urgent,omitempty"`
	Artifacts map[string]Artifact `json:"artifacts"`
}

// Target is the `os/arch` key artifacts are indexed by.
func Target(goos, goarch string) string { return goos + "/" + goarch }

// CurrentTarget is the target of the running binary.
func CurrentTarget() string { return Target(runtime.GOOS, runtime.GOARCH) }

// Artifact returns the build for a target.
func (m *Manifest) Artifact(target string) (Artifact, error) {
	a, ok := m.Artifacts[target]
	if !ok || a.URL == "" || a.SHA256 == "" {
		return Artifact{}, fmt.Errorf("%w: %s", ErrNoArtifact, target)
	}
	return a, nil
}

// ParseManifest verifies the detached signature over the raw bytes and only
// then decodes them. Verification happens first on purpose: nothing in the
// document is trusted enough to branch on beforehand.
//
// The signature is base64 (standard encoding, padding optional) over the
// exact bytes served. Every key is tried, so a key roll can publish two
// public keys in one release and retire the old one later.
func ParseManifest(raw []byte, signature string, keys []ed25519.PublicKey) (*Manifest, error) {
	if len(keys) == 0 {
		return nil, ErrNoKeys
	}
	sig, err := decodeSignature(signature)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrSignature, err)
	}
	verified := false
	for _, key := range keys {
		if len(key) == ed25519.PublicKeySize && ed25519.Verify(key, raw, sig) {
			verified = true
			break
		}
	}
	if !verified {
		return nil, ErrSignature
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("selfupdate: decode manifest: %w", err)
	}
	if m.Schema != Schema {
		return nil, fmt.Errorf("%w: %q", ErrSchema, m.Schema)
	}
	if m.Version == "" {
		return nil, errors.New("selfupdate: manifest has no version")
	}
	return &m, nil
}

// ParsePublicKeys decodes base64 Ed25519 public keys, skipping blank lines and
// `#` comments so the compiled-in list can be a readable block of text. A key
// that is not a valid Ed25519 public key is an error, never a silent skip.
func ParsePublicKeys(lines string) ([]ed25519.PublicKey, error) {
	var keys []ed25519.PublicKey
	for _, line := range strings.Split(lines, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		raw, err := base64.StdEncoding.DecodeString(line)
		if err != nil {
			return nil, fmt.Errorf("selfupdate: decode public key: %w", err)
		}
		if len(raw) != ed25519.PublicKeySize {
			return nil, fmt.Errorf("selfupdate: public key is %d bytes, want %d", len(raw), ed25519.PublicKeySize)
		}
		keys = append(keys, ed25519.PublicKey(raw))
	}
	return keys, nil
}

func decodeSignature(signature string) ([]byte, error) {
	s := strings.TrimSpace(signature)
	enc := base64.StdEncoding
	if !strings.HasSuffix(s, "=") && len(s)%4 != 0 {
		enc = base64.RawStdEncoding
	}
	sig, err := enc.DecodeString(s)
	if err != nil {
		return nil, err
	}
	if len(sig) != ed25519.SignatureSize {
		return nil, fmt.Errorf("signature is %d bytes, want %d", len(sig), ed25519.SignatureSize)
	}
	return sig, nil
}
