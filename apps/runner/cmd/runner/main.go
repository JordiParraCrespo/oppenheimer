// Command runner is the Oppenheimer host agent and the service template it
// grew from. One binary, one version, one code path per job:
//
//	runner run          the host agent: local socket, self-update, sessions
//	runner register     redeem a registration token from Settings → Add host
//	runner install      write and start the launchd agent or systemd user unit
//	runner uninstall    stop the service, revoke the host, erase the identity
//	runner status       what a person needs to answer "is this host working"
//	runner update       check, apply, pin or roll back a version
//	runner selfcheck    what a staged binary must pass before it is activated
//	runner serve        the control-plane-facing HTTP service (containers)
//	runner version      version, commit, target
//
// `main` parses flags, builds a logger and dispatches. Every wiring decision
// lives in internal/cli (the host agent) or internal/server (the service).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/cli"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/config"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/server"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/logging"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Stamped by the build (-ldflags "-X main.version=…").
var (
	version = "dev"
	commit  = ""
)

func main() { os.Exit(run()) }

// run is separate from main so the signal handler is torn down before the
// process exits: os.Exit skips deferred calls.
func run() int {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	code, err := dispatch(ctx, os.Args[1:])
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "error: "+message(err))
	}
	return code
}

func dispatch(ctx context.Context, args []string) (int, error) {
	command := "run"
	if len(args) > 0 {
		command, args = args[0], args[1:]
	}
	switch command {
	case "run":
		return withApp(ctx, runAgent)
	case "register":
		return register(ctx, args)
	case "install":
		return install(ctx, args)
	case "uninstall":
		return uninstall(ctx, args)
	case "status":
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.Status(ctx, os.Stdout)
		})
	case "sessions", "session":
		return sessions(ctx, args)
	case "update":
		return update(ctx, args)
	case "credential-helper":
		// git calls this with the operation as its one argument.
		operation := ""
		if len(args) > 0 {
			operation = args[0]
		}
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.CredentialHelper(ctx, operation, os.Stdin, os.Stdout)
		})
	case "selfcheck":
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			report, err := app.SelfCheck(ctx)
			if err != nil {
				return err
			}
			_, err = fmt.Fprintln(os.Stdout, string(report))
			return err
		})
	case "serve":
		return serve(ctx)
	case "version", "--version", "-v":
		fmt.Printf("oppenheimer-runner %s %s %s/%s\n", version, commit, osName(), archName())
		return cli.ExitOK, nil
	case "help", "-h", "--help":
		usage(os.Stdout)
		return cli.ExitOK, nil
	default:
		usage(os.Stderr)
		return cli.ExitUsage, fmt.Errorf("unknown command %q", command)
	}
}

// withApp builds the host agent and runs one command against it.
func withApp(ctx context.Context, fn func(context.Context, *cli.App) error) (int, error) {
	app, err := cli.New(version)
	if err != nil {
		return cli.ExitFailure, err
	}
	if err := fn(ctx, app); err != nil {
		return cli.ExitCode(err), err
	}
	return cli.ExitOK, nil
}

func runAgent(ctx context.Context, app *cli.App) error {
	logger := logging.New(os.Stdout, logging.Options{
		Level: envOr("RUNNER_LOG_LEVEL", "info"), Format: envOr("RUNNER_LOG_FORMAT", "text"),
		Service: "runner", Version: version,
	})
	slog.SetDefault(logger)
	return app.Run(ctx, logger, cli.RunOptions{
		ErrorTypeBaseURL: envOr("ERROR_TYPE_BASE_URL", problem.DefaultTypeBaseURL),
		ShutdownTimeout:  15 * time.Second,
	})
}

func register(ctx context.Context, args []string) (int, error) {
	fs := flag.NewFlagSet("register", flag.ContinueOnError)
	opts := cli.RegisterOptions{}
	fs.StringVar(&opts.Token, "token", "", "registration token from Settings → Add host (required)")
	fs.StringVar(&opts.URL, "url", "", "control plane URL (required)")
	fs.StringVar(&opts.Name, "name", "", "name for this host (default: its hostname)")
	fs.StringVar(&opts.Channel, "channel", "", "release channel: stable or beta")
	fs.BoolVar(&opts.Force, "force", false, "re-pair a host that already has an identity")
	if err := fs.Parse(args); err != nil {
		return cli.ExitUsage, err
	}
	if opts.Token == "" || opts.URL == "" {
		fs.Usage()
		return cli.ExitUsage, errors.New("--token and --url are required")
	}
	return withApp(ctx, func(ctx context.Context, app *cli.App) error {
		return app.Register(ctx, os.Stdout, opts)
	})
}

