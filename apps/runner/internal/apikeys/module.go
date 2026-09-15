// Package apikeys is the bounded context that issues and verifies the
// credentials every other route is protected by.
package apikeys

import (
	"log/slog"
	"time"

	httpadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/adapters/http"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/adapters/memory"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Module bundles the context's wiring. main builds one and mounts it.
type Module struct {
	Service *app.Service
	handler *httpadapter.Handler
}

// Options are what the composition root supplies.
type Options struct {
	BootstrapKey string
	// Issuer is nil when service tokens are disabled.
	Issuer   app.TokenIssuer
	TokenTTL time.Duration
	Problems *problem.Writer
	Logger   *slog.Logger
	// Repository defaults to the in-memory store.
	Repository app.Repository
}

// New wires the context with its default adapters.
func New(opts Options) *Module {
	repo := opts.Repository
	if repo == nil {
		repo = memory.New()
	}
	svc := app.New(app.Options{
		Repository:   repo,
		BootstrapKey: opts.BootstrapKey,
		Issuer:       opts.Issuer,
		TokenTTL:     opts.TokenTTL,
		Logger:       opts.Logger.With(slog.String("module", "apikeys")),
	})
	return &Module{Service: svc, handler: httpadapter.New(svc, opts.Problems)}
}

// Mount registers the REST routes on an authenticated router.
func (m *Module) Mount(r *httpx.Router) {
	m.handler.Mount(r)
}
