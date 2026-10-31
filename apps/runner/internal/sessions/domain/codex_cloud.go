package domain

import (
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// CodexEnvironmentRefusal is `codex cloud exec` having no environment under
// any label a repository was tried under. Visible is what the CLI showed of
// its environments instead, and Listed whether that could be read. Complete
// says Visible is every environment the CLI can reach, read from the account's
// own list; otherwise it is the labels on the account's recent tasks, partial.
type CodexEnvironmentRefusal struct {
	Tried    []string
	Visible  []string
	Listed   bool
	Complete bool
}

// Problem is the refusal as ErrCodexCloudEnvironment, its detail the one
// place the reason is written: the CLI resolves only the environments
// `codex cloud` lists, so those made in ChatGPT Settings → Codex Cloud are
// out of its reach.
func (r CodexEnvironmentRefusal) Problem() *problem.Error {
	visible := "could not be read"
	if r.Listed {
		visible = "none"
		if len(r.Visible) > 0 {
			visible = strings.Join(r.Visible, ", ")
		}
	}
	if r.Complete {
		return ErrCodexCloudEnvironment.WithDetail(
			"No Codex environment the CLI can reach is linked to the repository or labelled %s. Pick one when you start the session, or link the repository to one. Environments made in ChatGPT Settings → Codex Cloud are not reachable by the CLI yet. Environments the CLI can reach: %s.",
			strings.Join(r.Tried, " or "), visible)
	}
	return ErrCodexCloudEnvironment.WithDetail(
		"codex cloud exec found no environment labelled %s. Environments made in ChatGPT Settings → Codex Cloud are not reachable by the CLI yet. Environments in this account's recent tasks: %s (partial: codex-cli lists its environments only in its TUI, `codex cloud`).",
		strings.Join(r.Tried, " or "), visible)
}
