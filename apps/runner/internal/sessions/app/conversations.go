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
	commands    SlashCommands
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
	// Commands lists a project's slash commands for the chat's `/` menu;
	// nil lists none.
	Commands SlashCommands
}

// NewConversations builds the conversation reader.
func NewConversations(opts ConversationsOptions) *Conversations {
	return &Conversations{sessions: opts.Sessions, transcripts: opts.Transcripts, commands: opts.Commands}
}

// FollowChat follows a session's conversation for the chat view, sending
// its transcript entries to emit until ctx ends (Transcripts.Follow), and
// with each Reset at most commandsMax of the project's slash commands.
// ErrNoChat for a session whose agent's transcript this runner cannot read.
func (c *Conversations) FollowChat(ctx context.Context, id string, entryMax, batchMax, commandsMax int, older <-chan int64, emit func(ChatBatch) error) error {
	if c.transcripts == nil {
		return ErrNoChat
	}
	session, err := c.sessions.recorded(id)
	if err != nil {
		return err
	}
	commands := c.slashCommands(session, commandsMax)
	return c.transcripts.Follow(ctx, session, entryMax, batchMax, older, func(batch ChatBatch) error {
		if batch.Reset {
			batch.Commands = commands
		}
		return emit(batch)
	})
}

// slashCommands are the commands the session's project gives its agent,
// read once per follow: Claude Code's alone, the one agent whose skills and
// commands this runner knows where to find.
func (c *Conversations) slashCommands(session domain.Session, max int) []domain.SlashCommand {
	if c.commands == nil || session.Agent != domain.AgentClaude || max <= 0 {
		return nil
	}
	return c.commands.InFolder(session.Cwd(), max)
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
