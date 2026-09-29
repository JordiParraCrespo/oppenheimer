package domain

import (
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
)

// AgentUpdateInterval is how often the runner brings every installed agent
// CLI to its latest release. Vendors gate a new model on a newer CLI the day
// the model ships ("Claude Code 2.1.274 does not support this model; version
// 2.1.280 or newer is required"), so a host that updates daily would refuse
// the new model for most of a day. Each updater is one version check when
// there is nothing new, so an hour costs little.
const AgentUpdateInterval = time.Hour

// AgentUpdateTimeout bounds one updater: a download of a CLI release on a
// slow link, with room to spare. An updater that hangs past it is killed with
// its process group and reported as failed; the next tick tries again.
const AgentUpdateTimeout = 5 * time.Minute

// AgentUpdateArgs is the argv, appended to the agent's executable, that runs
// that CLI's own updater. ok is false for a tool that is not an agent or has
// no updater: git and tmux belong to the host's package manager, not to us.
//
// The table is the catalog's (`packages/shared/src/agents/catalog.ts`),
// generated into agent_update.gen.go.
func AgentUpdateArgs(tool string) (args []string, ok bool) {
	args, ok = agentUpdates[tool]
	return slices.Clone(args), ok
}

// AgentUpdateOutcome is what one updater run came to.
type AgentUpdateOutcome string

const (
	// AgentUpdated: the CLI now reports a different version than before.
	AgentUpdated AgentUpdateOutcome = "updated"
	// AgentCurrent: the updater succeeded and the version did not move.
	AgentCurrent AgentUpdateOutcome = "current"
	// AgentUpdateFailed: the updater exited non-zero or timed out. The CLI
	// is still the one it was; nothing is rolled back because nothing moved.
	AgentUpdateFailed AgentUpdateOutcome = "failed"
)

// AgentUpdate is one agent's result: the version before and after, as the
// CLI itself prints it, and why it failed when it did.
type AgentUpdate struct {
	Tool    string             `json:"tool"`
	From    string             `json:"from,omitempty"`
	To      string             `json:"to,omitempty"`
	Outcome AgentUpdateOutcome `json:"outcome"`
	// Detail is the updater's last line of output on failure: usually the
	// reason ("EACCES: permission denied", "not installed via …").
	Detail string `json:"detail,omitempty"`
}

// versionNumber is the first dotted number in a `--version` line.
var versionNumber = regexp.MustCompile(`\d+(?:\.\d+)+`)

// SameVersion reports whether two `--version` lines name the same release.
// The number decides when both have one, because a CLI may reword the line
// around it across an update — grok 1.0.44 prints a `[stable]` suffix once
// it has run its updater, with the release unchanged.
func SameVersion(a, b string) bool {
	na, nb := versionNumber.FindString(a), versionNumber.FindString(b)
	if na != "" && nb != "" {
		return na == nb
	}
	return strings.TrimSpace(a) == strings.TrimSpace(b)
}

// ansiEscape matches the terminal control sequences an updater's spinner and
// colours leave in its output.
var ansiEscape = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// UpdateFailureDetail picks the line of a failed updater's output worth
// showing: the last one with at least a short word in it, once colours and
// box-drawing are gone. Updaters that draw a TUI end on a frame glyph or on
// the answer they defaulted to ("> No"), which says nothing on its own.
func UpdateFailureDetail(output string) string {
	lines := strings.Split(ansiEscape.ReplaceAllString(output, ""), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimFunc(lines[i], func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '(' && r != ')' && r != '\'' && r != '?' && r != '.'
		})
		letters := 0
		for _, r := range line {
			if unicode.IsLetter(r) {
				letters++
			}
		}
		if letters >= 4 {
			return line
		}
	}
	return ""
}
