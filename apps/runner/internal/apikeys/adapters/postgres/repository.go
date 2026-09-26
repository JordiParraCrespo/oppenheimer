// Package postgres is the Postgres-backed api-key Repository. It implements
// the same app.Repository port as the in-memory store; the composition root
// picks it when a database URL is configured.
package postgres

import (
	"context"
	"embed"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
	pg "github.com/jordiparracrespo/oppenheimer/packages/go/postgres"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Namespace keys this context's rows in the shared schema_migrations table.
const Namespace = "apikeys"

// Repository stores keys in Postgres.
type Repository struct {
	pool *pgxpool.Pool
}

var _ app.Repository = (*Repository)(nil)

// New builds the repository and applies its migrations.
func New(ctx context.Context, pool *pgxpool.Pool) (*Repository, error) {
	if err := pg.Migrate(ctx, pool, Namespace, migrations); err != nil {
		return nil, err
	}
	return &Repository{pool: pool}, nil
}

const columns = `id, name, prefix, hash, scopes, created_by, created_at, expires_at, revoked_at, last_used_at`

func (r *Repository) Save(ctx context.Context, key domain.Key) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO api_keys (`+columns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name, prefix = EXCLUDED.prefix, hash = EXCLUDED.hash,
			scopes = EXCLUDED.scopes, created_by = EXCLUDED.created_by,
			created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at,
			revoked_at = EXCLUDED.revoked_at, last_used_at = EXCLUDED.last_used_at`,
		key.ID, key.Name, key.Prefix, key.Hash, scopeStrings(key.Scopes),
		key.CreatedBy, key.CreatedAt, key.ExpiresAt, key.RevokedAt, key.LastUsedAt)
	return err
}

func (r *Repository) FindByID(ctx context.Context, id string) (domain.Key, error) {
	return scanKey(r.pool.QueryRow(ctx, `SELECT `+columns+` FROM api_keys WHERE id = $1`, id))
}

func (r *Repository) List(ctx context.Context) ([]domain.Key, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+columns+` FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Key
	for rows.Next() {
		key, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, key)
	}
	return out, rows.Err()
}

// Touch sets last_used_at without reading the row first, so it can never
// overwrite a concurrent revocation. A missing id updates nothing.
func (r *Repository) Touch(ctx context.Context, id string, at time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE api_keys SET last_used_at = $2 WHERE id = $1`, id, at)
	return err
}

// row is the subset of pgx.Row/pgx.Rows scanKey needs.
type row interface {
	Scan(dest ...any) error
}

func scanKey(r row) (domain.Key, error) {
	var (
		key    domain.Key
		scopes []string
	)
	err := r.Scan(&key.ID, &key.Name, &key.Prefix, &key.Hash, &scopes,
		&key.CreatedBy, &key.CreatedAt, &key.ExpiresAt, &key.RevokedAt, &key.LastUsedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Key{}, app.ErrNotFound
	}
	if err != nil {
		return domain.Key{}, err
	}
	key.Scopes = make([]scope.Scope, len(scopes))
	for i, s := range scopes {
		key.Scopes[i] = scope.Scope(s)
	}
	return key, nil
}

func scopeStrings(scopes []scope.Scope) []string {
	out := make([]string, len(scopes))
	for i, s := range scopes {
		out[i] = string(s)
	}
	return out
}
