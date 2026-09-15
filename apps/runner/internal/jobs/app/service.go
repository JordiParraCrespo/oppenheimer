package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Service owns the job lifecycle and the worker pool that drives it.
type Service struct {
	repo    Repository
	runners map[string]Runner
	pub     Publisher
	logger  *slog.Logger
	now     func() time.Time
	newID   IDGenerator

	queue   chan string
	workers int

	mu      sync.Mutex
	running map[string]context.CancelFunc
	wg      sync.WaitGroup
}

// Options wire the service.
type Options struct {
	Repository Repository
	Runners    map[string]Runner
	Publisher  Publisher
	Logger     *slog.Logger
	Workers    int
	QueueSize  int
	Clock      func() time.Time
	IDs        IDGenerator
}

// New builds the service. Start must be called to process the queue.
func New(opts Options) *Service {
	now := opts.Clock
	if now == nil {
		now = time.Now
	}
	ids := opts.IDs
	if ids == nil {
		ids = randomID
	}
	if opts.Workers <= 0 {
		opts.Workers = 1
	}
	if opts.QueueSize <= 0 {
		opts.QueueSize = 1
	}
	pub := opts.Publisher
	if pub == nil {
		pub = PublisherFunc(func(context.Context, domain.Event) {})
	}
	return &Service{
		repo:    opts.Repository,
		runners: opts.Runners,
		pub:     pub,
		logger:  opts.Logger,
		now:     now,
		newID:   ids,
		queue:   make(chan string, opts.QueueSize),
		workers: opts.Workers,
		running: map[string]context.CancelFunc{},
	}
}

func randomID() string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Kinds lists the registered runners, for capability listings.
func (s *Service) Kinds() []string {
	out := make([]string, 0, len(s.runners))
	for k := range s.runners {
		out = append(out, k)
	}
	return out
}

// SubmitInput is a new job request.
type SubmitInput struct {
	Kind    string
	Payload json.RawMessage
}

// Submit validates, persists and enqueues a job. It returns 429 when the
// queue is full rather than blocking the caller.
func (s *Service) Submit(ctx context.Context, in SubmitInput) (domain.Job, error) {
	caller := auth.FromContext(ctx)
	if caller == nil {
		return domain.Job{}, problem.ErrUnauthorized
	}
	job, err := domain.New(s.newID(), in.Kind, in.Payload, caller.ID, s.now())
	if errors.Is(err, domain.ErrKindRequired) {
		return domain.Job{}, problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "kind", Reason: "required"})
	}
	if err != nil {
		return domain.Job{}, err
	}
	if _, ok := s.runners[job.Kind]; !ok {
		return domain.Job{}, domain.ErrUnknownKind.WithDetail("kind %q; registered: %v", job.Kind, s.Kinds())
	}
	if err := s.repo.Save(ctx, job); err != nil {
		return domain.Job{}, fmt.Errorf("save job: %w", err)
	}
	select {
	case s.queue <- job.ID:
	default:
		// The caller gets a 429 and no id, so nothing may remain behind.
		if err := s.repo.Delete(ctx, job.ID); err != nil {
			s.logger.WarnContext(ctx, "could not remove rejected job", slog.String("jobId", job.ID), slog.Any("error", err))
		}
		return domain.Job{}, domain.ErrQueueFull.WithDetail("capacity %d", cap(s.queue))
	}
	s.pub.Publish(ctx, domain.Event{Name: domain.EventQueued, Job: job})
	return job, nil
}

// Get returns a job.
func (s *Service) Get(ctx context.Context, id string) (domain.Job, error) {
	job, err := s.repo.FindByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return domain.Job{}, domain.ErrJobNotFound.WithDetail("job %q", id)
	}
	return job, err
}

// List returns jobs newest first.
func (s *Service) List(ctx context.Context, filter ListFilter) ([]domain.Job, error) {
	if filter.Limit <= 0 || filter.Limit > 200 {
		filter.Limit = 50
	}
	return s.repo.List(ctx, filter)
}

// Cancel stops a queued or running job. A running job's context is
// cancelled and the runner is expected to return promptly.
func (s *Service) Cancel(ctx context.Context, id string) (domain.Job, error) {
	now := s.now()
	job, err := s.repo.Update(ctx, id, func(j *domain.Job) error { return j.Cancel(now) })
	var te *domain.TransitionError
	switch {
	case errors.Is(err, ErrNotFound):
		return domain.Job{}, domain.ErrJobNotFound.WithDetail("job %q", id)
	case errors.As(err, &te):
		return domain.Job{}, domain.ErrInvalidTransition.WithDetail("%s", te.Error())
	case err != nil:
		return domain.Job{}, fmt.Errorf("cancel job: %w", err)
	}
	s.mu.Lock()
	if cancel, ok := s.running[id]; ok {
		cancel()
	}
	s.mu.Unlock()
	s.pub.Publish(ctx, domain.Event{Name: domain.EventCancelled, Job: job})
	return job, nil
}

