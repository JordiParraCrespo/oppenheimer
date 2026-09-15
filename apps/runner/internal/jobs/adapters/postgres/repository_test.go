package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	pg "github.com/jordiparracrespo/oppenheimer/packages/go/postgres"
)

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
	if _, err := pool.Exec(ctx, "TRUNCATE jobs"); err != nil {
		t.Fatal(err)
	}
	return repo
}

func TestPostgresJobRoundTripAndFilter(t *testing.T) {
	ctx := context.Background()
	repo := newRepo(t)
	now := time.Now().UTC().Truncate(time.Microsecond)

	j, err := domain.New("j1", "sleep", json.RawMessage(`{"durationMs":10}`), "k", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Save(ctx, j); err != nil {
		t.Fatal(err)
	}
	got, err := repo.FindByID(ctx, "j1")
	if err != nil {
		t.Fatal(err)
	}
	// jsonb normalizes formatting, so compare decoded values, not bytes.
	if got.Kind != "sleep" || got.Status != domain.StatusQueued || !jsonEqual(t, got.Payload, `{"durationMs":10}`) {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	queued := domain.StatusQueued
	running := domain.StatusRunning
	if list, err := repo.List(ctx, app.ListFilter{Status: &queued}); err != nil || len(list) != 1 {
		t.Fatalf("filter queued: %v %d", err, len(list))
	}
	if list, err := repo.List(ctx, app.ListFilter{Status: &running}); err != nil || len(list) != 0 {
		t.Fatalf("filter running: %v %d", err, len(list))
	}
}

// Update is a compare-and-set: ErrSkip leaves the row untouched, a valid
// transition persists, and a completion applied after a cancel is dropped.
func TestPostgresUpdateIsCompareAndSet(t *testing.T) {
	ctx := context.Background()
	repo := newRepo(t)
	now := time.Now().UTC().Truncate(time.Microsecond)

	j, _ := domain.New("j2", "sleep", nil, "k", now)
	if err := repo.Save(ctx, j); err != nil {
		t.Fatal(err)
	}

	// Start it.
	if _, err := repo.Update(ctx, "j2", func(job *domain.Job) error { return job.Start(now) }); err != nil {
		t.Fatal(err)
	}
	// Cancel wins.
	if _, err := repo.Update(ctx, "j2", func(job *domain.Job) error { return job.Cancel(now) }); err != nil {
		t.Fatal(err)
	}
	// A late completion finds it non-running and skips.
	_, err := repo.Update(ctx, "j2", func(job *domain.Job) error {
		if job.Status != domain.StatusRunning {
			return app.ErrSkip
		}
		return job.Succeed(now)
	})
	if !errors.Is(err, app.ErrSkip) {
		t.Fatalf("expected ErrSkip, got %v", err)
	}
	got, _ := repo.FindByID(ctx, "j2")
	if got.Status != domain.StatusCancelled {
		t.Fatalf("late completion overwrote cancel: %s", got.Status)
	}

	// Unknown id and delete.
	if _, err := repo.Update(ctx, "nope", func(*domain.Job) error { return nil }); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("unknown id: %v", err)
	}
	if err := repo.Delete(ctx, "j2"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.FindByID(ctx, "j2"); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("after delete: %v", err)
	}
}

func jsonEqual(t *testing.T, got json.RawMessage, want string) bool {
	t.Helper()
	var a, b any
	if err := json.Unmarshal(got, &a); err != nil {
		t.Fatalf("stored payload not valid JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(want), &b); err != nil {
		t.Fatal(err)
	}
	ga, _ := json.Marshal(a)
	gb, _ := json.Marshal(b)
	return string(ga) == string(gb)
}
