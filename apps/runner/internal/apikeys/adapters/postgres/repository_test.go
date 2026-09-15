package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
	pg "github.com/jordiparracrespo/oppenheimer/packages/go/postgres"
)

// newRepo opens the test database named by RUNNER_TEST_DATABASE_URL and
// returns a migrated repository over a truncated table. Without the env var
// the test is skipped, so `go test` stays green wherever no database runs.
func newRepo(t *testing.T) *Repository {
	t.Helper()
	url := os.Getenv("RUNNER_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set RUNNER_TEST_DATABASE_URL to run the Postgres integration test")
	}
	ctx := context.Background()
	pool, err := pg.Open(ctx, url, pg.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	repo, err := New(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "TRUNCATE api_keys"); err != nil {
		t.Fatal(err)
	}
	return repo
}

func TestPostgresKeyLifecycle(t *testing.T) {
	ctx := context.Background()
	repo := newRepo(t)
	now := time.Now().UTC().Truncate(time.Microsecond)

	key, _, err := domain.Generate("ci", []scope.Scope{scope.Scope("keys:write"), scope.Scope("events:read")}, "bootstrap", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Save(ctx, key); err != nil {
		t.Fatal(err)
	}

	got, err := repo.FindByID(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "ci" || got.Hash != key.Hash || len(got.Scopes) != 2 || !got.Active(now) {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	if _, err := repo.FindByID(ctx, "missing"); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("missing key: %v", err)
	}

	list, err := repo.List(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v %d", err, len(list))
	}
}

// A revocation persisted between load and Touch must survive: Touch sets
// only last_used_at and cannot revive the key.
func TestPostgresTouchDoesNotReviveRevokedKey(t *testing.T) {
	ctx := context.Background()
	repo := newRepo(t)
	now := time.Now().UTC().Truncate(time.Microsecond)

	key, _, _ := domain.Generate("k", []scope.Scope{scope.Scope("events:read")}, "b", nil, now)
	if err := repo.Save(ctx, key); err != nil {
		t.Fatal(err)
	}
	revoked := key
	_ = revoked.Revoke(now)
	if err := repo.Save(ctx, revoked); err != nil {
		t.Fatal(err)
	}
	if err := repo.Touch(ctx, key.ID, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	got, err := repo.FindByID(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.RevokedAt == nil || got.LastUsedAt == nil {
		t.Fatalf("touch must keep the revocation and record use: %+v", got)
	}
}
