// Package postgres is the shared Postgres toolkit for Go services: a pooled
// connection opened from a URL, a tiny forward-only migration runner over
// embedded SQL files, and a readiness Checker. It is the persistence
// counterpart of the in-memory adapters — a service selects it by config
// (a DATABASE_URL) and keeps its repositories behind the same ports.
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Options tune the pool. Zero values fall back to conservative defaults.
type Options struct {
	// MaxConns caps the pool. 0 leaves pgx's default (derived from CPUs).
	MaxConns int32
	// ConnectTimeout bounds the initial dial and the readiness ping.
	ConnectTimeout time.Duration
	// MaxConnIdleTime recycles idle connections.
	MaxConnIdleTime time.Duration
}

// Open parses url, applies opts and returns a pool that has verified it can
// reach the database. The caller closes it (pool.Close) at shutdown.
func Open(ctx context.Context, url string, opts Options) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	if opts.MaxConns > 0 {
		cfg.MaxConns = opts.MaxConns
	}
	if opts.MaxConnIdleTime > 0 {
		cfg.MaxConnIdleTime = opts.MaxConnIdleTime
	}

	connectTimeout := opts.ConnectTimeout
	if connectTimeout <= 0 {
		connectTimeout = 5 * time.Second
	}
	pingCtx, cancel := context.WithTimeout(ctx, connectTimeout)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Checker reports database reachability for the readiness endpoint. It
// satisfies the health.Checker shape without importing that package.
type Checker struct {
	Pool    *pgxpool.Pool
	Timeout time.Duration
}

// Name identifies the check.
func (c Checker) Name() string { return "postgres" }

// Check pings the database within Timeout.
func (c Checker) Check(ctx context.Context) error {
	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return c.Pool.Ping(ctx)
}
