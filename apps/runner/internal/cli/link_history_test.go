package cli

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// watching is a handler with one read-only attachment open, as a guest's
// view-only share opens it, and the tmux its scrollback is read from.
func watching(t *testing.T) (*linkHandler, *capturedLink, *heldAttach) {
	t.Helper()
	h, sent, terminals := newAttachHarness(t, newHeldPTY(false), nil)
	h.Message(context.Background(), message(t, "session.attach", map[string]any{
		"commandId": "55555555-5555-4555-8555-555555555555", "sessionId": sessionUnderTest,
		"attachmentId": attachmentUnderTest, "window": 0, "cols": 80, "rows": 24, "readOnly": true,
	}))
	waitForAttachment(t, h)
	return h, sent, terminals
}

// askHistory is the console's `attachment.history` for the attachment under test.
func askHistory(t *testing.T, h *linkHandler) {
	t.Helper()
	h.Message(context.Background(), message(t, "attachment.history", map[string]any{
		"attachmentId": attachmentUnderTest, "lines": 5000,
	}))
}

// historyPages is every `attachment.history.page` sent so far.
func historyPages(sent *capturedLink) []link.AttachmentHistoryPage {
	sent.mu.Lock()
	defer sent.mu.Unlock()
	var pages []link.AttachmentHistoryPage
	for _, m := range sent.sent {
		if page, ok := m.(link.AttachmentHistoryPage); ok {
			pages = append(pages, page)
		}
	}
	return pages
}

// firstHistoryPage waits for the first page sent.
func firstHistoryPage(t *testing.T, sent *capturedLink) link.AttachmentHistoryPage {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if pages := historyPages(sent); len(pages) > 0 {
			return pages[0]
		}
		if time.Now().After(deadline) {
			t.Fatal("no attachment.history.page was sent")
		}
		time.Sleep(time.Millisecond)
	}
}

// A watcher on a read-only share scrolls back: its wheel never reaches tmux,
// so the console asks for the pane's scrollback instead, and gets one page,
// read with its colours. The regression is a watcher's terminal that does
// not scroll at all.
func TestAReadOnlyAttachmentIsAnsweredWithItsScrollback(t *testing.T) {
	h, sent, terminals := watching(t)
	terminals.scrollback = "\x1b[32mline 1\x1b[0m\nline 2\n"
	terminals.scrolled = make(chan string, 1)

	askHistory(t, h)

	select {
	case asked := <-terminals.scrolled:
		if !strings.HasSuffix(asked, ":0 5000 true") {
			t.Fatalf("tmux was asked for %q, want window 0's 5000 lines with colours", asked)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("tmux was never asked for the scrollback")
	}
	page := firstHistoryPage(t, sent)
	if page.AttachmentID != attachmentUnderTest || page.Text != terminals.scrollback || page.Truncated || page.Failed {
		t.Fatalf("page = %+v", page)
	}
}

// A read tmux refuses is answered as failed, so the console says so instead
// of showing a guest nothing to scroll back through.
func TestAScrollbackReadThatFailsIsSaidToHaveFailed(t *testing.T) {
	h, sent, terminals := watching(t)
	terminals.scrollError = errors.New("no server running")

	askHistory(t, h)

	if page := firstHistoryPage(t, sent); !page.Failed || page.Text != "" {
		t.Fatalf("page = %+v, want failed and empty", page)
	}
}

// A guest asking in a loop gets at most one page a pace: each page rides the
// link ahead of every PTY frame, and the owner's terminals share that link.
func TestScrollbackAsksArePaced(t *testing.T) {
	h, sent, terminals := watching(t)
	terminals.scrollback = "line\n"
	for range 20 {
		askHistory(t, h)
		time.Sleep(10 * time.Millisecond)
	}
	time.Sleep(100 * time.Millisecond)
	if pages := historyPages(sent); len(pages) != 1 {
		t.Fatalf("%d pages sent for 20 asks in 300ms, want 1", len(pages))
	}
}

// A long scrollback keeps its newest lines and starts at a line, so a page
// never opens inside an escape sequence.
func TestAHistoryPageKeepsItsLastWholeLines(t *testing.T) {
	text := "\x1b[31mfirst line\x1b[0m\nsecond\nthird\n"
	// The cut lands in the first line's closing escape: that fragment goes.
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
	line := strings.Repeat("\x1b[32m<a&b>\x1b[0m ", 20) + "\n"
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