// Start launches the worker pool. Workers stop when ctx is cancelled;
// Wait blocks until they have.
func (s *Service) Start(ctx context.Context) {
	for i := 0; i < s.workers; i++ {
		s.wg.Add(1)
		go func(n int) {
			defer s.wg.Done()
			log := s.logger.With(slog.Int("worker", n))
			for {
				select {
				case <-ctx.Done():
					return
				case id := <-s.queue:
					s.execute(ctx, log, id)
				}
			}
		}(i)
	}
}

// Recover reconciles jobs a previous run left non-terminal, which only the
// persistent store can hold across a restart (the in-memory store starts
// empty, so this is a cheap no-op there):
//
//   - queued jobs are pushed back onto the worker queue, so work submitted
//     before the restart still runs;
//   - running jobs were interrupted mid-flight — their worker goroutine died
//     with the old process and cannot be resumed — so they are failed with a
//     clear reason. That keeps the record honest and lets the submitter
//     resubmit; requeuing them instead would risk running a side effect twice.
//
// It runs after Start so the workers are already draining the queue, and it
// feeds queued ids asynchronously so a backlog larger than the channel does
// not block startup — the send respects the same backpressure as Submit.
func (s *Service) Recover(ctx context.Context) error {
	now := s.now()

	running := domain.StatusRunning
	stuck, err := s.repo.List(ctx, ListFilter{Status: &running})
	if err != nil {
		return fmt.Errorf("list interrupted jobs: %w", err)
	}
	for _, j := range stuck {
		updated, err := s.repo.Update(ctx, j.ID, func(job *domain.Job) error {
			if job.Status != domain.StatusRunning {
				return ErrSkip
			}
			return job.Fail("interrupted: runner restarted before completion", now)
		})
		if errors.Is(err, ErrSkip) {
			continue
		}
		if err != nil {
			return fmt.Errorf("fail interrupted job %s: %w", j.ID, err)
		}
		s.logger.InfoContext(ctx, "failed interrupted job on startup", slog.String("jobId", j.ID))
		s.pub.Publish(ctx, domain.Event{Name: domain.EventFinished, Job: updated})
	}

	queued := domain.StatusQueued
	pending, err := s.repo.List(ctx, ListFilter{Status: &queued})
	if err != nil {
		return fmt.Errorf("list pending jobs: %w", err)
	}
	if len(pending) > 0 {
		s.logger.InfoContext(ctx, "re-enqueuing persisted jobs on startup", slog.Int("count", len(pending)))
	}
	go func() {
		for _, j := range pending {
			select {
			case s.queue <- j.ID:
			case <-ctx.Done():
				return
			}
		}
	}()
	return nil
}

// Wait blocks until every worker has exited.
func (s *Service) Wait() { s.wg.Wait() }

// Depth is the number of queued job ids, for readiness and metrics.
func (s *Service) Depth() int { return len(s.queue) }

func (s *Service) execute(ctx context.Context, log *slog.Logger, id string) {
	startedAt := s.now()
	job, err := s.repo.Update(ctx, id, func(j *domain.Job) error {
		if j.Status != domain.StatusQueued {
			// Cancelled while waiting.
			return ErrSkip
		}
		return j.Start(startedAt)
	})
	if errors.Is(err, ErrSkip) {
		return
	}
	if err != nil {
		log.Error("could not mark job running", slog.String("jobId", id), slog.Any("error", err))
		return
	}
	s.pub.Publish(ctx, domain.Event{Name: domain.EventStarted, Job: job})

	runCtx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	s.running[id] = cancel
	s.mu.Unlock()
	defer func() {
		cancel()
		s.mu.Lock()
		delete(s.running, id)
		s.mu.Unlock()
	}()

	runErr := s.run(runCtx, job)

	// The transition is applied against the stored state: if Cancel won the
	// race while the runner was returning, the result is dropped and the
	// job stays cancelled.
	now := s.now()
	current, err := s.repo.Update(ctx, id, func(j *domain.Job) error {
		if j.Status != domain.StatusRunning {
			return ErrSkip
		}
		if runErr != nil {
			return j.Fail(runErr.Error(), now)
		}
		return j.Succeed(now)
	})
	if errors.Is(err, ErrSkip) {
		return
	}
	if err != nil {
		log.Error("could not persist job result", slog.String("jobId", id), slog.Any("error", err))
		return
	}
	if runErr != nil {
		log.Warn("job failed", slog.String("jobId", id), slog.String("kind", job.Kind), slog.Any("error", runErr))
	} else {
		log.Info("job succeeded", slog.String("jobId", id), slog.String("kind", job.Kind), slog.Duration("took", now.Sub(startedAt)))
	}
	s.pub.Publish(ctx, domain.Event{Name: domain.EventFinished, Job: current})
}

// run isolates a runner panic to the job it was executing.
func (s *Service) run(ctx context.Context, job domain.Job) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("runner panicked: %v", r)
		}
	}()
	return s.runners[job.Kind].Run(ctx, job)
}
