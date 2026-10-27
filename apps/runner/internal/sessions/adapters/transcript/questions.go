package transcript

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// askUserQuestion is the tool Claude Code asks a person a question with.
const askUserQuestion = "AskUserQuestion"

// questionsOpenMax bounds the calls a watch keeps open at once: the agent
// waits on one, so more than a few is a transcript of calls whose results
// this never saw, and the oldest is the one to forget.
const questionsOpenMax = 8

// questionWatch is one conversation's read position and the AskUserQuestion
// calls it has seen with no result yet, oldest first.
type questionWatch struct {
	path    string
	offset  int64
	partial []byte
	open    []domain.Decision
}

// OpenQuestion implements app.Transcripts: the latest AskUserQuestion call
// in the conversation whose result is not in the transcript yet. Each call
// reads only what the CLI appended since the last one, so asking on every
// poll costs a stat once the history has been read.
func (r *Reader) OpenQuestion(agent domain.Agent, conversation string) (domain.Decision, bool) {
	reader, ok := r.agents[agent]
	if !ok || agent != domain.AgentClaude || !conversationPattern.MatchString(conversation) {
		return domain.Decision{}, false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.questions == nil {
		r.questions = map[string]*questionWatch{}
	}
	watch := r.questions[conversation]
	if watch == nil {
		watch = &questionWatch{}
		r.questions[conversation] = watch
	}
	watch.read(reader.path(conversation))
	if len(watch.open) == 0 {
		return domain.Decision{}, false
	}
	return watch.open[len(watch.open)-1], true
}

// read takes in every line appended to path since the last read. A new file,
// or one that shrank, is read again from its start.
func (w *questionWatch) read(path string) {
	if path == "" {
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		return
	}
	if path != w.path || info.Size() < w.offset {
		*w = questionWatch{path: path}
	}
	if info.Size() == w.offset {
		return
	}
	file, err := os.Open(path) //nolint:gosec // a conversation file found under Claude Code's own folder, its name checked by conversationPattern
	if err != nil {
		return
	}
	defer func() { _ = file.Close() }()
	if _, err := file.Seek(w.offset, io.SeekStart); err != nil {
		return
	}
	for {
		chunk, err := io.ReadAll(io.LimitReader(file, followReadMax))
		if err != nil && !errors.Is(err, io.EOF) {
			return
		}
		if len(chunk) == 0 {
			return
		}
		w.offset += int64(len(chunk))
		data := append(append([]byte(nil), w.partial...), chunk...)
		end := bytes.LastIndexByte(data, '\n')
		if end < 0 {
			w.partial = data
			continue
		}
		w.partial = append([]byte(nil), data[end+1:]...)
		for _, line := range bytes.Split(data[:end], []byte{'\n'}) {
			w.line(line)
		}
	}
}

// line opens a question for an AskUserQuestion call and closes the one a
// tool result answers.
func (w *questionWatch) line(line []byte) {
	if !bytes.Contains(line, []byte(`"tool_`)) {
		return
	}
	var in claudeChatLine
	if json.Unmarshal(line, &in) != nil || in.Message == nil {
		return
	}
	var blocks []claudeBlock
	if json.Unmarshal(in.Message.Content, &blocks) != nil {
		return
	}
	for _, block := range blocks {
		switch {
		case block.Type == "tool_use" && block.Name == askUserQuestion && in.Type == "assistant":
			if decision, ok := domain.QuestionDecision(block.ID, block.Input); ok {
				w.close(block.ID)
				w.open = append(w.open, decision)
				if len(w.open) > questionsOpenMax {
					w.open = w.open[1:]
				}
			}
		case block.Type == "tool_result" && block.ToolUseID != "":
			w.close(block.ToolUseID)
		}
	}
}

func (w *questionWatch) close(id string) {
	for i, decision := range w.open {
		if decision.ID == id {
			w.open = append(w.open[:i], w.open[i+1:]...)
			return
		}
	}
}