func install(ctx context.Context, args []string) (int, error) {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	print := fs.Bool("print", false, "print the unit file instead of installing it")
	if err := fs.Parse(args); err != nil {
		return cli.ExitUsage, err
	}
	return withApp(ctx, func(ctx context.Context, app *cli.App) error {
		return app.Install(ctx, os.Stdout, *print)
	})
}

func uninstall(ctx context.Context, args []string) (int, error) {
	fs := flag.NewFlagSet("uninstall", flag.ContinueOnError)
	keep := fs.Bool("keep-identity", false, "remove the service but keep this host paired")
	if err := fs.Parse(args); err != nil {
		return cli.ExitUsage, err
	}
	return withApp(ctx, func(ctx context.Context, app *cli.App) error {
		return app.Uninstall(ctx, os.Stdout, *keep)
	})
}

func update(ctx context.Context, args []string) (int, error) {
	fs := flag.NewFlagSet("update", flag.ContinueOnError)
	opts := cli.UpdateOptions{}
	fs.BoolVar(&opts.Check, "check", false, "report what would happen, change nothing")
	fs.BoolVar(&opts.Force, "force", false, "apply now, without waiting for a quiet moment")
	fs.StringVar(&opts.Pin, "pin", "", "freeze this host on a version")
	fs.BoolVar(&opts.Unpin, "unpin", false, "follow the channel again")
	fs.BoolVar(&opts.Rollback, "rollback", false, "return to the previous version")
	if err := fs.Parse(args); err != nil {
		return cli.ExitUsage, err
	}
	return withApp(ctx, func(ctx context.Context, app *cli.App) error {
		return app.Update(ctx, os.Stdout, opts)
	})
}

// sessions dispatches the session subcommands. They are what a person uses on
// the host itself; the console will drive the same use cases over the link.
func sessions(ctx context.Context, args []string) (int, error) {
	sub := "ls"
	if len(args) > 0 {
		sub, args = args[0], args[1:]
	}
	switch sub {
	case "ls", "list":
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.ListSessions(ctx, os.Stdout)
		})
	case "create", "new":
		fs := flag.NewFlagSet("sessions create", flag.ContinueOnError)
		opts := cli.CreateSessionOptions{}
		fs.StringVar(&opts.Repo, "repo", "", "owner/name (required)")
		fs.StringVar(&opts.Remote, "remote", "", "clone URL, the first time this host sees the repository")
		fs.StringVar(&opts.Base, "base", "main", "branch to cut the session's branch from")
		fs.StringVar(&opts.Branch, "branch", "", "branch name (default: oppenheimer/<session id>)")
		fs.StringVar(&opts.Name, "name", "", "name for the session")
		fs.StringVar(&opts.Agent, "agent", "claude", "claude, codex, opencode or shell")
		fs.BoolVar(&opts.Existing, "existing", false, "check out --branch instead of creating it")
		if err := fs.Parse(args); err != nil {
			return cli.ExitUsage, err
		}
		if opts.Repo == "" {
			fs.Usage()
			return cli.ExitUsage, errors.New("--repo is required")
		}
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.CreateSession(ctx, os.Stdout, opts)
		})
	case "attach":
		fs := flag.NewFlagSet("sessions attach", flag.ContinueOnError)
		window := fs.Int("window", 0, "window to attach to; 0 is the agent")
		rest, err := parse(fs, args)
		if err != nil {
			return cli.ExitUsage, err
		}
		if len(rest) != 1 {
			return cli.ExitUsage, errors.New("usage: runner sessions attach <id> [--window N]")
		}
		return withApp(ctx, func(_ context.Context, app *cli.App) error {
			return app.AttachSession(rest[0], *window)
		})
	case "window":
		if len(args) != 1 {
			return cli.ExitUsage, errors.New("usage: runner sessions window <id>")
		}
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.OpenWindow(ctx, os.Stdout, args[0])
		})
	case "restart":
		if len(args) != 1 {
			return cli.ExitUsage, errors.New("usage: runner sessions restart <id>")
		}
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.RestartSession(ctx, os.Stdout, args[0])
		})
	case "close", "rm":
		fs := flag.NewFlagSet("sessions close", flag.ContinueOnError)
		opts := cli.CloseSessionOptions{}
		fs.BoolVar(&opts.NoPush, "no-push", false, "do not push the branch")
		fs.BoolVar(&opts.Force, "force", false, "remove the worktree even with uncommitted changes")
		rest, err := parse(fs, args)
		if err != nil {
			return cli.ExitUsage, err
		}
		if len(rest) != 1 {
			return cli.ExitUsage, errors.New("usage: runner sessions close <id> [--no-push] [--force]")
		}
		return withApp(ctx, func(ctx context.Context, app *cli.App) error {
			return app.CloseSession(ctx, os.Stdout, rest[0], opts)
		})
	default:
		usage(os.Stderr)
		return cli.ExitUsage, fmt.Errorf("unknown sessions command %q", sub)
	}
}

