// Package config reads the runner's configuration from the environment.
//
// The rules match `.agents/rules/api-config.md`: one `.env` at the repo
// root documents everything; real environment variables win; a required
// secret missing fails boot; an optional capability missing disables the
// capability and is reported, never sentinel-defaulted. The loading and
// parsing machinery lives in packages/go/config; this file is only the
// list of variables this service reads.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/config"
)

// Config is the fully parsed, validated configuration.
type Config struct {
	Env     config.Mode
	Port    int
	Version string

	LogLevel  string
	LogFormat string

	// TrustProxy is the number of reverse-proxy hops in front of the service.
	TrustProxy int
	// ErrorTypeBaseURL is the base of RFC 7807 `type` URIs, shared with the API.
	ErrorTypeBaseURL string
	ShutdownTimeout  time.Duration
	// MaxBodyBytes caps JSON request bodies.
	MaxBodyBytes int64

	// BootstrapAPIKey is the one key that exists before any is issued. It
	// holds every scope; use it to mint narrower keys, then keep it in a vault.
	BootstrapAPIKey string

	// DatabaseURL is the optional Postgres DSN. Empty keeps the in-memory
	// stores (the default); when set, the api-key repository is
	// Postgres-backed and a `postgres` readiness check and capability turn on.
	DatabaseURL string

	// JWT is present when service tokens are enabled. Nil disables the
	// service-token verifier and issuing endpoint; /capabilities says so.
	JWT *JWTConfig
}

// JWTConfig is the optional service-token capability.
type JWTConfig struct {
	Secret   []byte
	Issuer   string
	Audience string
	TTL      time.Duration
}

// Load resolves configuration. Outside production it also applies the root
// `.env`, located by walking up from the working directory.
func Load() (*Config, error) {
	if mode, _ := config.ParseMode(os.Getenv("RUNNER_ENV")); mode != config.Production {
		if err := config.LoadWorkspaceDotenv(); err != nil {
			return nil, fmt.Errorf("load .env: %w", err)
		}
	}
	return Parse(os.LookupEnv)
}

// Parse builds a Config from a lookup function so tests never touch the
// process environment. Every problem is reported in one error.
func Parse(lookup config.Lookup) (*Config, error) {
	env := config.NewEnv(lookup)

	mode, err := config.ParseMode(env.String("RUNNER_ENV", string(config.Development)))
	if err != nil {
		env.Failf("RUNNER_ENV %v", err)
	}
	defaultFormat := "text"
	if mode == config.Production {
		defaultFormat = "json"
	}

	cfg := &Config{
		Env:              mode,
		Version:          env.String("RUNNER_VERSION", "dev"),
		LogLevel:         env.String("RUNNER_LOG_LEVEL", "info"),
		LogFormat:        env.String("RUNNER_LOG_FORMAT", defaultFormat),
		ErrorTypeBaseURL: env.String("ERROR_TYPE_BASE_URL", "https://oppenheimer.dev/errors"),
		Port:             env.Int("RUNNER_PORT", 3006),
		TrustProxy:       env.Int("RUNNER_TRUST_PROXY", 0),
		ShutdownTimeout:  env.Duration("RUNNER_SHUTDOWN_TIMEOUT", 15*time.Second),
		MaxBodyBytes:     int64(env.Int("RUNNER_MAX_BODY_BYTES", 1<<20)),
		BootstrapAPIKey:  env.Secret("RUNNER_BOOTSTRAP_API_KEY", 32),
		DatabaseURL:      env.Optional("RUNNER_DATABASE_URL"),
	}

	if secret := env.Optional("RUNNER_JWT_SECRET"); secret != "" {
		if len(secret) < 32 {
			env.Failf("RUNNER_JWT_SECRET must be at least 32 characters")
		}
		cfg.JWT = &JWTConfig{
			Secret:   []byte(secret),
			Issuer:   env.String("RUNNER_JWT_ISSUER", "oppenheimer-runner"),
			Audience: env.String("RUNNER_JWT_AUDIENCE", "oppenheimer-runner"),
			TTL:      env.Duration("RUNNER_JWT_TTL", time.Hour),
		}
	}

	if err := env.Err(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// Addr is the listen address.
func (c *Config) Addr() string { return ":" + strconv.Itoa(c.Port) }

// IsProduction reports the production mode.
func (c *Config) IsProduction() bool { return c.Env == config.Production }
