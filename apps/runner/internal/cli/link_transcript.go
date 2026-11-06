package cli

import (
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// laneTranscriptRead reads pages of conversations off the read loop, one at
// a time: each is a read of up to a few megabytes of one file.
const laneTranscriptRead = "transcript:read"

// The bounds of one `transcript.page`, the protocol's
// TRANSCRIPT_PAGE_MAX_ENTRIES and TRANSCRIPT_PAGE_MAX_BYTES
// (`packages/shared/src/protocol/transcript.ts`).
const (
	transcriptPageMaxEntries = 200
	transcriptPageMaxBytes   = 256 << 10
)

// transcriptRead answers `transcript.read` with a page of the session's
// conversation (`product/next-steps/agent-tools.md` §8), its entries cut to
// the chat's own bound as `attachment.chat` carries them. A session this
// host does not hold is SESS_001, an agent with no transcript the runner
// reads SESS_018, both as command.failed.
func (h *linkHandler) transcriptRead(m link.TranscriptRead) {
	page, err := h.app.Conversations.ReadTranscript(m.SessionID, sessionsapp.TranscriptPageRequest{
		Conversation: m.Conversation, After: m.After,
		Limit:    min(max(m.Limit, 1), transcriptPageMaxEntries),
		BytesMax: transcriptPageMaxBytes, EntryMax: link.ChatEntryMaxBytes,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	entries := page.Entries
	if entries == nil {
		// The control plane refuses `entries: null`.
		entries = []string{}
	}
	_ = h.client.Send(link.TranscriptPage{
		Type: link.TypeTranscriptPage, CommandID: m.CommandID,
		Conversation: page.Conversation, Entries: entries,
		From: page.From, Next: page.Next, AtEnd: page.AtEnd,
		Restarted: page.Restarted, Dropped: page.Dropped, Partial: page.Partial,
	})
}
