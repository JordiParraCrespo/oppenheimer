package cli

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	upddomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// RunOptions configure the daemon.
type RunOptions struct {
	// ErrorTypeBaseURL is where problem `type` URIs point, shared with the API.
	ErrorTypeBaseURL string
	ShutdownTimeout  time.Duration
}

// Run is the host agent: the process the service unit starts and keeps alive.
//
// It takes the single-instance lock, closes out any update that was in flight
// when the previous process was replaced, dials the control-plane link and
// keeps it open, serves the local Unix socket, and keeps itself current. It
// deliberately opens no TCP port: everything the browser asks for arrives on
// the link.
func (a *App) Run(ctx context.Context, logger *slog.Logger, opts RunOptions) error {
	release, err := Lock(a.Paths.Lock())
	if err != nil {
		return problem.ErrConflict.WithDetail("%v", err).WithCause(err)
	}
	defer release()

	identity, err := a.Pairing.Identity()
	if err != nil {
		return err
	}
	// The loops below are part of this process's lifecycle: shutdown waits
	// for them, so a stopping runner never leaves a `capture-pane` or a
	// half-finished update behind it.
	ctx, stopLoops := context.WithCancel(ctx)
	defer stopLoops()
	var loops sync.WaitGroup

	logger = logger.With(slog.String("host", identity.HostID))
	logger.Info("runner starting",
		slog.String("version", a.Version),
		slog.String("controlPlane", identity.ControlPlaneURL),
		slog.String("channel", string(identity.Channel)))

	// An update that restarted us is still open until this process proves it
	// can run: count the boot, and roll back if the new binary has used up
	// its attempts.
	if a.Updates != nil {
		state, err := a.Updates.NoteBoot(ctx)
		if err != nil {
			logger.Error("update bookkeeping failed", slog.Any("error", err))
		} else if state.Phase == upddomain.PhasePending {
			logger.Info("update pending its health gate",
				slog.String("from", state.From), slog.String("to", state.To),
				slog.Int("attempt", state.Attempts))
		}
		loops.Add(1)
		go func() {
			defer loops.Done()
			a.updateLoop(ctx, logger)
		}()
	}

	// Sessions live in tmux, which outlived this process being replaced.
	// Take them back over before anything else looks at them.
	if adopted, err := a.Sessions.Adopt(ctx); err != nil {
		logger.Warn("could not adopt sessions", slog.Any("error", err))
	} else if len(adopted) > 0 {
		logger.Info("sessions adopted", slog.Int("count", len(adopted)))
	}
	if orphans, err := a.Sessions.Orphans(ctx); err == nil && len(orphans) > 0 {
		// Reported, never killed here: an orphan holds someone's work, and
		// ending it is a decision, not a side effect of booting.
		logger.Warn("tmux sessions this runner does not recognise", slog.Any("sessions", orphans))
	}
	loops.Add(1)
	go func() {
		defer loops.Done()
		a.sessionLoop(ctx, logger)
	}()
	if AgentUpdatesEnabled() {
		loops.Add(1)
		go func() {
			defer loops.Done()
			a.agentUpdateLoop(ctx, logger)
		}()
	} else {
		logger.Info("agent updates are off", slog.String("by", EnvAgentUpdates))
	}
	// The link: one outbound socket, redialled for as long as this process
	// lives. Sessions do not wait for it — tmux does not care whether the
	// control plane can see it.
	if identity.Revoked() {
		// The control plane unpaired this host. Dialling again would be refused
		// the same way, and exiting would only have the service manager restart
		// us into the same refusal every few seconds — so the daemon stays up,
		// quiet, and keeps serving its local socket for `status` and `sessions`.
		logger.Warn("this host was unpaired; the link stays down until it is paired again",
			slog.Time("revokedAt", *identity.RevokedAt))
	} else {
		loops.Add(1)
		go func() {
			defer loops.Done()
			a.linkLoop(ctx, logger, identity)
		}()
	}

	if facts, err := a.Host.Collect(ctx); err == nil {
		if err := facts.Validate(); err != nil {
			// Not fatal: a host missing tmux still reports, and the console
			// shows what to install rather than an offline host.
			logger.Warn("host is not ready for sessions", slog.Any("error", err))
		}
	}

	listener, err := a.listen(ctx)
	if err != nil {
		return err
	}
	logger.Info("local socket ready", slog.String("socket", a.Paths.Socket()))

	err = httpx.Serve(ctx, logger, httpx.ServerOptions{
		Listener:          listener,
		ShutdownTimeout:   opts.ShutdownTimeout,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}, a.localRouter(opts.ErrorTypeBaseURL, logger))

	stopLoops()
	loops.Wait()
	logger.Info("runner stopped")
	return err
}

