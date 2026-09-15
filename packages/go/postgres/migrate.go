package postgres

import (
	"context"
	"fmt"
	"io/fs"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationLockKey serializes Migrate across connections and processes. Two
// services (or two instances) starting at once would otherwise race on
// `CREATE TABLE IF NOT EXISTS`, which is not safe at the catalog level and
// fails with a duplicate-key error on the type name. A session advisory lock
// held on one connection makes concurrent startup safe.
const migrationLockKey int64 = 0x666c616d61 // "oppenheimer"

// Migrate applies every `*.sql` file in files, in filename order, that has
// not already run for namespace. Each unapplied file runs in its own
// transaction and is recorded, so a crash mid-run never half-applies a file
// and a rerun is a no-op. Namespacing lets each bounded context own its
// migrations against one shared table.
//
// It is deliberately forward-only: no down migrations, no checksums. A
// service that outgrows this uses goose or atlas; the ports do not change.
func Migrate(ctx context.Context, pool *pgxpool.Pool, namespace string, files fs.FS) error {
	names, err := sqlFiles(files)
	if err != nil {
		return err
	}

	// Everything runs on one connection so the advisory lock is held for the
	// whole run and other callers wait rather than race the DDL.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLockKey); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, migrationLockKey) //nolint:errcheck // best-effort release; the session ending frees it anyway

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			namespace  text        NOT NULL,
			filename   text        NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (namespace, filename)
		)`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	applied := map[string]struct{}{}
	rows, err := conn.Query(ctx, `SELECT filename FROM schema_migrations WHERE namespace = $1`, namespace)
	if err != nil {
		return fmt.Errorf("read applied migrations: %w", err)
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		applied[name] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, name := range names {
		if _, done := applied[name]; done {
			continue
		}
		body, err := fs.ReadFile(files, name)
		if err != nil {
			return err
		}
		if err := applyOne(ctx, conn, namespace, name, string(body)); err != nil {
			return fmt.Errorf("apply %s/%s: %w", namespace, name, err)
		}
	}
	return nil
}

func applyOne(ctx context.Context, conn *pgxpool.Conn, namespace, name, body string) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, body); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO schema_migrations (namespace, filename) VALUES ($1, $2)`, namespace, name); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func sqlFiles(files fs.FS) ([]string, error) {
	var names []string
	err := fs.WalkDir(files, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && len(path) > 4 && path[len(path)-4:] == ".sql" {
			names = append(names, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(names)
	return names, nil
}
