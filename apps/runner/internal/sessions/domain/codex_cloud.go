package domain

import (
	"strconv"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// CodexEnvironmentRefusal is `codex cloud exec` having no environment under
// the one picked or any label a repository was tried under. Visible is what
// the CLI showed of its environments instead, and Listed whether that could
// be read. Complete says Visible is every environment the CLI can reach, read
// from the account's own list; otherwise it is the labels on the account's
// recent tasks, partial.
type CodexEnvironmentRefusal struct {
	Tried    []string
	Visible  []string
	Listed   bool
	Complete bool
}

// codexLegacyOnly is the one place the reason and the way out are written,
// as read in openai/codex on 2026-11-11 (product/research/cloud-agents.md
// §7): `codex cloud` starts tasks only in Codex Cloud (Legacy) environments,
// and nothing headless starts one in the environments of ChatGPT Settings →
// Codex Cloud. It closes the detail, after the environments: a session's log
// keeps a failure's first 500 characters, and the names are what only the
// host knows.
const codexLegacyOnly = "The codex CLI starts tasks only in Codex Cloud (Legacy) environments; " +
	"one made in ChatGPT Settings → Codex Cloud starts only from ChatGPT. " +
	"Pick a legacy environment, or start this task in ChatGPT."

// codexLogCut is how much of a failure a session's log keeps
// (`failurePayload` in internal/cli/link.go).
const codexLogCut = 500

// Problem is the refusal as ErrCodexCloudEnvironment. The names it carries
// are bounded by what the log's cut leaves once everything else is said, so
// that the way out, which closes the detail, is not what gets cut: as many
// names as fit, and the rest counted.
func (r CodexEnvironmentRefusal) Problem() *problem.Error {
	format := "codex cloud exec found no environment named %s. Environments in this account's recent tasks: %s (a partial list). %s"
	if r.Complete {
		format = "No Codex environment the CLI can reach is linked to the repository or labelled %s. Environments the CLI can reach: %s. %s"
	}
	tried := strings.Join(r.Tried, " or ")
	detail := func(visible string) *problem.Error {
		return ErrCodexCloudEnvironment.WithDetail(format, tried, visible, codexLegacyOnly)
	}
	switch {
	case !r.Listed:
		return detail("could not be read")
	case len(r.Visible) == 0:
		return detail("none")
	}
	return detail(withinBudget(r.Visible, codexLogCut-len(detail("").Error())))
}

// withinBudget joins names for as long as they, and the count of the rest,
// fit in budget characters; with room for none, it is the count alone, which
// is all that can be done for a repository whose own name fills the log.
func withinBudget(names []string, budget int) string {
	rest := func(n int) string { return "and " + strconv.Itoa(n) + " more" }
	out := ""
	for i, name := range names {
		next := name
		if out != "" {
			next = out + ", " + name
		}
		left := len(names) - 1 - i
		need := len(next)
		if left > 0 {
			need += len(", " + rest(left))
		}
		if need > budget {
			if out == "" {
				return strconv.Itoa(len(names)) + ", not named here"
			}
			return out + ", " + rest(len(names)-i)
		}
		out = next
	}
	return out
}
