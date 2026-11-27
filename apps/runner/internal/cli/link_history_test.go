package cli

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// A watcher on a read-only share scrolls back: its wheel never reaches tmux,
// so the console asks for the pane's scrollback instead, and gets one page.
// The regression is a watcher's terminal that does not scroll at all.
func TestAReadOnlyAttachmentIsAnsweredWithItsScrollback(t *testing.T) {
	pty := newHeldPTY(false)
	h, sent, terminals := newAttachHarness(t, pty, nil)
	h.Message(context.Background(), message(t, "session.attach", map[string]any{
		"commandId": "55555555-5555-4555-8555-555555555555", "sessionId": sessionUnderTest,
		"attachmentId": attachmentUnderTest, "window": 0, "cols": 80, "rows": 24, "readOnly": true,
	}))
	waitForAttachment(t, h)
	terminals.scrollback = "\x1b[32mline 1\x1b[0m\nline 2\n"
	terminals.scrolled = make(chan string, 1)

	h.Message(context.Background(), message(t, "attachment.history", map[string]any{
		"attachmentId": attachmentUnderTest, "lines": 5000,
	}))

	select {
	case asked := <-terminals.scrolled:
		if !strings.HasSuffix(asked, ":0 5000") {
			t.Fatalf("tmux was asked for %q, want window 0's 5000 lines", asked)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("tmux was never asked for the scrollback")
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		sent.mu.Lock()
		var page *link.AttachmentHistoryPage
		for _, m := range sent.sent {
			if p, ok := m.(link.AttachmentHistoryPage); ok {
				page = &p
			}
		}
		sent.mu.Unlock()
		if page != nil {
			if page.AttachmentID != attachmentUnderTest || page.Text != terminals.scrollback || page.Truncated {
				t.Fatalf("page = %+v", *page)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("no attachment.history.page was sent")
		}
		time.Sleep(time.Millisecond)
	}
}

// A long scrollback keeps its newest lines and starts at a line, so a page
// never opens inside an escape sequence.
func TestAHistoryPageKeepsItsLastWholeLines(t *testing.T) {
	text := "\x1b[31mfirst line\x1b[0m\nsecond\nthird\n"
	page, cut := historyTail(text, jsonSize("second\nthird\n"))
	if !cut || page != "second\nthird\n" {
		t.Fatalf("historyTail = %q, %v", page, cut)
	}
	if page, cut := historyTail(text, jsonSize(text)); cut || page != text {
		t.Fatalf("a text that fits was cut: %q, %v", page, cut)
	}
}

// A page of coloured lines is sized as it goes on the wire, where each
// escape byte is six: sized by its raw bytes, a colourful scrollback went
// over the link's frame cap and was never sent, so the guest waited forever.
func TestAColouredHistoryPageFitsOneFrame(t *testing.T) {
	line := strings.Repeat("\x1b[32m<a&b>\x1b[0m", 20) + "\n"
	text := strings.Repeat(line, 20000)
	page, cut := historyTail(text, link.AttachmentHistoryMaxBytes)
	if !cut {
		t.Fatal("a scrollback larger than a page was not cut")
	}
	encoded, err := json.Marshal(link.AttachmentHistoryPage{
		Type: link.TypeAttachmentHistoryPage, AttachmentID: 1, Text: page, Truncated: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(encoded) > link.MaxFrameBytes {
		t.Fatalf("the page encodes to %d bytes, over the %d a frame carries", len(encoded), link.MaxFrameBytes)
	}
	if !strings.HasPrefix(page, "\x1b[32m") {
		t.Fatalf("the page opens mid-line: %q", page[:20])
	}
}
