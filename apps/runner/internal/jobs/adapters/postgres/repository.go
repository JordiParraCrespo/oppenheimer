// Package postgres is the Postgres-backed job Repository. Its Update runs
// the transition against a row locked with SELECT ... FOR UPDATE, so the
// compare-and-set the in-memory store did under a mutex is enforced by the
// database — a cancel and a worker's completion can never overwrite each
// other even across processes.
//
// The payload is stored as jsonb, so it round-trips as semantically equal
// JSON but not byte-for-byte (jsonb drops insignificant whitespace and may
// reorder object keys). Callers treat the payload as opaque JSON, so this is
// harmless; it is the one behavioural difference from the in-memory store.
package postgres

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	pg "github.com/jordiparracrespo/oppenheimer/packages/go/postgres"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Namespace keys this context's rows in the shared schema_migrations table.
const Namespace = "jobs"

// Repository stores jobs in Postgres.
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

const columns = `id, kind, payload, status, error, created_by, created_at, started_at, finished_at`

func (r *Repository) Save(ctx context.Context, job domain.Job) error {
	_, err := r.pool.Exec(ctx, upsert, args(job)...)
	return err
}

const upsert = `
	INSERT INTO jobs (` + columns + `)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	ON CONFLICT (id) DO UPDATE SET
		kind = EXCLUDED.kind, payload = EXCLUDED.payload, status = EXCLUDED.status,
		error = EXCLUDED.error, created_by = EXCLUDED.created_by,
		created_at = EXCLUDED.created_at, started_at = EXCLUDED.started_at,
		finished_at = EXCLUDED.finished_at`

func (r *Repository) FindByID(ctx context.Context, id string) (domain.Job, error) {
	return scanJob(r.pool.QueryRow(ctx, `SELECT `+columns+` FROM jobs WHERE id = $1`, id))
}

func (r *Repository) List(ctx context.Context, f app.ListFilter) ([]domain.Job, error) {
	query := `SELECT ` + columns + ` FROM jobs`
	var params []any
	if f.Status != nil {
		query += ` WHERE status = $1`
		params = append(params, string(*f.Status))
	}
	query += ` ORDER BY created_at DESC`
	if f.Limit > 0 {
		query += ` LIMIT $` + strconv.Itoa(len(params)+1)
		params = append(params, f.Limit)
	}
	rows, err := r.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Job
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, job)
	}
	return out, rows.Err()
}

// Update locks the row, runs fn against the stored state, and persists only
// when fn returns nil. fn's error (ErrSkip, a transition error) is returned
// verbatim and the row is left untouched.
func (r *Repository) Update(ctx context.Context, id string, fn func(job *domain.Job) error) (domain.Job, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Job{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	job, err := scanJob(tx.QueryRow(ctx, `SELECT `+columns+` FROM jobs WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return domain.Job{}, err
	}
	if err := fn(&job); err != nil {
		return domain.Job{}, err
	}
	if _, err := tx.Exec(ctx, upsert, args(job)...); err != nil {
		return domain.Job{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Job{}, err
	}
	return job, nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM jobs WHERE id = $1`, id)
	return err
}

func args(job domain.Job) []any {
	payload := job.Payload
	if len(payload) == 0 {
		payload = json.RawMessage("null")
	}
	return []any{job.ID, job.Kind, []byte(payload), string(job.Status), job.Error,
		job.CreatedBy, job.CreatedAt, job.StartedAt, job.FinishedAt}
}

type row interface {
	Scan(dest ...any) error
}

func scanJob(r row) (domain.Job, error) {
	var (
		job     domain.Job
		payload []byte
		status  string
	)
	err := r.Scan(&job.ID, &job.Kind, &payload, &status, &job.Error,
		&job.CreatedBy, &job.CreatedAt, &job.StartedAt, &job.FinishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Job{}, app.ErrNotFound
	}
	if err != nil {
		return domain.Job{}, err
	}
	job.Status = domain.Status(status)
	job.Payload = json.RawMessage(payload)
	return job, nil
}
