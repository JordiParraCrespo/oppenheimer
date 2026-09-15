package app

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// memRepo is a minimal Repository so this package's tests stay free of the
// adapters (the boundary test forbids importing them here).
type memRepo struct {
	mu   sync.Mutex
	jobs map[string]domain.Job
}

func newMemRepo() *memRepo { return &memRepo{jobs: map[string]domain.Job{}} }

func (r *memRepo) Save(_ context.Context, j domain.Job) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.jobs[j.ID] = j
	return nil
}

func (r *memRepo) FindByID(_ context.Context, id string) (domain.Job, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	j, ok := r.jobs[id]
	if !ok {
		return domain.Job{}, ErrNotFound
	}
	return j, nil
}

func (r *memRepo) List(_ context.Context, _ ListFilter) ([]domain.Job, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]domain.Job, 0, len(r.jobs))
	for _, j := range r.jobs {
		out = append(out, j)
	}
	return out, nil
}

func (r *memRepo) Update(_ context.Context, id string, fn func(*domain.Job) error) (domain.Job, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	j, ok := r.jobs[id]
	if !ok {
		return domain.Job{}, ErrNotFound
	}
	if err := fn(&j); err != nil {
		return domain.Job{}, err
	}
	r.jobs[id] = j
	return j, nil
}

func (r *memRepo) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.jobs, id)
	return nil
}

func callerCtx() context.Context {
	return auth.WithPrincipal(context.Background(), &auth.Principal{ID: "t", Scopes: scope.NewSet(scopes.JobsWrite)})
}

func newService(repo Repository, runner Runner, queue int) *Service {
	return New(Options{
		Repository: repo,
		Runners:    map[string]Runner{"r": runner},
		Logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		Workers:    1,
		QueueSize:  queue,
	})
}

func TestRejectedSubmitLeavesNothingBehind(t *testing.T) {
	repo := newMemRepo()
	svc := newService(repo, RunnerFunc(func(context.Context, domain.Job) error { return nil }), 1)
	// No Start: the queue holds one id and the second submit must be refused.
	if _, err := svc.Submit(callerCtx(), SubmitInput{Kind: "r"}); err != nil {
		t.Fatal(err)
	}
	_, err := svc.Submit(callerCtx(), SubmitInput{Kind: "r"})
	var pe *problem.Error
	if !errors.As(err, &pe) || pe.Code != domain.ErrQueueFull.Code {
		t.Fatalf("expected queue-full problem, got %v", err)
	}
	jobs, _ := repo.List(context.Background(), ListFilter{})
	if len(jobs) != 1 {
		t.Fatalf("rejected job persisted: %d jobs", len(jobs))
	}
}

// A cancel that lands while the runner is returning must win: the worker's
// completion is applied against the stored state and dropped.
func TestCancelWinsOverLateCompletion(t *testing.T) {
	repo := newMemRepo()
	release := make(chan struct{})
	svc := newService(repo, RunnerFunc(func(ctx context.Context, _ domain.Job) error {
		<-release
		return nil // ignore ctx on purpose: a runner that returns late
	}), 4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	svc.Start(ctx)

	job, err := svc.Submit(callerCtx(), SubmitInput{Kind: "r"})
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		j, _ := repo.FindByID(context.Background(), job.ID)
		if j.Status == domain.StatusRunning || time.Now().After(deadline) {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if _, err := svc.Cancel(callerCtx(), job.ID); err != nil {
		t.Fatal(err)
	}
	close(release)
	cancel()
	svc.Wait()

	final, _ := repo.FindByID(context.Background(), job.ID)
	if final.Status != domain.StatusCancelled {
		t.Fatalf("late completion overwrote the cancellation: %s", final.Status)
	}
}

// A restart recovery must run persisted queued jobs and fail interrupted
// running ones, so persistence makes job processing survive a restart, not
// just the rows.
func TestRecoverRequeuesQueuedAndFailsInterrupted(t *testing.T) {
	repo := newMemRepo()
	now := time.Now()

	// A job left queued by the previous run.
	q, _ := domain.New("q1", "r", nil, "k", now)
	if err := repo.Save(context.Background(), q); err != nil {
		t.Fatal(err)
	}
	// A job left running (its worker died with the old process).
	r, _ := domain.New("r1", "r", nil, "k", now)
	_ = r.Start(now)
	if err := repo.Save(context.Background(), r); err != nil {
		t.Fatal(err)
	}

	ran := make(chan struct{}, 1)
	svc := newService(repo, RunnerFunc(func(context.Context, domain.Job) error {
		select {
		case ran <- struct{}{}:
		default:
		}
		return nil
	}), 4)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	svc.Start(ctx)
	if err := svc.Recover(ctx); err != nil {
		t.Fatal(err)
	}

	// The queued job runs.
	select {
	case <-ran:
	case <-time.After(2 * time.Second):
		t.Fatal("recovered queued job never ran")
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		q1, _ := repo.FindByID(context.Background(), "q1")
		r1, _ := repo.FindByID(context.Background(), "r1")
		if q1.Status == domain.StatusSucceeded && r1.Status == domain.StatusFailed {
			if r1.Error == "" {
				t.Fatal("interrupted job should carry a reason")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("recovery incomplete: q1=%s r1=%s", q1.Status, r1.Status)
		}
		time.Sleep(5 * time.Millisecond)
	}
}
