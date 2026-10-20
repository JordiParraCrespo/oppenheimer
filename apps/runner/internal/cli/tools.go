package cli

import (
	"context"
	"io"
	"text/tabwriter"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// InstallTool puts one catalog tool on this host: `runner agents install <name>`
// and `runner tools install <name>` both land here, and kind is which of the
// two was typed, so `runner tools install claude` is told where claude lives.
// An agent may be named by its catalog id (`claude-code`) or its executable.
func (a *App) InstallTool(ctx context.Context, out io.Writer, kind hostdomain.InstallKind, name string) error {
	name = hostdomain.InstallName(name)
	if got, ok := hostdomain.InstallKindOf(name); ok && got != kind {
		return hostdomain.ErrInstallUnsupported.WithDetail("%s is an %s; run: runner %ss install %s", name, got, got, name)
	}
	p := newPrinter(out)
	p.printf("installing %s…\n", name)
	result, err := a.Host.Install(ctx, name)
	if err != nil {
		return err
	}
	switch result.Outcome {
	case hostdomain.InstallPresent:
		p.printf("%s is already installed: %s (%s)\n", result.Tool, result.Version, result.Path)
	case hostdomain.InstallInstalled:
		p.printf("%s installed: %s (%s)\n", result.Tool, result.Version, result.Path)
	}
	return p.err
}

// Tools prints every probed tool, its version, and how a missing one gets
// onto this host: the runner's own install command, or the package manager's
// for git and tmux.
func (a *App) Tools(ctx context.Context, out io.Writer) error {
	facts, err := a.Host.Collect(ctx)
	if err != nil {
		return err
	}
	tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	p := newPrinter(tw)
	for _, tool := range facts.Tools {
		if tool.Found() {
			p.printf("%s\t%s\t%s\n", tool.Name, tool.Version, tool.Path)
			continue
		}
		p.printf("%s\tnot found\t%s\n", tool.Name, installHintFor(facts.Platform, tool.Name))
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	return p.err
}

// installHintFor is the one line that gets a missing tool onto this host.
func installHintFor(platform hostdomain.Platform, name string) string {
	if kind, ok := hostdomain.InstallKindOf(name); ok {
		if _, err := hostdomain.InstallScript(name, platform); err == nil {
			return "runner " + string(kind) + "s install " + name
		}
	}
	if command := hostdomain.PackageInstallCommand(platform, []string{name}); command != "" {
		return command
	}
	return "install it with your package manager"
}
