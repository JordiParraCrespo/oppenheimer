package transcript

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// readLimit bounds how much of a transcript is read looking for the first
// message. It is near the top — a few bookkeeping lines come first — but a
// line can carry a pasted image, so the bound is generous.
const readLimit = 32 << 20

// claudeReader reads Claude Code's transcripts. Claude Code keeps one folder
// per working directory under `projects/` and, in it, one
// `<conversation>.jsonl`.
type claudeReader struct {
	projects string
}

func (c claudeReader) firstPrompt(conversation string) (string, error) {
	path := c.path(conversation)
	if path == "" {
		return "", nil
	}
	return firstClaudePrompt(path)
}

// path finds the conversation by its own name: the folder is the working
// directory as Claude Code encodes it, which changes between its versions,
// so the file is taken from whichever folder it is in.
func (c claudeReader) path(conversation string) string {
	matches, err := filepath.Glob(filepath.Join(c.projects, "*", conversation+".jsonl"))
	if err != nil {
		return ""
	}
	return newest(matches)
}

// newest is the most recently written of paths, so a conversation found in
// two folders (a version that encodes the folder differently) is read from
// the one the CLI is writing, whatever order the glob listed them in. "" when
// none can be read.
func newest(paths []string) string {
	var path string
	var at int64
	for _, candidate := range paths {
		info, err := os.Stat(candidate)
		if err != nil {
			continue
		}
		if modified := info.ModTime().UnixNano(); path == "" || modified > at || (modified == at && candidate < path) {
			path, at = candidate, modified
		}
	}
	return path
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
