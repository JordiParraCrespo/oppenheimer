package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	pairapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	upddomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Exit codes are a public contract: a script that wraps the installer can
// branch on them, so a number never changes meaning once published.
const (
	ExitOK          = 0
	ExitFailure     = 1
	ExitUsage       = 2
	ExitAuth        = 3
	ExitForbidden   = 4
	ExitNotFound    = 5
	ExitUnreachable = 6
)

// ExitCode maps an error onto the contract. A problem document carries the
// status that decides it; anything else is a plain failure.
func ExitCode(err error) int {
	if err == nil {
		return ExitOK
	}
	var prob *problem.Error
	if !errors.As(err, &prob) {
		return ExitFailure
	}
	switch prob.Status {
	case http.StatusUnauthorized:
		return ExitAuth
	case http.StatusForbidden:
		return ExitForbidden
	case http.StatusNotFound, http.StatusPreconditionRequired:
		return ExitNotFound
	case http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return ExitUnreachable
	default:
		return ExitFailure
	}
}

// printer writes the CLI's output and remembers the first failure, so a
// closed pipe is reported once instead of ignored eight times.
type printer struct {
	w   io.Writer
	err error
}

func newPrinter(w io.Writer) *printer { return &printer{w: w} }

func (p *printer) printf(format string, args ...any) {
	if p.err != nil {
		return
	}
	_, p.err = fmt.Fprintf(p.w, format, args...)
}

func (p *printer) println(args ...any) {
	if p.err != nil {
		return
	}
	_, p.err = fmt.Fprintln(p.w, args...)
}

func (p *printer) print(text string) {
	if p.err != nil {
		return
	}
	_, p.err = io.WriteString(p.w, text)
}

// RegisterOptions are `runner register`'s flags.
type RegisterOptions struct {
	Token   string
	URL     string
	Name    string
	Force   bool
	Channel string
}

// Register redeems a registration token and writes the identity. It sends the
// host's facts along, so the console can show what this machine is before
// anyone opens a session on it.
func (a *App) Register(ctx context.Context, out io.Writer, opts RegisterOptions) error {
	facts, err := a.Host.Collect(ctx)
	if err != nil {
		return err
	}
	if facts.Root {
		return hostdomain.ErrRoot.WithDetail(
			"re-run this as the account that will own the sessions, without sudo")
	}
	encoded, err := json.Marshal(facts)
	if err != nil {
		return err
	}
	name := opts.Name
	if name == "" {
		name = facts.Hostname
	}

	identity, err := a.Pairing.Register(ctx, pairapp.RegisterInput{
		Token: opts.Token, ControlPlaneURL: opts.URL, Name: name, Facts: encoded, Force: opts.Force,
	})
	if err != nil {
		return err
	}
	if opts.Channel != "" {
		if identity, err = a.Pairing.SetChannel(pairdomain.Channel(opts.Channel)); err != nil {
			return err
		}
	}
	p := newPrinter(out)
	p.printf("paired as %s (%s)\n", identity.Name, identity.HostID)
	p.printf("control plane %s, channel %s\n", identity.ControlPlaneURL, identity.Channel)
	if p.err != nil {
		return p.err
	}
	return a.printPreflight(ctx, out, facts)
}

// Install writes and starts the service unit.
func (a *App) Install(ctx context.Context, out io.Writer, print bool) error {
	p := newPrinter(out)
	unit, kind := a.Service.Unit()
	if print {
		rendered, err := unit.Render(kind)
		if err != nil {
			return err
		}
		p.print(rendered)
		return p.err
	}
	// The unit executes `current`; without it the service would start and
	// fail in a loop with nothing to tell the user why.
	if _, err := os.Stat(a.Paths.Current()); err != nil {
		if err := a.LinkRunning(); err != nil {
			return err
		}
	}
	status, err := a.Service.Install(ctx)
	if err != nil {
		return err
	}
	p.printf("service installed (%s) at %s\n", status.Kind, status.Path)
	if status.Detail != "" {
		p.printf("state: %s\n", status.Detail)
	}
	return p.err
}

// Uninstall removes the service and, unless told otherwise, the identity. It
// never touches the workspaces: that directory is the user's code.
func (a *App) Uninstall(ctx context.Context, out io.Writer, keepIdentity bool) error {
	p := newPrinter(out)
	var errs []error
	if err := a.Service.Uninstall(ctx); err != nil {
		errs = append(errs, err)
	} else {
		p.println("service removed")
	}
	if !keepIdentity {
		if err := a.Pairing.Unregister(ctx); err != nil && !isNotPaired(err) {
			errs = append(errs, err)
		} else {
			p.println("host revoked and identity erased")
		}
	}
	p.printf("left in place: %s (your worktrees and code)\n", a.Paths.Workspaces)
	p.printf("left in place: %s (binaries and logs) — remove it by hand if you want it gone\n", a.Paths.Home)
	return errors.Join(append(errs, p.err)...)
}

