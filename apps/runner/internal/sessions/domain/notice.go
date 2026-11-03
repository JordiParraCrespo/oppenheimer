package domain

// AgentNotifiedKind is the event kind a notice an agent sent the person is
// logged as (`runner sessions notify`, `product/next-steps/agent-tools.md` §2).
const AgentNotifiedKind = "agent.notified"

// NoticeMaxBytes bounds a notice's words: a line for the Inbox, not a report.
const NoticeMaxBytes = 500

// Notice is one line an agent sent the person, by its own id so the person's
// marks on it (done, snoozed) never hide the next one.
type Notice struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
