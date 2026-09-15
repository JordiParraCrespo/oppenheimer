// Command server runs the Oppenheimer runner service.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/config"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/server"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/logging"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// version is stamped by the build (-ldflags "-X main.version=…").
var version = "dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	if cfg.Version == "dev" {
		cfg.Version = version
	}
	logger := logging.New(os.Stdout, logging.Options{
		Level: cfg.LogLevel, Format: cfg.LogFormat, Service: "runner", Version: cfg.Version,
	})
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	srv, err := server.New(ctx, cfg, logger)
	if err != nil {
		return err
	}
	srv.Start(ctx)

	logger.Info("starting", slog.String("env", string(cfg.Env)), slog.Int("port", cfg.Port))
	return httpx.Serve(ctx, logger, httpx.ServerOptions{
		Addr:              cfg.Addr(),
		ShutdownTimeout:   cfg.ShutdownTimeout,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}, srv.Handler, srv.Shutdown)
}
