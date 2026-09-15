// Package auth authenticates machine callers and enforces scope.
//
// This service is never called by a browser: the NestJS API talks to it with
// an API key, and agents it manages (runners, VMs) talk to it with a
// short-lived service JWT it minted for them. Both resolve to the same
// Principal, so handlers and use cases never care which one arrived.
package auth

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
)

// Kind says which credential type authenticated the caller.
type Kind string

const (
	// KindAPIKey is a long-lived key issued by this service (or the
	// bootstrap key from the environment).
	KindAPIKey Kind = "api_key"
	// KindService is a short-lived JWT signed with the shared secret.
	KindService Kind = "service"
)

// Principal is the authenticated caller.
type Principal struct {
	// ID identifies the credential (key id or JWT subject).
	ID string
	// Name is the human label the credential was created with.
	Name string
	Kind Kind
	// Scopes the credential was granted.
	Scopes scope.Set
}

// Can reports whether the principal satisfies every scope.
func (p *Principal) Can(required ...scope.Scope) bool {
	return p != nil && p.Scopes.HasAll(required...)
}

type principalKey struct{}

// WithPrincipal stores the caller on the context.
func WithPrincipal(ctx context.Context, p *Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}

// FromContext returns the caller set by Authenticate, or nil.
func FromContext(ctx context.Context) *Principal {
	p, _ := ctx.Value(principalKey{}).(*Principal)
	return p
}

// Verifier turns a bearer credential into a principal. Implementations must
// return ErrInvalidCredential for anything they cannot vouch for, and must
// take constant time with respect to the secret they compare.
type Verifier interface {
	// Accepts reports cheaply whether the token is this verifier's format,
	// so the middleware can pick one without trying them all.
	Accepts(token string) bool
	Verify(ctx context.Context, token string) (*Principal, error)
}
