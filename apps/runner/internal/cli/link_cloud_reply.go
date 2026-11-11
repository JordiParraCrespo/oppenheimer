package cli

import (
	"context"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// cloudReplyBudget is how long a `cloud.reply` has from the moment it
// arrives, its wait behind an earlier reply to the same session included.
// The control plane waits 60 s for the answer, so this one always comes
// before it gives up and has to count the message as maybe sent.
const cloudReplyBudget = 45 * time.Second

// CloudReplier sends the person's message to a Claude Code cloud session
// (sessions/adapters/cloud), which wakes it when it is idle.
type CloudReplier interface {
	Send(ctx context.Context, cloudSessionID, text string) error
}

// cloudReply answers `cloud.reply`: a reply typed in the console's chat of a
// cloud session the Stop hook did not take, sent with the host's own claude.ai
// sign-in (product/next-steps/cloud-agents.md, "The chat of a cloud session").
// One that waited its whole budget behind another is refused unsent, which
// hands it back to the session's Stop hook.
func (h *linkHandler) cloudReply(ctx context.Context, m link.CloudReply, received time.Time) {
	deadline := received.Add(cloudReplyBudget)
	if !time.Now().Before(deadline) {
		h.fail(m.CommandID, sessionsdomain.ErrCloudReply.WithDetail(
			"waited %s behind an earlier message to the session; not sent", cloudReplyBudget))
		return
	}
	ctx, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()
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
