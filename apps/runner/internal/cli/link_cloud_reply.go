package cli

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
)

// CloudReplier sends the person's message to a Claude Code cloud session
// (sessions/adapters/cloud), which wakes it when it is idle.
type CloudReplier interface {
	Send(ctx context.Context, cloudSessionID, text string) error
}

// cloudReply answers `cloud.reply`: a reply typed in the console's chat of a
// cloud session the Stop hook did not take, sent with the host's own claude.ai
// sign-in (product/next-steps/cloud-agents.md, "The chat of a cloud session").
func (h *linkHandler) cloudReply(ctx context.Context, m link.CloudReply) {
	var replier CloudReplier = cloud.Replier{}
	if h.app.CloudReplies != nil {
		replier = h.app.CloudReplies
	}
	if err := replier.Send(ctx, m.CloudSessionID, m.Text); err != nil {
		h.fail(m.CommandID, err)
		return
	}
	_ = h.client.Send(link.CloudReplied{Type: link.TypeCloudReplied, CommandID: m.CommandID})
}
