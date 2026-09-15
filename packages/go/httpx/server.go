package httpx

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// ServerOptions are the knobs config exposes for the listener.
type ServerOptions struct {
	Addr            string
	ShutdownTimeout time.Duration
	// ReadHeaderTimeout bounds slowloris-style header dribbling. Body and
	// write timeouts are deliberately not set globally: long-lived WebSocket
	// connections and streaming responses would trip them.
	ReadHeaderTimeout time.Duration
	IdleTimeout       time.Duration
}

// Serve runs the handler until ctx is cancelled, then drains connections for
// at most ShutdownTimeout. onShutdown hooks run after the listener closes
// and before the HTTP drain, giving long-lived connections (WebSockets)
// a chance to say goodbye.
func Serve(ctx context.Context, logger *slog.Logger, opts ServerOptions, h http.Handler, onShutdown ...func(context.Context)) error {
	srv := &http.Server{
		Addr:              opts.Addr,
		Handler:           h,
		ReadHeaderTimeout: opts.ReadHeaderTimeout,
		IdleTimeout:       opts.IdleTimeout,
		BaseContext:       func(net.Listener) context.Context { return ctx },
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server listening", slog.String("addr", opts.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down", slog.Duration("timeout", opts.ShutdownTimeout))
	shutdownCtx, cancel := context.WithTimeout(context.Background(), opts.ShutdownTimeout)
	defer cancel()
	for _, hook := range onShutdown {
		hook(shutdownCtx)
	}
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Warn("forced close after drain timeout", slog.Any("error", err))
		return srv.Close()
	}
	return nil
}