// listen opens the Unix socket 0600. A stale socket from a killed runner is
// replaced: the lock above already proved no other runner is alive.
//
// Its directory, and the home above it, are made private first (see
// privateDirectory): that is what closes the window between Listen and the
// Chmod after it, which stays as defence in depth.
func (a *App) listen(ctx context.Context) (net.Listener, error) {
	for _, dir := range []string{a.Paths.Home, a.Paths.Run()} {
		if err := privateDirectory(dir); err != nil {
			return nil, err
		}
	}
	socket := a.Paths.Socket()
	if err := os.Remove(socket); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	var config net.ListenConfig
	listener, err := config.Listen(ctx, "unix", socket)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(socket, 0o600); err != nil {
		_ = listener.Close()
		return nil, err
	}
	return listener, nil
}

// localRouter is the runner's only HTTP surface: the credential helper and
// the CLI reach it over the socket, and nothing else can.
func (a *App) localRouter(errorTypeBaseURL string, logger *slog.Logger) http.Handler {
	problems := &problem.Writer{TypeBaseURL: errorTypeBaseURL, Logger: logger}
	router := httpx.NewRouter(problems)
	router.Use(httpx.RequestID(), httpx.Recover(problems, logger), httpx.MaxBytes(1<<20))

	router.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) error {
		return httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": a.Version})
	})
	router.HandleFunc("GET /v1/host", func(w http.ResponseWriter, r *http.Request) error {
		facts, err := a.Host.Collect(r.Context())
		if err != nil {
			return err
		}
		ready := facts.Validate()
		payload := map[string]any{"facts": facts, "ready": ready == nil}
		if ready != nil {
			payload["blocker"] = ready.Error()
		}
		return httpx.WriteJSON(w, http.StatusOK, payload)
	})
	router.HandleFunc("GET /v1/sessions", func(w http.ResponseWriter, r *http.Request) error {
		// A session that could not be refreshed is listed as last seen.
		sessions, _ := a.Sessions.RefreshAll(r.Context())
		return httpx.WriteJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
	})
	router.HandleFunc("GET /v1/sessions/{id}", func(w http.ResponseWriter, r *http.Request) error {
		session, err := a.Sessions.Refresh(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, session)
	})
	router.HandleFunc("POST /v1/credentials", func(w http.ResponseWriter, r *http.Request) error {
		// The token comes from the control plane, per session and per
		// repository, over the link. A 404 is the helper's "I have none":
		// no link, no session id in the environment, or a refusal.
		var request map[string]string
		if err := httpx.DecodeJSON(r, &request); err != nil {
			return err
		}
		logger.Info("credential requested",
			slog.String("session", request["session"]),
			slog.String("host", request["host"]))
		if a.Credentials == nil || request["host"] != "github.com" {
			return problem.ErrNotFound.WithDetail("this runner has no credential for %s", request["host"])
		}
		token, err := a.Credentials.Get(r.Context(), request["session"])
		if err != nil {
			return problem.ErrNotFound.WithDetail("no credential for this session: %v", err)
		}
		// GitHub's installation tokens go over HTTPS basic auth with this
		// fixed username; the token is the password and is never logged.
		return httpx.WriteJSON(w, http.StatusOK, map[string]string{"username": "x-access-token", "password": token})
	})
	router.HandleFunc("GET /v1/updates", func(w http.ResponseWriter, _ *http.Request) error {
		if a.Updates == nil {
			return upddomain.ErrBlocked.WithDetail("this host is not paired")
		}
		state, err := a.Updates.State()
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, state)
	})
	return router
}

// sessionLoop keeps every live session's state fresh. It polls slowly: with
// no client attached nobody is watching a dot change, and `capture-pane` on a
// busy host is not free. Each tick is one `list-panes` for the whole host plus
// one `capture-pane` per live session, and writes the session map only when a
// state changed. The link will make this adaptive — a second while a browser
// is attached — when it lands.
func (a *App) sessionLoop(ctx context.Context, logger *slog.Logger) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		if _, err := a.Sessions.RefreshAll(ctx); err != nil {
			logger.Warn("could not refresh every session", slog.Any("error", err))
		}
	}
}

