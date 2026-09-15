// Package jobs is the example bounded context: submit work, run it on a
// worker pool, observe it over REST and WebSocket.
package jobs

import (
	"context"
	"log/slog"

	httpadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/http"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/memory"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/runner"
	wsadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/ws"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
	"github.com/jordiparracrespo/oppenheimer/packages/go/ws"
)

// Module bundles the context's wiring.
type Module struct {
	Service *app.Service
	handler *httpadapter.Handler
}

// Options are what the composition root supplies.
type Options struct {
	Hub       wsadapter.Hub
	Problems  *problem.Writer
	Logger    *slog.Logger
	Workers   int
	QueueSize int
	// Runners defaults to the built-in kinds.
	Runners map[string]app.Runner
	// Repository defaults to the in-memory store.
	Repository app.Repository
}

// New wires the context with its default adapters.
func New(opts Options) *Module {
	repo := opts.Repository
	if repo == nil {
		repo = memory.New()
	}
	runners := opts.Runners
	if runners == nil {
		runners = runner.Builtin()
	}
	svc := app.New(app.Options{
		Repository: repo,
		Runners:    runners,
		Publisher:  wsadapter.NewPublisher(opts.Hub),
		Logger:     opts.Logger.With(slog.String("module", "jobs")),
		Workers:    opts.Workers,
		QueueSize:  opts.QueueSize,
	})
	return &Module{Service: svc, handler: httpadapter.New(svc, opts.Problems)}
}

// Mount registers the REST routes on an authenticated router.
func (m *Module) Mount(r *httpx.Router) { m.handler.Mount(r) }

// Authorize is the WebSocket topic rule for this context.
func (m *Module) Authorize() ws.Authorizer { return wsadapter.Authorize }

// Start runs the worker pool until ctx ends.
func (m *Module) Start(ctx context.Context) { m.Service.Start(ctx) }

// Recover re-enqueues persisted queued jobs and fails interrupted running
// jobs left by a previous run. A no-op for the in-memory store.
func (m *Module) Recover(ctx context.Context) error { return m.Service.Recover(ctx) }
