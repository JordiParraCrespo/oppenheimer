package app

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// BootstrapID is the principal id of the environment-provided key.
const BootstrapID = "bootstrap"

// Service is the API-key use case surface. It also implements auth.Verifier
// so the auth middleware can resolve keys without importing this package's
// adapters.
type Service struct {
	repo   Repository
	issuer TokenIssuer
	logger *slog.Logger
	now    Clock

	bootstrapHash string
	tokenTTL      time.Duration
}

// Options wire the service.
type Options struct {
	Repository Repository
	// BootstrapKey is the environment key that exists before any is issued.
	BootstrapKey string
	// Issuer enables service tokens when non-nil.
	Issuer   TokenIssuer
	TokenTTL time.Duration
	Logger   *slog.Logger
	Clock    Clock
}

// New builds the service.
func New(opts Options) *Service {
	now := opts.Clock
	if now == nil {
		now = time.Now
	}
	return &Service{
		repo:          opts.Repository,
		issuer:        opts.Issuer,
		logger:        opts.Logger,
		now:           now,
		bootstrapHash: domain.HashToken(opts.BootstrapKey),
		tokenTTL:      opts.TokenTTL,
	}
}

// CreateInput is what a caller supplies for a new key.
type CreateInput struct {
	Name      string
	Scopes    []string
	ExpiresAt *time.Time
}

// Created is a new key plus the plaintext token, shown exactly once.
type Created struct {
	Key   domain.Key
	Token string
}

// Create mints a key for the caller. A key can never hold more reach than
// its creator: scopes are checked against the principal on the context.
func (s *Service) Create(ctx context.Context, in CreateInput) (Created, error) {
	caller := auth.FromContext(ctx)
	if caller == nil {
		return Created{}, problem.ErrUnauthorized
	}
	granted, err := scopes.ParseAll(in.Scopes)
	if err != nil {
		return Created{}, problem.ErrValidation.WithDetail("%s", err.Error()).
			WithInvalidParams(problem.InvalidParam{Name: "scopes", Reason: err.Error()})
	}
	if missing := caller.Scopes.Missing(granted...); len(missing) > 0 {
		return Created{}, domain.ErrScopeEscalation.WithDetail("caller lacks %v", missing)
	}

	key, token, err := domain.Generate(in.Name, granted, caller.ID, in.ExpiresAt, s.now())
	if err != nil {
		return Created{}, validation(err)
	}
	if err := s.repo.Save(ctx, key); err != nil {
		return Created{}, fmt.Errorf("save api key: %w", err)
	}
	s.logger.InfoContext(ctx, "api key created",
		slog.String("keyId", key.ID), slog.String("name", key.Name), slog.String("createdBy", caller.ID))
	return Created{Key: key, Token: token}, nil
}

// Get returns one key's metadata.
func (s *Service) Get(ctx context.Context, id string) (domain.Key, error) {
	key, err := s.repo.FindByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return domain.Key{}, domain.ErrKeyNotFound.WithDetail("key %q", id)
	}
	return key, err
}

// List returns every key's metadata, newest first.
func (s *Service) List(ctx context.Context) ([]domain.Key, error) {
	return s.repo.List(ctx)
}

// Revoke disables a key immediately.
func (s *Service) Revoke(ctx context.Context, id string) error {
	key, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if err := key.Revoke(s.now()); err != nil {
		return domain.ErrAlreadyRevoked.WithDetail("key %q", id)
	}
	if err := s.repo.Save(ctx, key); err != nil {
		return fmt.Errorf("save api key: %w", err)
	}
	s.logger.InfoContext(ctx, "api key revoked", slog.String("keyId", id))
	return nil
}

// IssueServiceToken mints a short-lived JWT carrying a subset of the
// caller's scopes, for an agent the caller is bootstrapping.
func (s *Service) IssueServiceToken(ctx context.Context, subject, name string, requested []string) (token string, expiresAt time.Time, err error) {
	if s.issuer == nil {
		return "", time.Time{}, domain.ErrTokensDisabled
	}
	caller := auth.FromContext(ctx)
	if caller == nil {
		return "", time.Time{}, problem.ErrUnauthorized
	}
	if subject == "" {
		return "", time.Time{}, problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "subject", Reason: "required"})
	}
	granted, err := scopes.ParseAll(requested)
	if err != nil {
		return "", time.Time{}, problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "scopes", Reason: err.Error()})
	}
	if missing := caller.Scopes.Missing(granted...); len(missing) > 0 {
		return "", time.Time{}, domain.ErrScopeEscalation.WithDetail("caller lacks %v", missing)
	}
	now := s.now()
	token, err = s.issuer.Issue(subject, name, scope.NewSet(granted...), s.tokenTTL, now)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("issue service token: %w", err)
	}
	return token, now.Add(s.tokenTTL), nil
}

// Accepts claims every non-JWT bearer value: minted keys by their prefix,
// and whatever else might be the bootstrap key. Ordering in the middleware
// puts the JWT verifier first.
func (s *Service) Accepts(token string) bool {
	return true
}

// Verify resolves a bearer token to a principal.
func (s *Service) Verify(ctx context.Context, token string) (*auth.Principal, error) {
	if !domain.IsToken(token) {
		return s.verifyBootstrap(token)
	}
	id, ok := domain.ParseToken(token)
	if !ok {
		return nil, fmt.Errorf("%w: malformed key", auth.ErrInvalidCredential)
	}
	key, err := s.repo.FindByID(ctx, id)
	if err != nil {
		// Still hash the presented token so an unknown id costs the same
		// as a known one.
		_ = domain.HashToken(token)
		return nil, fmt.Errorf("%w: unknown key", auth.ErrInvalidCredential)
	}
	if !key.Matches(token) {
		return nil, fmt.Errorf("%w: secret mismatch", auth.ErrInvalidCredential)
	}
	now := s.now()
	if !key.Active(now) {
		return nil, fmt.Errorf("%w: key revoked or expired", auth.ErrInvalidCredential)
	}
	if err := s.repo.Touch(ctx, key.ID, now); err != nil {
		s.logger.WarnContext(ctx, "could not record key use", slog.String("keyId", key.ID), slog.Any("error", err))
	}
	return &auth.Principal{
		ID:     key.ID,
		Name:   key.Name,
		Kind:   auth.KindAPIKey,
		Scopes: scope.NewSet(key.Scopes...),
	}, nil
}

func (s *Service) verifyBootstrap(token string) (*auth.Principal, error) {
	presented := domain.HashToken(token)
	if subtle.ConstantTimeCompare([]byte(presented), []byte(s.bootstrapHash)) != 1 {
		return nil, fmt.Errorf("%w: not the bootstrap key", auth.ErrInvalidCredential)
	}
	return &auth.Principal{
		ID:     BootstrapID,
		Name:   "bootstrap",
		Kind:   auth.KindAPIKey,
		Scopes: scope.NewSet(scopes.All()...),
	}, nil
}

func validation(err error) error {
	switch {
	case errors.Is(err, domain.ErrNameRequired):
		return problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "name", Reason: "required"})
	case errors.Is(err, domain.ErrScopesRequired):
		return problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "scopes", Reason: "at least one scope"})
	case errors.Is(err, domain.ErrExpiryInPast):
		return problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "expiresAt", Reason: "must be in the future"})
	default:
		return err
	}
}
