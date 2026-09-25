package cli

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
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
	// Workspaces is where sessions' checkouts will live; empty keeps the
	// current one (the default, or what an earlier install chose).
	Workspaces string
	// KeepExisting makes a re-run of the installer a repair: a host already
	// paired to this control plane keeps its identity and the token is not
	// spent, instead of failing with "already paired".
	KeepExisting bool
	// AllowContainer pairs a machine that looks temporary anyway.
	AllowContainer bool
}

// Register redeems a registration token and writes the identity. It sends the
// host's facts along, so the console can show what this machine is before
// anyone opens a session on it.
func (a *App) Register(ctx context.Context, out io.Writer, opts RegisterOptions) error {
	p := newPrinter(out)
	workspaces := a.Paths.Workspaces
	if opts.Workspaces != "" {
		dir, warnings, err := ChooseWorkspaces(opts.Workspaces, a.Paths)
		if err != nil {
			return err
		}
		for _, warning := range warnings {
			p.printf("warning: %s\n", warning)
		}
		workspaces = dir
	}
	// Facts describe the directory sessions will actually use, so the console
	// shows the chosen path and the free disk under it.
	host := a.Host
	if workspaces != a.Paths.Workspaces {
		host = hostapp.New(hostapp.Options{Prober: system.New(), WorkspaceRoot: workspaces, Version: a.Version})
	}
	facts, err := host.Collect(ctx)
	if err != nil {
		return err
	}
	if facts.Root {
		return hostdomain.ErrRoot.WithDetail(
			"re-run this as the account that will own the sessions, without sudo")
	}
	if !opts.AllowContainer {
		if reasons := system.Ephemeral(os.Getenv); len(reasons) > 0 {
			return hostdomain.ErrEphemeral.WithDetail(
				"%s. Pairing it would spend the one-time token on a host that disappears when this environment "+
					"ends; run the install on the machine you want to add, or pass --allow-container if this one is meant to last",
				strings.Join(reasons, "; "))
		}
	}

	if opts.KeepExisting {
		if identity, err := a.Pairing.Identity(); err == nil && !identity.Revoked() &&
			sameOrigin(identity.ControlPlaneURL, opts.URL) {
			p.printf("already paired as %s (%s); keeping it — the token was not used\n", identity.Name, identity.HostID)
			if workspaces != a.Paths.Workspaces {
				if err := a.moveWorkspaces(ctx, p, workspaces); err != nil {
					return err
				}
			}
			if p.err != nil {
				return p.err
			}
			return a.printPreflight(ctx, out, facts)
		}
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
	if opts.Workspaces != "" {
		if identity, err = a.Pairing.SetWorkspaces(workspaces); err != nil {
			return err
		}
	}
	p.printf("paired as %s (%s)\n", identity.Name, identity.HostID)
	p.printf("control plane %s, channel %s\n", identity.ControlPlaneURL, identity.Channel)
	p.printf("sessions will live in %s\n", workspaces)
	if p.err != nil {
		return p.err
	}
	return a.printPreflight(ctx, out, facts)
}

// Workspaces prints where sessions live and why, or moves them to dir.
func (a *App) Workspaces(ctx context.Context, out io.Writer, dir string) error {
	p := newPrinter(out)
	if dir == "" {
		p.printf("%s (%s)\n", a.Paths.Workspaces, a.Paths.WorkspacesSource)
		return p.err
	}
	chosen, warnings, err := ChooseWorkspaces(dir, a.Paths)
	if err != nil {
		return err
	}
	for _, warning := range warnings {
		p.printf("warning: %s\n", warning)
	}
	if err := a.moveWorkspaces(ctx, p, chosen); err != nil {
		return err
	}
	return p.err
}

// moveWorkspaces points new sessions at dir. It moves nothing: every session
// whose checkout is still on disk under the old directory has to be closed
// first, because git wrote that directory's absolute path into each worktree
// and tmux may be running in it. Closing a session removes its worktree, so the
// question is asked of the disk, not of the session's state: a close that kept
// the worktree still holds it, and a session whose worktree is gone does not.
// The old directory is left for the user to delete.
func (a *App) moveWorkspaces(ctx context.Context, p *printer, dir string) error {
	if a.Paths.WorkspacesSource == "env" {
		return hostdomain.ErrWorkspaces.WithDetail(
			"%s is set, and it wins over a saved directory; unset it to choose one here", EnvWorkspaces)
	}
	if dir == a.Paths.Workspaces {
		p.printf("sessions already live in %s\n", dir)
		return nil
	}
	var held []string
	for _, session := range a.Sessions.List() {
		if hasCheckoutUnder(a.Paths.Workspaces, session.Worktree) {
			held = append(held, session.ID)
		}
	}
	if len(held) > 0 {
		return problem.ErrConflict.WithDetail(
			"%d session(s) still have checkouts in %s (%s); close them with `%s sessions close <id>` before moving where sessions live",
			len(held), a.Paths.Workspaces, strings.Join(held, ", "), binaryName())
	}
	if _, err := a.Pairing.SetWorkspaces(dir); err != nil {
		return err
	}
	p.printf("sessions will live in %s; %s is left as it is\n", dir, a.Paths.Workspaces)
	// The daemon reads the directory once, at start.
	if status, err := a.Service.Status(ctx); err == nil && status.Running {
		if err := a.Service.Restart(ctx); err != nil {
			return err
		}
		p.println("service restarted to pick it up")
	}
	return nil
}

// hasCheckoutUnder reports whether worktree is a directory on disk inside dir.
func hasCheckoutUnder(dir, worktree string) bool {
	if worktree == "" {
		return false
	}
	rel, err := filepath.Rel(dir, worktree)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return false
	}
	info, err := os.Stat(worktree)
	return err == nil && info.IsDir()
}

