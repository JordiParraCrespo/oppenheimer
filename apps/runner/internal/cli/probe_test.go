package cli_test

import (
	"slices"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/cli"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The control plane reads the inventory's tool names as the agents this runner
// can start, and refuses a session for one it did not probe (`SESSIONS_011`).
// So every agent with a command has to be in the probe list, found or not: an
// agent added to the launcher and left out here would be refused on every host.
func TestEveryAgentTheRunnerCanStartIsProbed(t *testing.T) {
	for _, agent := range sessionsdomain.Agents() {
		command := agent.Command()
		if command == "" {
			continue
		}
		if !slices.Contains(hostdomain.ProbedTools, command) {
			t.Errorf("%s launches %q, which ProbedTools does not report", agent, command)
		}
	}
}

// A CLI the runner installed into ~/.local/bin is found by the probe and by
// every session even when the service's PATH never had that directory, and a
// copy the person installed earlier on PATH still wins.
func TestWithInstallBinsAppendsTheCatalogDirectoriesOnce(t *testing.T) {
	if got := cli.WithInstallBins("/usr/bin", "/home/j"); got != "/usr/bin:/home/j/.local/bin" {
		t.Fatalf("PATH = %q", got)
	}
	if got := cli.WithInstallBins("/home/j/.local/bin:/usr/bin", "/home/j"); got != "/home/j/.local/bin:/usr/bin" {
		t.Fatalf("PATH with the directory already on it = %q", got)
	}
}
