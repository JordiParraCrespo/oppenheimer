// Package transcript reads a session's first message off the agent's own
// transcript, which is how a session launched with no task gets a name
// (02-runner §7): the person typed the task into the terminal, and the CLI
// wrote it down. The PTY is never scraped for it.
package transcript

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// readLimit bounds how much of a transcript is read looking for the first
// message. It is near the top — a few bookkeeping lines come first — but a
// line can carry a pasted image, so the bound is generous.
const readLimit = 32 << 20

// conversationPattern is the name a session's conversation takes: the
// session's id, a UUID. Anything else is never put in a path.
var conversationPattern = regexp.MustCompile(`^[0-9A-Za-z-]{1,64}$`)

// Reader is app.Transcripts over the files the agent CLIs keep. Claude Code
// is the one it reads; other agents report nothing yet, and their sessions
// keep their slug until they are renamed.
type Reader struct {
	// claudeProjects is Claude Code's `projects/` folder,
	// `~/.claude/projects` or `$CLAUDE_CONFIG_DIR/projects`. It keeps one
	// folder per working directory and, in it, one `<conversation>.jsonl`.
	claudeProjects string
	logger         *slog.Logger
}

var _ app.Transcripts = (*Reader)(nil)

// Options names the folders the reader looks in.
type Options struct {
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
	return &Reader{claudeProjects: opts.ClaudeProjects, logger: logger}
}

// FirstPrompt implements app.Transcripts.
func (r *Reader) FirstPrompt(agent domain.Agent, conversation string) string {
	if agent != domain.AgentClaude || r.claudeProjects == "" || !conversationPattern.MatchString(conversation) {
		return ""
	}
	// The folder is the working directory as Claude Code encodes it, which
	// changes between its versions; the conversation's own name does not, so
	// the file is found by that, in whichever folder it is.
	matches, err := filepath.Glob(filepath.Join(r.claudeProjects, "*", conversation+".jsonl"))
	if err != nil || len(matches) == 0 {
		return ""
	}
	text, err := firstClaudePrompt(matches[0])
	if err != nil {
		r.logger.Debug("could not read the session's transcript", slog.String("path", matches[0]), slog.Any("error", err))
		return ""
	}
	return text
}

// claudeEntry is the part of one Claude Code transcript line this reads.
type claudeEntry struct {
	Type             string `json:"type"`
	IsMeta           bool   `json:"isMeta"`
	IsSidechain      bool   `json:"isSidechain"`
	IsCompactSummary bool   `json:"isCompactSummary"`
	Message          *struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// firstClaudePrompt is the first line of the transcript that a person typed.
// A line still being written (no newline yet) is left for the next read.
func firstClaudePrompt(path string) (string, error) {
	file, err := os.Open(path) //nolint:gosec // a conversation file found under Claude Code's own folder, its name checked by conversationPattern
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	defer func() { _ = file.Close() }()
	lines := bufio.NewReader(io.LimitReader(file, readLimit))
	for {
		line, err := lines.ReadBytes('\n')
		if err != nil {
			if errors.Is(err, io.EOF) {
				return "", nil
			}
			return "", err
		}
		var entry claudeEntry
		if json.Unmarshal(line, &entry) != nil {
			continue
		}
		if text := entry.prompt(); text != "" {
			return text, nil
		}
	}
}

// prompt is what the person typed on this line, or "" for every line that is
// something else: the CLI's bookkeeping, a tool's result, a subagent's
// conversation, a compaction summary.
func (e claudeEntry) prompt() string {
	if e.Type != "user" || e.IsMeta || e.IsSidechain || e.IsCompactSummary || e.Message == nil || e.Message.Role != "user" {
		return ""
	}
	text, ok := contentText(e.Message.Content)
	if !ok {
		return ""
	}
	return typedText(strings.TrimSpace(text))
}

// contentText is a message's text: the string it is, or its text blocks
// joined. A message carrying a tool's result is the agent's turn, not the
// person's, and is not one.
func contentText(raw json.RawMessage) (string, bool) {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text, true
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &blocks) != nil {
		return "", false
	}
	var parts []string
	for _, block := range blocks {
		switch block.Type {
		case "tool_result":
			return "", false
		case "text":
			parts = append(parts, block.Text)
		}
	}
	return strings.Join(parts, "\n"), true
}

var (
	commandName = regexp.MustCompile(`<command-name>([^<]*)</command-name>`)
	commandArgs = regexp.MustCompile(`(?s)<command-args>(.*?)</command-args>`)
)

// typedText is a message as the person typed it. Claude Code writes a slash
// command as tags around its name and arguments, which reads as
// `/name arguments`; a command typed with none, a shell escape and the
// CLI's own notes say nothing about the task, and are skipped.
func typedText(text string) string {
	switch {
	case text == "",
		strings.HasPrefix(text, "Caveat:"),
		strings.HasPrefix(text, "[Request interrupted"),
		strings.HasPrefix(text, "<local-command-"),
		strings.HasPrefix(text, "<bash-"):
		return ""
	case strings.HasPrefix(text, "<command-"):
		args := commandArgs.FindStringSubmatch(text)
		if args == nil || strings.TrimSpace(args[1]) == "" {
			return ""
		}
		if name := commandName.FindStringSubmatch(text); name != nil && strings.TrimSpace(name[1]) != "" {
			return strings.TrimSpace(name[1]) + " " + strings.TrimSpace(args[1])
		}
		return strings.TrimSpace(args[1])
	}
	return text
}