// publicKeyFingerprint is SHA-256 of the raw host key, hex — the form the
// control plane computes at registration. An unreadable key prints as unknown.
func publicKeyFingerprint(encoded string) string {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(raw) != ed25519.PublicKeySize {
		return "unknown"
	}
	return pairdomain.KeyFingerprint(ed25519.PublicKey(raw))
}

// sameOrigin compares two control-plane URLs the way a runner dials them.
func sameOrigin(a, b string) bool {
	return strings.EqualFold(strings.TrimRight(strings.TrimSpace(a), "/"), strings.TrimRight(strings.TrimSpace(b), "/"))
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

// UninstallOptions are `runner uninstall`'s flags.
type UninstallOptions struct {
	// KeepIdentity removes the service but keeps the host paired.
	KeepIdentity bool
	// Force ends the runner's tmux sessions instead of refusing while they run.
	Force bool
}

// Uninstall removes the service and, unless told otherwise, the identity. It
// never touches the workspaces: that directory is the user's code.
//
// It refuses while any of the runner's tmux sessions is running, unless
// Force. The service unit deliberately leaves tmux up when the runner stops
// (`KillMode=process`, `AbandonProcessGroup`), which is what keeps sessions
// alive across an update — and would keep an agent working, unattended, with
// no control plane and no console, after an uninstall. So that is a choice the
// user makes with --force, which ends them; the checkouts stay on disk.
func (a *App) Uninstall(ctx context.Context, out io.Writer, opts UninstallOptions) error {
	p := newPrinter(out)
	running, err := a.Sessions.Running(ctx)
	if err != nil {
		return err
	}
	if len(running) > 0 && !opts.Force {
		return problem.ErrConflict.WithDetail(
			"%d session(s) are still running on this host (%s). Close them with `%s sessions close <id>`, "+
				"or re-run with --force to end them; their checkouts stay on disk",
			len(running), strings.Join(running, ", "), binaryName())
	}

	var errs []error
	if err := a.Service.Uninstall(ctx); err != nil {
		errs = append(errs, err)
	} else {
		p.println("service removed")
	}
	// After the service is gone, so the daemon is not writing the same
	// session records while they are marked stopped.
	if opts.Force && len(running) > 0 {
		ended, err := a.Sessions.EndAll(ctx)
		p.printf("ended %d session(s); their checkouts are still in %s\n", len(ended), a.Paths.Workspaces)
		// A session that could not be ended is an agent still working. Stop
		// before the identity goes, so the host stays paired and visible, and
		// running this again can finish the job.
		if err != nil {
			p.println("the host is still paired: end the remaining sessions, then run this again")
			return errors.Join(append(errs, err, p.err)...)
		}
	}
	if !opts.KeepIdentity {
		hostID := "<id>"
		if identity, err := a.Pairing.Identity(); err == nil && identity.HostID != "" {
			hostID = identity.HostID
		}
		revoked, err := a.Pairing.Unregister(ctx)
		switch {
		case err != nil && !isNotPaired(err):
			errs = append(errs, err)
		case isNotPaired(err):
			p.println("this host was not paired; nothing to revoke")
		case revoked:
			p.println("host revoked at the control plane and identity erased")
		default:
			p.printf("identity erased, but the control plane could not be reached: it still lists this host "+
				"and trusts its key until the host is unpaired there (DELETE /v1/hosts/%s; the console has no unpair control yet)\n", hostID)
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
	switch {
	case pairErr != nil:
		p.printf("paired\tno — %s\n", detail(pairErr))
	case identity.Revoked():
		p.printf("paired\tno — unpaired by the control plane on %s; pair it again from Add host, or run `oppenheimer-runner uninstall`\n",
			identity.RevokedAt.Format(time.RFC3339))
	default:
		p.printf("paired\t%s (%s)\n", identity.HostID, identity.ControlPlaneURL)
		// The same value the control plane stores for this host and quotes in
		// the "a new machine was paired" email, so a person can check the email
		// is about this machine.
		p.printf("key\t%s\n", publicKeyFingerprint(identity.PublicKey))
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
	p.printf("disk\t%s free on %s (%s)\n", hostdomain.HumanBytes(facts.DiskFreeBytes), facts.WorkspacePath, a.Paths.WorkspacesSource)
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
			"updates need a paired host: run the install command from Add host")
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
