// Package memory is the in-process Repository. It is the default store so
// the service runs with no external dependency; swap it for a database
// adapter by implementing app.Repository.
package memory

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
)

// Repository stores keys in a map.
type Repository struct {
	mu   sync.RWMutex
	keys map[string]domain.Key
}

// New builds an empty repository.
func New() *Repository {
	return &Repository{keys: map[string]domain.Key{}}
}

var _ app.Repository = (*Repository)(nil)

func (r *Repository) Save(_ context.Context, key domain.Key) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.keys[key.ID] = key
	return nil
}

func (r *Repository) FindByID(_ context.Context, id string) (domain.Key, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	key, ok := r.keys[id]
	if !ok {
		return domain.Key{}, app.ErrNotFound
	}
	return key, nil
}

func (r *Repository) Touch(_ context.Context, id string, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key, ok := r.keys[id]
	if !ok {
		return nil
	}
	key.LastUsedAt = &at
	r.keys[id] = key
	return nil
}

func (r *Repository) List(_ context.Context) ([]domain.Key, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]domain.Key, 0, len(r.keys))
	for _, k := range r.keys {
		out = append(out, k)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}
