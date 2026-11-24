package cli

import (
	"os/exec"
	"path/filepath"
	"testing"
)

// An agent starts the runner's MCP server from its own PATH, which tmux takes
// from the runner and not from the session, and which may hold no `runner`:
// the command named it bare, so every agent's `notify`, `send_file` and
// child-session tools failed to start (ENOENT) on a host with nothing called
// `runner` on its PATH.
func TestAnAgentStartsTheRunnersToolsWhateverItsPATH(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	linkRunner(paths)
	t.Setenv("PATH", t.TempDir())

	command := sessionTools(paths, "s1")

	if !filepath.IsAbs(command[0]) {
		t.Fatalf("the MCP server is started by name, %q, which the agent's PATH may not reach", command[0])
	}
	if _, err := exec.LookPath(command[0]); err != nil {
		t.Fatalf("the MCP server's program %q is not there to run: %v", command[0], err)
	}
}

// macOS names a running binary by the path it was started by, so `runner
// status` typed in a session, found through `bin/path/runner`, pointed that
// link at itself: every later `runner` and MCP server start through it failed
// with "too many levels of symbolic links".
func TestARunnerStartedThroughItsLinkLeavesTheLinkWorking(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	linkRunner(paths)
	link := filepath.Join(paths.Commands(), "runner")

	pointRunnerAt(paths, link)

	if _, err := filepath.EvalSymlinks(link); err != nil {
		t.Fatalf("the link no longer reaches the runner: %v", err)
	}
}

// tmux gives a session's programs the PATH of the runner that started them,
// so `runner --skill` and `runner sessions …` work by name only when the
// runner's own PATH reaches the command.
func TestTheRunnersPATHReachesRunnerByName(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	linkRunner(paths)
	t.Setenv("PATH", runnerPATH(t.TempDir(), paths))

	if _, err := exec.LookPath("runner"); err != nil {
		t.Fatalf("`runner` is not on the PATH a session inherits: %v", err)
	}
}
