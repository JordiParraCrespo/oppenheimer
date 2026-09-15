// Package server is the composition root: it turns a Config into a running
// HTTP handler by building every adapter, wiring every module and mounting
// the routes. It is the only package that sees concrete adapters, which is
// what keeps the contexts swappable.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys"
	keyspg "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/adapters/postgres"
	keysapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/config"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs"
	jobspg "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/postgres"
	jobsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/health"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
	pg "github.com/jordiparracrespo/oppenheimer/packages/go/postgres"
	"github.com/jordiparracrespo/oppenheimer/packages/go/ws"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Capability names reported by /health/capabilities.
const (
	CapabilityServiceTokens = "service_tokens"
	CapabilityWebSocket     = "websocket"
	CapabilityPostgres      = "postgres"
)

// Server is the assembled application.
type Server struct {
	Handler http.Handler
	Hub     *ws.Hub
	Jobs    *jobs.Module
	APIKeys *apikeys.Module
	Health  *health.Module
	// pool is non-nil when RUNNER_DATABASE_URL is set; closed on Shutdown.
	pool   *pgxpool.Pool
	logger *slog.Logger
}

// New builds the application. Nothing starts running until Start.
func New(ctx context.Context, cfg *config.Config, logger *slog.Logger) (*Server, error) {
	problems := &problem.Writer{TypeBaseURL: cfg.ErrorTypeBaseURL, Logger: logger}

	// Optional capability: service tokens.
	var issuer *auth.JWT
	if cfg.JWT != nil {
		j, err := auth.NewJWT(auth.JWTOptions{Secret: cfg.JWT.Secret, Issuer: cfg.JWT.Issuer, Audience: cfg.JWT.Audience})
		if err != nil {
			return nil, err
		}
		issuer = j
	}
	capabilities := map[string]bool{
		CapabilityServiceTokens: issuer != nil,
		CapabilityWebSocket:     true,
	}
	logger.Info("capabilities resolved", slog.Any("capabilities", capabilities))

	hub := ws.NewHub(logger.With(slog.String("module", "ws")), ws.DefaultOptions())

	// Optional capability: Postgres persistence. Empty URL keeps the
	// in-memory stores (Repository nil in the module options).
	var (
		pool     *pgxpool.Pool
		keysRepo keysapp.Repository
		jobsRepo jobsapp.Repository
	)
	if cfg.DatabaseURL != "" {
		p, err := pg.Open(ctx, cfg.DatabaseURL, pg.Options{})
		if err != nil {
			return nil, err
		}
		pool = p
		if keysRepo, err = keyspg.New(ctx, pool); err != nil {
			pool.Close()
			return nil, err
		}
		if jobsRepo, err = jobspg.New(ctx, pool); err != nil {
			pool.Close()
			return nil, err
		}
	}
	capabilities[CapabilityPostgres] = pool != nil

	// A nil *auth.JWT must become a nil interface, not an interface holding
	// a nil pointer, or the service would think tokens are enabled.
	var issuerPort keysapp.TokenIssuer
	var tokenTTL time.Duration
	if issuer != nil {
		issuerPort = issuer
		tokenTTL = cfg.JWT.TTL
	}
	keys := apikeys.New(apikeys.Options{
		BootstrapKey: cfg.BootstrapAPIKey,
		Issuer:       issuerPort,
		TokenTTL:     tokenTTL,
		Problems:     problems,
		Logger:       logger,
		Repository:   keysRepo,
	})
	jobsModule := jobs.New(jobs.Options{
		Hub:        hub,
		Problems:   problems,
		Logger:     logger,
		Workers:    cfg.Jobs.Workers,
		QueueSize:  cfg.Jobs.QueueSize,
		Repository: jobsRepo,
	})
	healthModule := health.New(cfg.Version, capabilities)
	healthModule.Register(health.CheckerFunc{CheckName: "jobs_queue", Fn: func(context.Context) error {
		if jobsModule.Service.Depth() >= cfg.Jobs.QueueSize {
			return errQueueSaturated
		}
		return nil
	}})
	if pool != nil {
		healthModule.Register(pg.Checker{Pool: pool})
	}

	// Verifiers: JWTs are recognised by shape, everything else is a key.
	verifiers := []auth.Verifier{}
	if issuer != nil {
		verifiers = append(verifiers, issuer)
	}
	verifiers = append(verifiers, keys.Service)

	root := httpx.NewRouter(problems)
	root.Use(
		httpx.RealIP(cfg.TrustProxy),
		httpx.RequestID(),
		httpx.Recover(problems, logger),
		httpx.Logger(logger),
		httpx.SecurityHeaders(),
		httpx.MaxBytes(cfg.MaxBodyBytes),
	)
	healthModule.Mount(root)

	root.Group(func(api *httpx.Router) {
		api.Use(auth.Authenticate(problems, logger, verifiers...))
		keys.Mount(api)
		jobsModule.Mount(api)
		api.Handle("GET /v1/ws", ws.Handler(hub, problems, logger, jobsModule.Authorize()))
	})

	return &Server{Handler: root, Hub: hub, Jobs: jobsModule, APIKeys: keys, Health: healthModule, pool: pool, logger: logger}, nil
}

// Start launches background work (the job workers). It returns at once.
func (s *Server) Start(ctx context.Context) {
	s.Jobs.Start(ctx)
	// Reconcile jobs a previous run left behind (persistent store only).
	if err := s.Jobs.Recover(ctx); err != nil {
		s.logger.Error("job recovery failed", slog.Any("error", err))
	}
}

// Shutdown closes long-lived connections and waits for workers.
func (s *Server) Shutdown(ctx context.Context) {
	s.Hub.Close(ctx)
	s.Jobs.Service.Wait()
	if s.pool != nil {
		s.pool.Close()
	}
}

type saturated struct{}

func (saturated) Error() string { return "job queue saturated" }

var errQueueSaturated error = saturated{}
