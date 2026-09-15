package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Lookup is the shape of os.LookupEnv, so tests never touch the process
// environment.
type Lookup func(key string) (string, bool)

// Mode is the deployment mode every service understands.
type Mode string

const (
	Development Mode = "development"
	Production  Mode = "production"
	Test        Mode = "test"
)

// ParseMode validates a mode string.
func ParseMode(raw string) (Mode, error) {
	switch m := Mode(strings.ToLower(strings.TrimSpace(raw))); m {
	case Development, Production, Test:
		return m, nil
	default:
		return "", fmt.Errorf("must be development, production or test, got %q", raw)
	}
}

// LoadWorkspaceDotenv applies the monorepo's root .env when running outside
// production: the root is found by walking up from the working directory.
// A process started elsewhere (a container) simply finds no marker and
// keeps its real environment.
func LoadWorkspaceDotenv() error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("resolve working directory: %w", err)
	}
	root, ok := FindWorkspaceRoot(cwd)
	if !ok {
		return nil
	}
	return LoadDotenv(root)
}

// Env reads typed values from a Lookup and remembers every failure, so
// Parse functions can report all problems in one error.
type Env struct {
	lookup Lookup
	errs   []error
}

// NewEnv wraps a lookup. Pass os.LookupEnv in production.
func NewEnv(lookup Lookup) *Env {
	return &Env{lookup: lookup}
}

// String returns the value or def when unset or blank.
func (e *Env) String(key, def string) string {
	if v, ok := e.lookup(key); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return def
}

// Optional returns the value, or "" when unset or blank. Blank means absent
// so `FOO=` in a .env file does not turn a feature on with an empty secret.
func (e *Env) Optional(key string) string {
	return e.String(key, "")
}

// Int parses a non-negative integer.
func (e *Env) Int(key string, def int) int {
	raw := e.String(key, strconv.Itoa(def))
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n < 0 {
		e.fail("%s must be a non-negative integer, got %q", key, raw)
		return def
	}
	return n
}

// Duration parses a positive Go duration such as 30s or 1h.
func (e *Env) Duration(key string, def time.Duration) time.Duration {
	raw := e.String(key, def.String())
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		e.fail("%s must be a positive duration like 30s, got %q", key, raw)
		return def
	}
	return d
}

// Bool parses true/false, 1/0, yes/no.
func (e *Env) Bool(key string, def bool) bool {
	raw := e.String(key, strconv.FormatBool(def))
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	}
	e.fail("%s must be a boolean, got %q", key, raw)
	return def
}

// Secret requires a value of at least min characters.
func (e *Env) Secret(key string, min int) string {
	v := e.Optional(key)
	if len(v) < min {
		e.fail("%s is required and must be at least %d characters (openssl rand -base64 32)", key, min)
	}
	return v
}

// Failf records a problem found by the caller's own validation.
func (e *Env) Failf(format string, args ...any) {
	e.fail(format, args...)
}

func (e *Env) fail(format string, args ...any) {
	e.errs = append(e.errs, fmt.Errorf(format, args...))
}

// Err joins every recorded problem, or returns nil.
func (e *Env) Err() error {
	return errors.Join(e.errs...)
}
