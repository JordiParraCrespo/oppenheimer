package cli

import (
	"context"
	"errors"
	"flag"
	"io"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/statuspty"
)

// PTY is `runner pty --report FILE -- program [args…]`, what window 0 of a
// session runs its agent under. It answers the agent's OSC 7501 probe, which
// tmux does not, keeps what the agent reports in FILE for the poll loop, and
// passes everything else through. It returns the program's exit code, so the
// pane ends as the agent did.
func PTY(ctx context.Context, args []string, stderr io.Writer) (int, error) {
	fs := flag.NewFlagSet("pty", flag.ContinueOnError)
	fs.SetOutput(stderr)
	report := fs.String("report", "", "file the program's OSC 7501 reports are kept in")
	if err := fs.Parse(args); err != nil {
		return ExitUsage, err
	}
	argv := fs.Args()
	if len(argv) == 0 {
		return ExitUsage, errors.New("usage: runner pty [--report FILE] -- program [args…]")
	}
	return statuspty.Run(ctx, statuspty.RunOptions{Argv: argv, Report: *report, In: os.Stdin, Out: os.Stdout})
}

// programStatusDir is where each wrapped session's report file lives.
func programStatusDir(paths Paths) string {
	return filepath.Join(paths.State(), "program-status")
}

// linkRunner points `<bin>/path/runner` at this binary, best effort: a
// session without it still runs, its agent just cannot call `runner` by name.
func linkRunner(paths Paths) {
	pointRunnerAt(paths, runnerExecutable())
}

// pointRunnerAt points `<bin>/path/runner` at executable. A runner started
// through the link itself leaves it alone: macOS names a binary by the path
// it was started by, and pointing the link there would point it at itself.
func pointRunnerAt(paths Paths, executable string) {
	if executable == "" {
		return
	}
	dir := paths.Commands()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	link := filepath.Join(dir, "runner")
	if target, err := os.Readlink(link); err == nil && target == executable {
		return
	}
	if self, err := os.Lstat(executable); err == nil {
		if existing, err := os.Lstat(link); err == nil && os.SameFile(self, existing) {
			return
		}
	}
	tmp := link + ".new"
	_ = os.Remove(tmp)
	if os.Symlink(executable, tmp) == nil {
		_ = os.Rename(tmp, link)
	}
}

// runnerPATH is path with the directory of `runner` appended, for the
// runner's own process: tmux gives a pane the PATH of the client that made
// it, the runner, and drops one set on the session with `-e`.
func runnerPATH(path string, paths Paths) string {
	return WithDir(path, paths.Commands())
}

// sessionTools is the command that starts the runner's MCP server for a
// session's agent. The runner by its path, not its name: an agent looks the
// command up on its own PATH, which may not reach `runner`, or may find
// another program by that name first.
func sessionTools(paths Paths, session string) []string {
	return []string{filepath.Join(paths.Commands(), "runner"), "mcp", "--session", session, "--socket", paths.Socket()}
}

// runnerExecutable is this binary, for the commands a session runs back
// into it; empty when it cannot name itself.
func runnerExecutable() string {
	executable, err := os.Executable()
	if err != nil {
		return ""
	}
	return executable
}
