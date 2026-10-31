package domain

import (
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// CodexEnvironmentRefusal is `codex cloud exec` having no environment under
// any label a repository was tried under. Visible is what the CLI showed of
// its environments instead (the labels on the account's recent tasks, the
// only view it gives outside its TUI), and Listed whether that could be read.
type CodexEnvironmentRefusal struct {
	Tried   []string
	Visible []string
	Listed  bool
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
	return ErrCodexCloudEnvironment.WithDetail(
		"codex cloud exec found no environment labelled %s. Environments made in ChatGPT Settings → Codex Cloud are not reachable by the CLI yet. Environments in this account's recent tasks: %s (partial: codex-cli lists its environments only in its TUI, `codex cloud`).",
		strings.Join(r.Tried, " or "), visible)
}
