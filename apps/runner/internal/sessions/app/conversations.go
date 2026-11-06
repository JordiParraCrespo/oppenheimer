package app

import (
	"context"
	"errors"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Conversations is what a session's agent and the person said to each other,
// read off the agent's own transcript: followed live for the console's chat
// view, or read a page at a time for a reader with no browser attached. It
// reads sessions and never writes them, so it holds no lock of the
// lifecycle's and changes nothing a command or a refresh relies on.
type Conversations struct {
	sessions    RecordedSessions
	transcripts Transcripts
}

// RecordedSessions is where Conversations finds a session: only one whose
// create has landed, as every operation but Get asks. The session lifecycle
// (*Service) is the one implementation; the method is unexported so the
// lookup stays the lifecycle's own rule rather than a second copy of it.
type RecordedSessions interface {
	recorded(id string) (domain.Session, error)
}

var _ RecordedSessions = (*Service)(nil)

// ConversationsOptions configure Conversations.
type ConversationsOptions struct {
	// Sessions is the session lifecycle, which says which sessions this host
	// holds and where each one's conversation is.
	Sessions RecordedSessions
	// Transcripts reads the agents' transcripts; nil reads none, and every
	// session then has no chat and no transcript.
	Transcripts Transcripts
}

// NewConversations builds the conversation reader.
func NewConversations(opts ConversationsOptions) *Conversations {
	return &Conversations{sessions: opts.Sessions, transcripts: opts.Transcripts}
}

// FollowChat follows a session's conversation for the chat view, sending
// its transcript entries to emit until ctx ends (Transcripts.Follow).
// ErrNoChat for a session whose agent's transcript this runner cannot read.
func (c *Conversations) FollowChat(ctx context.Context, id string, entryMax, batchMax int, older <-chan int64, emit func(ChatBatch) error) error {
	if c.transcripts == nil {
		return ErrNoChat
	}
	session, err := c.sessions.recorded(id)
	if err != nil {
		return err
	}
	return c.transcripts.Follow(ctx, session, entryMax, batchMax, older, emit)
}

// ReadTranscript is one page of a session's conversation, read on request
// (Transcripts.ReadPage). ErrNotFound for a session this host does not hold,
// ErrNoTranscript for one whose agent keeps no transcript this runner reads.
func (c *Conversations) ReadTranscript(id string, req TranscriptPageRequest) (TranscriptPage, error) {
	session, err := c.sessions.recorded(id)
	if err != nil {
		return TranscriptPage{}, err
	}
	if c.transcripts == nil {
		return TranscriptPage{}, domain.ErrNoTranscript.WithDetail("this runner reads no transcripts")
	}
	page, err := c.transcripts.ReadPage(session, req)
	if errors.Is(err, ErrNoChat) {
		return TranscriptPage{}, domain.ErrNoTranscript.WithDetail("session %s runs %s", session.ID, session.Agent)
	}
	return page, err
}
