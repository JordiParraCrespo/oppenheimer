package domain

import (
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
// Codex Cloud.
const codexLegacyOnly = "The codex CLI starts tasks only in Codex Cloud (Legacy) environments, the ones `codex cloud` lists on the host; " +
	"an environment made in ChatGPT Settings → Codex Cloud can only be started from ChatGPT (web, desktop or mobile). " +
	"Pick a legacy environment when you start the session, or start this task in ChatGPT."

// Problem is the refusal as ErrCodexCloudEnvironment.
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
			"No Codex environment the CLI can reach is linked to the repository or labelled %s. %s Environments the CLI can reach: %s.",
			strings.Join(r.Tried, " or "), codexLegacyOnly, visible)
	}
	return ErrCodexCloudEnvironment.WithDetail(
		"codex cloud exec found no environment named %s. %s Environments in this account's recent tasks: %s (partial: codex-cli lists its environments only in its TUI, `codex cloud`).",
		strings.Join(r.Tried, " or "), codexLegacyOnly, visible)
}
