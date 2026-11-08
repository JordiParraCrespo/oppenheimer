package cli

import (
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
)

// laneCloudPrompt sends replies to cloud sessions off the read loop, one at a
// time: each is a run of the CLI that waits on claude.ai.
const laneCloudPrompt = "cloud:prompt"

// cloudPrompt answers `session.cloud.prompt`: a reply typed in the console
// for an idle Claude Code cloud session this host started, sent with the
// host's own `claude` so it wakes the session (`product/next-steps/cloud-agents.md`,
// "The chat of a cloud session"). The CLI took it is `session.cloud.prompted`;
// a refusal is command.failed, SESS_019 not signed in, SESS_020 anything else.
// The control plane names the session it was given at the start, so nothing
// here has to remember it.
func (h *linkHandler) cloudPrompt(m link.SessionCloudPrompt) {
	prompter := h.app.CloudPrompt
	if prompter == nil {
		prompter = cloud.Prompter{}
	}
	if err := prompter.Prompt(h.life, m.CloudSessionID, m.Text); err != nil {
		h.logger.Warn("a cloud session did not take a reply",
			"session", m.SessionID, "cloudSession", m.CloudSessionID, "error", err)
		h.fail(m.CommandID, err)
		return
	}
	_ = h.client.Send(link.SessionCloudPrompted{Type: link.TypeSessionCloudPrompted, CommandID: m.CommandID})
}
