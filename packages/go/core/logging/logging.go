// Package logging configures the process-wide slog logger.
package logging

import (
	"io"
	"log/slog"
	"strings"
)

// Options select the handler.
type Options struct {
	// Level is one of debug, info, warn, error.
	Level string
	// Format is json or text.
	Format string
	// Service is stamped on every line so aggregated logs stay searchable.
	Service string
	Version string
}

// New builds a logger writing to w.
func New(w io.Writer, opts Options) *slog.Logger {
	var level slog.Level
	if err := level.UnmarshalText([]byte(strings.ToUpper(opts.Level))); err != nil {
		level = slog.LevelInfo
	}
	hopts := &slog.HandlerOptions{Level: level}
	var h slog.Handler
	if strings.EqualFold(opts.Format, "text") {
		h = slog.NewTextHandler(w, hopts)
	} else {
		h = slog.NewJSONHandler(w, hopts)
	}
	return slog.New(h).With(
		slog.String("service", opts.Service),
		slog.String("version", opts.Version),
	)
}
