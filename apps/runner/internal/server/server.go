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
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
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
	healthModule := health.New(cfg.Version, capabilities)
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
		api.Handle("GET /v1/ws", ws.Handler(hub, problems, logger, authorizeEvents))
	})

	return &Server{Handler: root, Hub: hub, APIKeys: keys, Health: healthModule, pool: pool, logger: logger}, nil
}

// authorizeEvents is the topic rule for the event stream until a product
// context (sessions, hosts) owns topics of its own: every topic needs
// events:read. When a context arrives it supplies its own ws.Authorizer and
// the composition root chains them here.
func authorizeEvents(_ context.Context, p *auth.Principal, topic string) error {
	if !p.Can(scopes.EventsRead) {
		return problem.ErrForbidden.WithDetail("topic %q needs %s", topic, scopes.EventsRead)
	}
	return nil
}

// Start launches background work. Nothing runs in the background yet; the
// hook stays so main.go and the tests keep one lifecycle.
func (s *Server) Start(context.Context) {}

// Shutdown closes long-lived connections.
func (s *Server) Shutdown(ctx context.Context) {
	s.Hub.Close(ctx)
	if s.pool != nil {
		s.pool.Close()
	}
}
