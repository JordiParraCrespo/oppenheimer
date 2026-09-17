# @oppenheimer/go-config

Environment loading for Go services, mirroring `@oppenheimer/env` on the Node side.
It finds the monorepo root, applies the root `.env` without overwriting real
environment variables, and gives a service typed accessors that collect every
parse failure so a misconfigured process reports all of them in one error
instead of one per restart. The module knows no variable names; the service's
own `internal/config` is the list of what it reads.

## What it exports

`dotenv.go`

- `FindWorkspaceRoot(dir)` walks up until it finds `pnpm-workspace.yaml`.
- `LoadDotenv(root)` applies `.env.local` then `.env`; a value already in the
  environment is never touched, a missing file is not an error.

`env.go`

- `Mode` with `Development`, `Production`, `Test`; `ParseMode(raw)`.
- `LoadWorkspaceDotenv()` — the two above from the working directory. In a
  container no marker is found and the real environment is kept.
- `Lookup` (the shape of `os.LookupEnv`, so tests never touch the process)
  and `NewEnv(lookup) *Env`.
- `Env` accessors: `String`, `Optional` (blank means absent), `Int`
  (non-negative), `Duration` (positive), `Bool`, `Secret(key, min)`,
  `Failf` for the caller's own checks, and `Err()` joining everything found.

## How to use it

From `apps/runner/internal/config/config.go`:

```go
func Load() (*Config, error) {
	if mode, _ := config.ParseMode(os.Getenv("RUNNER_ENV")); mode != config.Production {
		if err := config.LoadWorkspaceDotenv(); err != nil {
			return nil, fmt.Errorf("load .env: %w", err)
		}
	}
	return Parse(os.LookupEnv)
}

func Parse(lookup config.Lookup) (*Config, error) {
	env := config.NewEnv(lookup)
	cfg := &Config{
		Port:            env.Int("RUNNER_PORT", 3006),
		ShutdownTimeout: env.Duration("RUNNER_SHUTDOWN_TIMEOUT", 15*time.Second),
		BootstrapAPIKey: env.Secret("RUNNER_BOOTSTRAP_API_KEY", 32),
		DatabaseURL:     env.Optional("RUNNER_DATABASE_URL"),
	}
	if err := env.Err(); err != nil {
		return nil, err
	}
	return cfg, nil
}
```

## How to run it

```bash
pnpm --filter @oppenheimer/go-config test    # go test -count=1 ./...
pnpm --filter @oppenheimer/go-config lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-config build   # go build ./...
```

## Dependencies

Standard library only; it imports no sibling module. Consumed by
`apps/runner/internal/config`, and by `cmd/server/main.go` through it. The
variables themselves are documented in the root `.env.example` under
"Runner (apps/runner)".