// Status prints what a person needs to answer "is this host working".
func (a *App) Status(ctx context.Context, out io.Writer) error {
	facts, err := a.Host.Collect(ctx)
	if err != nil {
		return err
	}
	tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	p := newPrinter(tw)
	p.printf("runner\t%s\n", a.Version)
	p.printf("platform\t%s %s (%s)\n", facts.Platform, facts.OSVersion, facts.Arch)
	p.printf("account\t%s@%s\n", facts.User, facts.Hostname)

	identity, pairErr := a.Pairing.Identity()
	if pairErr != nil {
		p.printf("paired\tno — %s\n", detail(pairErr))
	} else {
		p.printf("paired\t%s (%s)\n", identity.HostID, identity.ControlPlaneURL)
		p.printf("channel\t%s%s\n", identity.Channel, pinSuffix(identity))
	}

	if status, err := a.Service.Status(ctx); err == nil {
		state := "stopped"
		if status.Running {
			state = "running"
		}
		if !status.Installed {
			state = "not installed"
		}
		p.printf("service\t%s (%s) %s\n", state, status.Kind, status.Detail)
	} else {
		p.printf("service\t%s\n", detail(err))
	}

	if current, err := a.Binaries.Current(); err == nil {
		p.printf("linked\t%s\n", current)
	}
	if a.Updates != nil {
		if state, err := a.Updates.State(); err == nil && state.To != "" {
			p.printf("last update\t%s → %s (%s)%s\n", state.From, state.To, state.Phase, errorSuffix(state))
		}
	}
	for _, tool := range facts.Tools {
		value := "not found"
		if tool.Found() {
			value = tool.Version
		} else if !tool.Required {
			value = "not found (sessions still open; the agent shows an install hint)"
		}
		p.printf("%s\t%s\n", tool.Name, value)
	}
	p.printf("disk\t%s free on %s\n", hostdomain.HumanBytes(facts.DiskFreeBytes), facts.WorkspacePath)
	if p.err != nil {
		return p.err
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	if facts.Validate() != nil {
		// Print first, then fail: a script that wraps `runner status` wants
		// the exit code, and a person wants the table above it.
		if _, err := fmt.Fprintln(out); err != nil {
			return err
		}
		_, err := a.Host.Preflight(ctx)
		return err
	}
	return nil
}

// UpdateOptions are `runner update`'s flags.
type UpdateOptions struct {
	Check    bool
	Force    bool
	Pin      string
	Unpin    bool
	Rollback bool
}

// Update checks, applies, pins or rolls back.
func (a *App) Update(ctx context.Context, out io.Writer, opts UpdateOptions) error {
	p := newPrinter(out)
	switch {
	case opts.Unpin:
		identity, err := a.Pairing.SetPin("")
		if err != nil {
			return err
		}
		p.printf("unpinned; this host follows the %s channel again\n", identity.Channel)
		return nil
	case opts.Pin != "":
		identity, err := a.Pairing.SetPin(opts.Pin)
		if err != nil {
			return err
		}
		p.printf("pinned to %s; no automatic update will be applied\n", identity.PinnedVersion)
		return p.err
	}
	if a.Updates == nil {
		return pairdomain.ErrNotRegistered.WithDetail(
			"updates need a paired host: run the install command from Settings → Add host")
	}
	if opts.Rollback {
		if err := a.Updates.Rollback(ctx); err != nil {
			return err
		}
		p.println("rolled back to the previous version")
		return p.err
	}
	if opts.Check {
		plan, err := a.Updates.Check(ctx)
		if err != nil {
			return err
		}
		p.printf("%s → %s: %s (%s)\n", plan.From, plan.To, plan.Action, plan.Reason)
		return p.err
	}
	plan, err := a.Updates.Apply(ctx, updapplyOptions(opts))
	if err != nil {
		return err
	}
	switch plan.Action {
	case upddomain.ActionNone:
		p.printf("%s is current: %s\n", plan.From, plan.Reason)
	case upddomain.ActionUpdate:
		p.printf("%s is available: %s\n", plan.To, plan.Reason)
	case upddomain.ActionUpdateNow, upddomain.ActionBlocked:
		p.printf("updated %s → %s; the service is restarting\n", plan.From, plan.To)
	}
	return p.err
}

// LinkRunning points `current` at the binary that is executing, which is what
// the installer does after placing the first version: from then on the
// service unit and every update go through the symlink.
func (a *App) LinkRunning() error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	resolved, err := filepath.EvalSymlinks(executable)
	if err != nil {
		resolved = executable
	}
	// Already inside the layout (an update installed it): just link.
	if filepath.Dir(resolved) == a.Paths.Bin() {
		return a.Binaries.Activate(a.Version)
	}
	if err := a.Binaries.Promote(resolved, a.Version); err != nil {
		if !strings.Contains(err.Error(), "exist") {
			return err
		}
	}
	return a.Binaries.Activate(a.Version)
}

func (a *App) printPreflight(ctx context.Context, out io.Writer, facts hostdomain.Facts) error {
	p := newPrinter(out)
	if err := facts.Validate(); err != nil {
		p.printf("preflight: %v\n", err)
		if p.err != nil {
			return p.err
		}
		_, preflightErr := a.Host.Preflight(ctx)
		return preflightErr
	}
	p.println("preflight: ok")
	return p.err
}

func updapplyOptions(opts UpdateOptions) updapp.ApplyOptions {
	return updapp.ApplyOptions{Force: opts.Force}
}

func isNotPaired(err error) bool {
	var prob *problem.Error
	return errors.As(err, &prob) && prob.Code == "PAIR_001"
}

func detail(err error) string {
	var prob *problem.Error
	if errors.As(err, &prob) && prob.Detail != "" {
		return prob.Detail
	}
	return err.Error()
}

func pinSuffix(identity pairdomain.Identity) string {
	if identity.Pinned() {
		return " (pinned to " + identity.PinnedVersion + ")"
	}
	return ""
}

func errorSuffix(state upddomain.State) string {
	if state.Error == "" {
		return ""
	}
	return ": " + state.Error
}
