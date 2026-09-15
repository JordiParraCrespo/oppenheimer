// Package app holds the API-key use cases and the ports they need.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
)

// ErrNotFound is what a Repository returns for an unknown id; the use case
// maps it to the catalog problem.
var ErrNotFound = errors.New("api key not found")

// Repository is the persistence port.
type Repository interface {
	Save(ctx context.Context, key domain.Key) error
	FindByID(ctx context.Context, id string) (domain.Key, error)
	List(ctx context.Context) ([]domain.Key, error)
	// Touch records a use without rewriting the aggregate, so a concurrent
	// revocation can never be overwritten by a stale copy loaded for
	// verification. A missing id is not an error.
	Touch(ctx context.Context, id string, at time.Time) error
}

// TokenIssuer mints service JWTs. Nil in the service means the capability
// is off.
type TokenIssuer interface {
	Issue(subject, name string, granted scope.Set, ttl time.Duration, now time.Time) (string, error)
}

// Clock is injectable time.
type Clock func() time.Time
