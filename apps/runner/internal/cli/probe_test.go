package cli_test

import (
	"slices"
	"testing"

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
