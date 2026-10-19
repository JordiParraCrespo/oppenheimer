// Package transcript reads a session's first message off the agent's own
// transcript, which is how a session launched with no task gets a name
// (02-runner §7): the person typed the task into the terminal, and the CLI
// wrote it down. The PTY is never scraped for it.
//
// Each agent keeps its transcript its own way, so each has its own reader in
// its own file (`claude.go`); this file only picks one. An agent with none
// reports nothing, and its sessions keep their slug until they are renamed.
package transcript

import (
	"log/slog"
	"regexp"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// conversationPattern is the name a session's conversation takes: the
// session's id, a UUID. Anything else is never put in a path.
var conversationPattern = regexp.MustCompile(`^[0-9A-Za-z-]{1,64}$`)

// agentReader is one agent's transcript: the first message a person sent in
// a conversation, or "" while there is none yet. An error is a transcript
// that is there and cannot be read.
type agentReader interface {
	firstPrompt(conversation string) (string, error)
}

// Reader is app.Transcripts over the files the agent CLIs keep, dispatching
// to the agent's own reader.
type Reader struct {
	agents map[domain.Agent]agentReader
	logger *slog.Logger
}

var _ app.Transcripts = (*Reader)(nil)

// Options names the folders the readers look in. An empty one leaves that
// agent without a reader.
type Options struct {
	// ClaudeProjects is Claude Code's `projects/` folder,
	// `~/.claude/projects` or `$CLAUDE_CONFIG_DIR/projects`.
	ClaudeProjects string
	// Logger reports a transcript that could not be read, which the session
	// service treats as none yet; nil is the process's default logger.
	Logger *slog.Logger
}

// New builds the reader.
func New(opts Options) *Reader {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	agents := map[domain.Agent]agentReader{}
	if opts.ClaudeProjects != "" {
		agents[domain.AgentClaude] = claudeReader{projects: opts.ClaudeProjects}
	}
	return &Reader{agents: agents, logger: logger}
}

// FirstPrompt implements app.Transcripts.
func (r *Reader) FirstPrompt(agent domain.Agent, conversation string) string {
	reader, ok := r.agents[agent]
	if !ok || !conversationPattern.MatchString(conversation) {
		return ""
	}
	text, err := reader.firstPrompt(conversation)
	if err != nil {
		r.logger.Debug("could not read the session's transcript",
			slog.String("agent", string(agent)), slog.String("conversation", conversation), slog.Any("error", err))
		return ""
	}
	return text
}
