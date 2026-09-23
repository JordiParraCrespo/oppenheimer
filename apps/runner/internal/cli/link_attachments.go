package cli

// The attachments of the link: one PTY per browser connection, opened by
// `session.attach` under the id the control plane allocated, pumped one read
// per frame under that id, paused by the credit window, and closed by
// `session.detach`, by the PTY ending, or by the link going away.

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

func (h *linkHandler) attach(ctx context.Context, m link.SessionAttach) {
	pty, err := h.app.Sessions.Attach(ctx, m.SessionID, m.Window, sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	readCtx, cancel := context.WithCancel(context.Background())
	att := &attachment{id: m.AttachmentID, sessionID: m.SessionID, window: m.Window, pty: pty, cancel: cancel, flow: newFlowWindow()}
	h.mu.Lock()
	if previous, exists := h.attachments[m.AttachmentID]; exists {
		previous.flow.close()
		previous.cancel()
		_ = previous.pty.Close()
	}
	h.attachments[m.AttachmentID] = att
	h.mu.Unlock()
	go h.pump(readCtx, att)
}

// pump is the one goroutine reading an attachment's PTY: one read, one frame.
func (h *linkHandler) pump(ctx context.Context, att *attachment) {
	buf := make([]byte, ptyRead)
	for {
		// Flow control: the read waits while the browser's window is spent,
		// so tmux's own buffer, not this process, holds a runaway pane.
		if !att.flow.acquire(ctx) {
			return
		}
		n, err := att.pty.Read(buf)
		if n > 0 {
			// Counted only once queued: a frame that never left must not hold
			// window the browser can never credit back.
			if sendErr := h.client.SendFrame(ctx, att.id, buf[:n]); sendErr != nil {
				if ctx.Err() != nil {
					return
				}
				break
			}
			att.flow.sent(n)
		}
		if err != nil {
			break
		}
		if ctx.Err() != nil {
			return
		}
	}
	if ctx.Err() != nil {
		return
	}
	// The PTY ended on its own — the window closed, or tmux went — so the id
	// is free and the control plane is told.
	h.mu.Lock()
	if h.attachments[att.id] == att {
		delete(h.attachments, att.id)
	}
	h.mu.Unlock()
	_ = att.pty.Close()
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: att.id, Reason: "pty closed"})
}

// input is the control plane's own path for a window nobody is watching: the
// bytes are typed through tmux. An attached browser's keystrokes never come
// this way — they are binary frames under the attachment id (see Frame).
func (h *linkHandler) input(ctx context.Context, m link.SessionInput) {
	data, err := base64.StdEncoding.DecodeString(m.Data)
	if err != nil || len(data) == 0 {
		return
	}
	if err := h.app.Sessions.Send(ctx, m.SessionID, m.Window, string(data)); err != nil {
		h.fail(m.CommandID, err)
	}
}

func (h *linkHandler) resize(m link.SessionResize) {
	if att := h.attachmentByID(m.AttachmentID); att != nil {
		_ = att.pty.Resize(sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
	}
}

func (h *linkHandler) detach(id uint32) {
	h.mu.Lock()
	att := h.attachments[id]
	delete(h.attachments, id)
	h.mu.Unlock()
	if att != nil {
		att.flow.close()
		att.cancel()
		_ = att.pty.Close()
	}
}

func (h *linkHandler) attachmentByID(id uint32) *attachment {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.attachments[id]
}

// Attachment ids are printed in logs as hex, for a person matching them to
// the control plane's; nothing parses them back.
func (att *attachment) String() string { return fmt.Sprintf("attachment#%08x", att.id) }