// parse reads flags that may come before or after the positional arguments,
// because `sessions close abc --force` is how a person types it and Go's flag
// package stops at the first non-flag on its own.
func parse(fs *flag.FlagSet, args []string) ([]string, error) {
	var positional []string
	for {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		if fs.NArg() == 0 {
			return positional, nil
		}
		positional = append(positional, fs.Arg(0))
		args = fs.Args()[1:]
	}
}

// serve runs the control-plane-facing HTTP service: the template's REST and
// WebSocket surface, on a TCP port, as the container image does. The host
// agent is `run`, which opens no port at all.
func serve(ctx context.Context) (int, error) {
	cfg, err := config.Load()
	if err != nil {
		return cli.ExitFailure, fmt.Errorf("config: %w", err)
	}
	if cfg.Version == "dev" {
		cfg.Version = version
	}
	logger := logging.New(os.Stdout, logging.Options{
		Level: cfg.LogLevel, Format: cfg.LogFormat, Service: "runner", Version: cfg.Version,
	})
	slog.SetDefault(logger)

	srv, err := server.New(ctx, cfg, logger)
	if err != nil {
		return cli.ExitFailure, err
	}
	srv.Start(ctx)
	logger.Info("starting", slog.String("env", string(cfg.Env)), slog.Int("port", cfg.Port))
	err = httpx.Serve(ctx, logger, httpx.ServerOptions{
		Addr:              cfg.Addr(),
		ShutdownTimeout:   cfg.ShutdownTimeout,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}, srv.Handler, srv.Shutdown)
	if err != nil {
		return cli.ExitFailure, err
	}
	return cli.ExitOK, nil
}

func usage(w *os.File) {
	_, _ = fmt.Fprint(w, `oppenheimer-runner — the host agent

  runner run                      the host agent (what the service unit starts)
  runner register --token … --url …
                                  pair this machine with your workspace
  runner install [--print]        install the launchd agent or systemd user unit
  runner uninstall [--keep-identity]
                                  stop the service and unpair this machine
  runner sessions ls              what this host is running
  runner sessions create --repo owner/name [--remote URL] [--base main] [--agent claude]
  runner sessions attach <id> [--window N]
  runner sessions window <id>     open another tab in a session
  runner sessions restart <id>    recreate window 0 after a reboot
  runner sessions close <id> [--no-push] [--force]
  runner status                   platform, pairing, service, tools, disk
  runner update [--check|--force|--pin V|--unpin|--rollback]
  runner credential-helper get    git's credential protocol, answered over the socket
  runner selfcheck                what a staged binary must pass to be activated
  runner serve                    the HTTP service on a TCP port (containers)
  runner version

Exit codes: 0 ok, 1 failure, 2 usage, 3 auth, 4 forbidden, 5 not found, 6 unreachable.
`)
}

func message(err error) string {
	var prob *problem.Error
	if errors.As(err, &prob) {
		if prob.Detail != "" {
			return prob.Title + ": " + prob.Detail
		}
		return prob.Title
	}
	return err.Error()
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
