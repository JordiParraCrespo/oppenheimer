package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

// Options configure the pairing service.
type Options struct {
	Store        Store
	ControlPlane ControlPlane
	Signer       TokenSigner
	// Now is injectable so token expiry is testable.
	Now func() time.Time
}

// Service is the pairing use cases.
type Service struct {
	store  Store
	cp     ControlPlane
	signer TokenSigner
	now    func() time.Time
}

// New builds the service.
func New(opts Options) *Service {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	return &Service{store: opts.Store, cp: opts.ControlPlane, signer: opts.Signer, now: now}
}

// RegisterInput is what the `register` subcommand collects.
type RegisterInput struct {
	Token           string
	ControlPlaneURL string
	Name            string
	Facts           json.RawMessage
	// Force re-pairs a host that already has an identity, which is how a
	// machine moves to another workspace.
	Force bool
}

// Register redeems a one-hour, single-use registration token: it generates the
// keypair, sends the public half with the host's facts, and stores what comes
// back. The token is never written to disk — it is spent here and forgotten.
func (s *Service) Register(ctx context.Context, in RegisterInput) (domain.Identity, error) {
	token := strings.TrimSpace(in.Token)
	if err := domain.ValidateToken(token); err != nil {
		return domain.Identity{}, domain.ErrTokenRejected.WithDetail("%v", err).WithCause(err)
	}
	url := strings.TrimRight(strings.TrimSpace(in.ControlPlaneURL), "/")
	if err := domain.ValidateControlPlaneURL(url); err != nil {
		return domain.Identity{}, domain.ErrControlPlaneURL.WithDetail("%v", err).WithCause(err)
	}
	if existing, _, err := s.store.Load(); err == nil && existing.HostID != "" && !in.Force {
		return domain.Identity{}, domain.ErrAlreadyRegisted.WithDetail(
			"this host is already paired as %s; re-run with --force to move it", existing.HostID)
	}

	pub, priv, err := domain.GenerateKey()
	if err != nil {
		return domain.Identity{}, domain.ErrKeyStore.WithDetail("generate a keypair: %v", err).WithCause(err)
	}
	resp, err := s.cp.Register(ctx, url, RegisterRequest{
		Token:     token,
		Name:      in.Name,
		PublicKey: domain.EncodePublicKey(pub),
		Facts:     in.Facts,
	})
	if err != nil {
		return domain.Identity{}, err
	}
	if resp.HostID == "" {
		return domain.Identity{}, domain.ErrTokenRejected.WithDetail("the control plane returned no host id")
	}

	channel := domain.Channel(resp.Channel)
	if !channel.Valid() {
		channel = domain.ChannelStable
	}
	identity := domain.Identity{
		HostID:          resp.HostID,
		Name:            in.Name,
		ControlPlaneURL: url,
		Fingerprint:     resp.Fingerprint,
		PublicKey:       domain.EncodePublicKey(pub),
		ReleaseBaseURL:  resp.ReleaseBaseURL,
		Channel:         channel,
		RegisteredAt:    s.now().UTC(),
	}
	if err := s.store.Save(identity, priv); err != nil {
		return domain.Identity{}, domain.ErrKeyStore.WithDetail("%v", err).WithCause(err)
	}
	return identity, nil
}

// Identity returns the stored identity, or PAIR_001 when the host has never
// been paired — the error every subcommand that needs a host id reports.
func (s *Service) Identity() (domain.Identity, error) {
	identity, _, err := s.store.Load()
	switch {
	case errors.Is(err, domain.ErrNotPaired):
		return domain.Identity{}, domain.ErrNotRegistered.WithDetail(
			"run the install command from Settings → Add host on this machine").WithCause(err)
	case errors.Is(err, domain.ErrKeyPermissions):
		return domain.Identity{}, domain.ErrKeyStore.WithDetail("%v", err).WithCause(err)
	case err != nil:
		return domain.Identity{}, domain.ErrKeyStore.WithDetail("%v", err).WithCause(err)
	}
	if err := identity.Validate(); err != nil {
		return domain.Identity{}, domain.ErrNotRegistered.WithDetail("%v", err).WithCause(err)
	}
	return identity, nil
}

// BootToken mints the short-lived JWT the runner presents on every dial. It is
// signed by the host key, so possession of the file — not a stored bearer
// token — is what authenticates the host.
func (s *Service) BootToken(_ context.Context) (string, error) {
	identity, key, err := s.store.Load()
	if err != nil {
		return "", domain.ErrNotRegistered.WithCause(err)
	}
	jti := make([]byte, 16)
	if _, err := rand.Read(jti); err != nil {
		return "", domain.ErrKeyStore.WithDetail("generate a token id: %v", err).WithCause(err)
	}
	claims := domain.NewBootClaims(identity, hex.EncodeToString(jti), s.now().UTC())
	token, err := s.signer.Sign(key, claims)
	if err != nil {
		return "", domain.ErrKeyStore.WithDetail("sign the boot token: %v", err).WithCause(err)
	}
	return token, nil
}

// RotateKey is not available yet, and says so instead of guessing. Rotation
// (F8) is a runner-initiated frame on the link, signed by the current key and
// carrying the next public key, acknowledged before the runner switches
// (product/versions/mvp/10-api-modules-and-data-model.md), and that link is
// the next slice. What stood here sent the boot JWT in the register route's
// `token` field, a route that redeems registration tokens and would reject a
// JWT — a rotation that looks like it works and leaves the host on its old
// key is worse than one that refuses.
func (s *Service) RotateKey(context.Context) (domain.Identity, error) {
	if _, err := s.Identity(); err != nil {
		return domain.Identity{}, err
	}
	return domain.Identity{}, domain.ErrRotationNeedsLink.WithDetail(
		"the host key rotates over the control-plane link, which this build does not have yet; " +
			"re-pair with `runner register --force` to move this host onto a new key")
}

// SetChannel and SetPin are the two settings a user changes after pairing.
func (s *Service) SetChannel(channel domain.Channel) (domain.Identity, error) {
	if !channel.Valid() {
		return domain.Identity{}, domain.ErrControlPlaneURL.WithDetail("unknown channel %q", channel)
	}
	return s.mutate(func(i *domain.Identity) { i.Channel = channel })
}

// SetPin freezes or unfreezes automatic updates on this host.
func (s *Service) SetPin(version string) (domain.Identity, error) {
	return s.mutate(func(i *domain.Identity) { i.PinnedVersion = version })
}

// Unregister revokes the host at the control plane and erases the local
// identity. A control plane that cannot be reached does not stop the local
// half: the user asked for this machine to stop being a host.
func (s *Service) Unregister(ctx context.Context) error {
	identity, err := s.Identity()
	if err != nil {
		return err
	}
	if assertion, tokenErr := s.BootToken(ctx); tokenErr == nil {
		_ = s.cp.Revoke(ctx, identity.ControlPlaneURL, assertion)
	}
	if err := s.store.Clear(); err != nil {
		return domain.ErrKeyStore.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

func (s *Service) mutate(apply func(*domain.Identity)) (domain.Identity, error) {
	identity, err := s.Identity()
	if err != nil {
		return domain.Identity{}, err
	}
	apply(&identity)
	if err := s.store.SaveIdentity(identity); err != nil {
		return domain.Identity{}, domain.ErrKeyStore.WithDetail("%v", err).WithCause(err)
	}
	return identity, nil
}
