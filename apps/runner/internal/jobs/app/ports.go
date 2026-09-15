// Package app holds the job use cases, the worker pool and the ports.
package app

import (
	"context"
	"errors"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
)

// ErrNotFound is what a Repository returns for an unknown id.
var ErrNotFound = errors.New("job not found")

// ListFilter narrows List.
type ListFilter struct {
	Status *domain.Status
	Limit  int
}

// Repository is the persistence port.
type Repository interface {
	Save(ctx context.Context, job domain.Job) error
	FindByID(ctx context.Context, id string) (domain.Job, error)
	List(ctx context.Context, filter ListFilter) ([]domain.Job, error)
	// Update applies fn to the stored job atomically: fn sees the current
	// state, and the result is persisted only when fn returns nil. Every
	// lifecycle transition goes through it so two writers (a worker
	// finishing, a caller cancelling) can never overwrite each other.
	Update(ctx context.Context, id string, fn func(job *domain.Job) error) (domain.Job, error)
	// Delete removes a job that never made it onto the queue.
	Delete(ctx context.Context, id string) error
}

// ErrSkip is returned from an Update callback to leave the job untouched
// without reporting a failure: the state had already moved on.
var ErrSkip = errors.New("skip update")

// Runner executes one kind of job. Registered per kind; the payload it
// receives is whatever the submitter sent.
type Runner interface {
	Run(ctx context.Context, job domain.Job) error
}

// RunnerFunc adapts a function to Runner.
type RunnerFunc func(ctx context.Context, job domain.Job) error

func (f RunnerFunc) Run(ctx context.Context, job domain.Job) error { return f(ctx, job) }

// Publisher is the outbound event port; the WebSocket adapter implements it.
type Publisher interface {
	Publish(ctx context.Context, event domain.Event)
}

// PublisherFunc adapts a function to Publisher.
type PublisherFunc func(ctx context.Context, event domain.Event)

func (f PublisherFunc) Publish(ctx context.Context, event domain.Event) { f(ctx, event) }

// IDGenerator mints job ids.
type IDGenerator func() string