// updateLoop keeps the host current: the health gate first, then a check at
// boot and every CheckInterval. A check that fails is logged and retried at
// the next tick — an unreachable release server is not an incident.
func (a *App) updateLoop(ctx context.Context, logger *slog.Logger) {
	gate := time.NewTimer(upddomain.HealthGate)
	defer gate.Stop()
	select {
	case <-ctx.Done():
		return
	case <-gate.C:
		if err := a.Updates.MarkHealthy(); err != nil {
			logger.Error("could not close the pending update", slog.Any("error", err))
		}
	}

	ticker := time.NewTicker(upddomain.CheckInterval)
	defer ticker.Stop()
	for {
		a.checkForUpdate(ctx, logger)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// agentUpdateAfterBoot is how long `run` waits before the first round of
// agent updates: long enough that a boot, an adoption and the first dial are
// not competing with a download, short enough that a host that was off when
// a model shipped is current within the minute it comes back.
const agentUpdateAfterBoot = 30 * time.Second

// agentUpdateLoop keeps the agent CLIs on the host current: every installed
// agent's own updater, shortly after boot and every AgentUpdateInterval
// after. A CLI a release behind is refused by its vendor the day a model
// needs the newer one, and the person finds out in the session's terminal —
// so this runs whether or not anyone is watching. A failure is logged and
// retried at the next tick; the CLI it failed on is still the one it was.
func (a *App) agentUpdateLoop(ctx context.Context, logger *slog.Logger) {
	timer := time.NewTimer(agentUpdateAfterBoot)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		a.updateAgents(ctx, logger)
		timer.Reset(hostdomain.AgentUpdateInterval)
	}
}

func (a *App) updateAgents(ctx context.Context, logger *slog.Logger) {
	for _, result := range a.Host.UpdateAgents(ctx) {
		attrs := []any{slog.String("agent", result.Tool), slog.String("from", result.From), slog.String("to", result.To)}
		switch result.Outcome {
		case hostdomain.AgentUpdated:
			logger.Info("agent updated", attrs...)
		case hostdomain.AgentUpdateFailed:
			logger.Warn("agent update failed", append(attrs, slog.String("detail", result.Detail))...)
		case hostdomain.AgentCurrent:
			logger.Debug("agent is current", attrs...)
		}
	}
}

func (a *App) checkForUpdate(ctx context.Context, logger *slog.Logger) {
	plan, err := a.Updates.Apply(ctx, applyOptions())
	if err != nil {
		logger.Warn("update check failed", slog.Any("error", err))
		return
	}
	switch plan.Action {
	case upddomain.ActionNone:
	case upddomain.ActionBlocked:
		logger.Info("update available but not applied", slog.String("to", plan.To), slog.String("reason", plan.Reason))
	case upddomain.ActionUpdate:
		logger.Info("update waiting for a quiet moment", slog.String("to", plan.To), slog.String("reason", plan.Reason))
	case upddomain.ActionUpdateNow:
		logger.Info("update applied", slog.String("from", plan.From), slog.String("to", plan.To))
	}
}

// SelfCheck is what a staged binary runs before it is allowed to become the
// service: it proves this build can resolve its layout, read its identity and
// report a version on this machine's OS and architecture. A wrong-arch or
// truncated binary never reaches this code, which is the point.
func (a *App) SelfCheck(ctx context.Context) ([]byte, error) {
	report := map[string]any{
		"version": a.Version,
		"home":    a.Paths.Home,
		"target":  a.target(),
	}
	facts, err := a.Host.Collect(ctx)
	if err != nil {
		return nil, err
	}
	report["platform"] = facts.Platform
	report["supported"] = facts.Platform.Supported()
	if identity, err := a.Pairing.Identity(); err == nil {
		report["host"] = identity.HostID
		report["channel"] = identity.Channel
	} else {
		report["host"] = "unpaired"
	}
	if !facts.Platform.Supported() {
		return nil, hostdomain.ErrPlatformUnsupported.WithDetail(
			"this build will not run sessions on %s; supported: %s", facts.Platform, hostdomain.SupportedPlatforms())
	}
	return json.MarshalIndent(report, "", "  ")
}
