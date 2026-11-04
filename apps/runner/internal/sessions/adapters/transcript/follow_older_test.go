package transcript_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A Claude Code conversation is sent tail first: an attach sends its last
// 40 turns and where they start, and each offset the console asks for is
// answered with the 40 turns before it. Regression: a long conversation
// was read, previewed and sent whole on every attach to draw its end.

// turnLines is n turns of a conversation, each the person's prompt, a tool
// call, its result and the reply: four lines, and only the first opens it.
func turnLines(n int) []string {
	var lines []string
	for i := range n {
		lines = append(lines,
			fmt.Sprintf(`{"type":"user","uuid":"p%d","message":{"role":"user","content":"Prompt %d"}}`, i, i),
			fmt.Sprintf(`{"type":"assistant","uuid":"c%d","message":{"role":"assistant","content":[{"type":"tool_use","id":"t%d","name":"Bash","input":{"command":"ls"}}]}}`, i, i),
			fmt.Sprintf(`{"type":"user","uuid":"r%d","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t%d","content":"ok"}]}}`, i, i),
			fmt.Sprintf(`{"type":"assistant","uuid":"a%d","message":{"role":"assistant","content":[{"type":"text","text":"Reply %d"}]}}`, i, i),
		)
	}
	return lines
}

// offsetOf is where line i of lines starts in the file write made of them.
func offsetOf(lines []string, i int) int64 {
	var at int64
	for _, line := range lines[:i] {
		at += int64(len(line) + 1)
	}
	return at
}

func followAsking(t *testing.T, projects string, sink *batches) chan<- int64 {
	t.Helper()
	older := make(chan int64, 1)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects}).
			Follow(ctx, domain.Session{Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}}, 64<<10, 256, older, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
	return older
}

// uuids is the uuid of each entry in the batches, in order.
func uuids(got []app.ChatBatch) []string {
	var out []string
	for _, batch := range got {
		for _, entry := range batch.Entries {
			var decoded struct {
				UUID string `json:"uuid"`
			}
			_ = json.Unmarshal([]byte(entry), &decoded)
			out = append(out, decoded.UUID)
		}
	}
	return out
}

// page is the older page received after the history: its batches, once the
// one that ends it has come.
func (b *batches) page(t *testing.T, from int) []app.ChatBatch {
	t.Helper()
	eventually(t, "the older page", func() bool {
		b.mu.Lock()
		defer b.mu.Unlock()
		for _, batch := range b.got[from:] {
			if batch.Older == app.HistoryEnd {
				return true
			}
		}
		return false
	})
	b.mu.Lock()
	defer b.mu.Unlock()
	var page []app.ChatBatch
	for _, batch := range b.got[from:] {
		if batch.Older != "" {
			page = append(page, batch)
		}
	}
	return page
}

func TestAnAttachSendsTheLastTurnsFromWhereTheFirstOfThemOpens(t *testing.T) {
	lines := turnLines(100)
	projects := write(t, lines...)
	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "the tail", func() bool { return len(sink.entries()) == 160 })

	sink.mu.Lock()
	defer sink.mu.Unlock()
	first := sink.got[0]
	if !first.Reset || first.Before != offsetOf(lines, 240) {
		t.Fatalf("the tail's reset says it starts at %d, not at turn 60's prompt (%d)", first.Before, offsetOf(lines, 240))
	}
	if got := uuids(sink.got); got[0] != "p60" || got[len(got)-1] != "a99" {
		t.Fatalf("the tail runs %s..%s, not p60..a99", got[0], got[len(got)-1])
	}
}

func TestAShortConversationIsSentWholeWithNothingOlder(t *testing.T) {
	projects := write(t, turnLines(10)...)
	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "the history", func() bool { return len(sink.entries()) == 40 })
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if sink.got[0].Before != 0 {
		t.Fatalf("a conversation sent whole says it starts at %d", sink.got[0].Before)
	}
}

func TestEachOffsetAskedIsAnsweredWithTheTurnsBeforeIt(t *testing.T) {
	lines := turnLines(100)
	projects := write(t, lines...)
	sink := &batches{}
	older := followAsking(t, projects, sink)
	eventually(t, "the tail", func() bool { return len(sink.entries()) == 160 })

	sink.mu.Lock()
	from := len(sink.got)
	sink.mu.Unlock()
	older <- offsetOf(lines, 240)
	page := sink.page(t, from)
	if got := uuids(page); len(got) != 160 || got[0] != "p20" || got[len(got)-1] != "a59" {
		t.Fatalf("the first older page is %d entries from %v, not turns 20..59", len(got), got[:1])
	}
	last := page[len(page)-1]
	if last.Before != offsetOf(lines, 80) {
		t.Fatalf("the page says it starts at %d, not at turn 20's prompt (%d)", last.Before, offsetOf(lines, 80))
	}
	for _, batch := range page[:len(page)-1] {
		if batch.Older != app.HistoryMore || batch.Reset {
			t.Fatalf("a batch before the page's last says older %q, reset %v", batch.Older, batch.Reset)
		}
	}

	sink.mu.Lock()
	from = len(sink.got)
	sink.mu.Unlock()
	older <- last.Before
	page = sink.page(t, from)
	if got := uuids(page); len(got) != 80 || got[0] != "p0" {
		t.Fatalf("the last older page is %d entries from %v, not turns 0..19", len(got), got[:1])
	}
	if page[len(page)-1].Before != 0 {
		t.Fatalf("the page that reaches the first line says %d is older", page[len(page)-1].Before)
	}
	// What the console holds live is untouched by the pages.
	if n := len(sink.entries()); n != 160 {
		t.Fatalf("the pages changed the live history: %d entries", n)
	}
}

func TestAnOffsetThatIsNotALineStartIsAnsweredWithNothingOlder(t *testing.T) {
	lines := turnLines(100)
	projects := write(t, lines...)
	sink := &batches{}
	older := followAsking(t, projects, sink)
	eventually(t, "the tail", func() bool { return len(sink.entries()) == 160 })
	sink.mu.Lock()
	from := len(sink.got)
	sink.mu.Unlock()
	older <- offsetOf(lines, 240) + 3
	page := sink.page(t, from)
	if len(uuids(page)) != 0 || page[len(page)-1].Before != 0 {
		t.Fatalf("an offset inside a line was answered with %d entries, before %d", len(uuids(page)), page[len(page)-1].Before)
	}
}

func TestATurnLongerThanOneReadIsCutAtALine(t *testing.T) {
	// One prompt, then 6MB of the agent's work with no other prompt: the
	// tail cannot reach a turn's opening, so it starts at the first whole
	// line of the read, never inside one.
	filler := strings.Repeat("z", 200<<10)
	lines := []string{`{"type":"user","uuid":"p0","message":{"role":"user","content":"Go"}}`}
	for i := range 30 {
		lines = append(lines, fmt.Sprintf(`{"type":"assistant","uuid":"a%d","message":{"role":"assistant","content":[{"type":"text","text":"%s"}]}}`, i, filler))
	}
	projects := write(t, lines...)
	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "the tail", func() bool {
		sink.mu.Lock()
		defer sink.mu.Unlock()
		return len(sink.got) > 0 && sink.got[len(sink.got)-1].History == app.HistoryEnd
	})
	sink.mu.Lock()
	defer sink.mu.Unlock()
	before := sink.got[0].Before
	starts := false
	for i := range lines {
		starts = starts || offsetOf(lines, i) == before
	}
	if before == 0 || !starts {
		t.Fatalf("the tail starts at %d, not at a line past the first", before)
	}
}
