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

// attach opens a PTY for the id epoch's link allocated. Opening it runs tmux
// and takes a while, so the link may be gone by the time it is open: an id
// belongs to the link that allocated it — the next may give it to another
// browser — so a PTY opened for a link that is gone is closed, not streamed.
func (h *linkHandler) attach(ctx context.Context, m link.SessionAttach, epoch uint64) {
	readOnly := m.ReadOnly
	pty, err := h.app.Sessions.Attach(ctx, m.SessionID, m.Window, sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)}, readOnly)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	readCtx, cancel := context.WithCancel(context.Background())
	att := &attachment{
		id: m.AttachmentID, sessionID: m.SessionID, window: m.Window, pty: pty, cancel: cancel,
		flow: newFlowWindow(), epoch: epoch, input: make(chan []byte, attachmentInput), readOnly: readOnly,
	}
	h.mu.Lock()
	if !h.linkUp || h.epoch != epoch {
		h.mu.Unlock()
		cancel()
		_ = pty.Close()
		return
	}
	previous := h.attachments[m.AttachmentID]
	h.attachments[m.AttachmentID] = att
	early, hadEarly := h.earlyResize[m.AttachmentID]
	delete(h.earlyResize, m.AttachmentID)
	h.mu.Unlock()
	// The viewport the browser sent while this attachment was still opening.
	if hadEarly {
		_ = pty.Resize(sessionsapp.Size{Cols: clampSize(early.Cols), Rows: clampSize(early.Rows)})
	}
	if previous != nil {
		previous.flow.close()
		previous.cancel()
		_ = previous.pty.Close()
	}
	go h.pump(readCtx, att)
	go h.inputPump(readCtx, att)
}

// inputPump is the one goroutine writing an attachment's keystrokes to its
// PTY. Closing the PTY — detach, the link going, a stalled queue — unblocks
// a write stuck on it, and the attachment's context ends the loop.
func (h *linkHandler) inputPump(ctx context.Context, att *attachment) {
	for {
		select {
		case <-ctx.Done():
			return
		case frame := <-att.input:
			// A PTY that failed a write has ended; its read pump reports it.
			_, _ = att.pty.Write(frame)
		}
	}
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
			// Reserved before the frame is queued: once queued, the writer may
			// send it and the browser's credit may come back before this line
			// would run, and a credit that finds nothing in flight is lost.
			// A frame that never left gives its reservation back.
			att.flow.sent(n)
			if sendErr := h.client.SendFrame(ctx, att.id, buf[:n]); sendErr != nil {
				att.flow.credit(n)
				if ctx.Err() != nil {
					return
				}
				break
			}
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
	// Its context ends with it, or inputPump, waiting on it, never returns.
	att.flow.close()
	att.cancel()
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

// resize sizes an open attachment's PTY, and reports whether there was one.
// holdResize keeps a viewport for an attachment that is still being opened,
// so the attach can apply it as soon as it exists. Only the newest is kept:
// the browser resends on every change, and what the pane needs is the latest.
func (h *linkHandler) holdResize(m link.SessionResize) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, open := h.attachments[m.AttachmentID]; open {
		return
	}
	// Made here rather than only at construction: the handler is also built as
	// a literal in tests, and a viewport dropped on a nil map would be a pane
	// stuck at 80x24 rather than a failure anybody sees.
	if h.earlyResize == nil {
		h.earlyResize = map[uint32]link.SessionResize{}
	}
	h.earlyResize[m.AttachmentID] = m
}

func (h *linkHandler) resize(m link.SessionResize) bool {
	att := h.attachmentByID(m.AttachmentID)
	if att == nil {
		return false
	}
	_ = att.pty.Resize(sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
	return true
}

// release takes att out of the table if it is still there, and reports
// whether it was — so only one caller goes on to close it.
func (h *linkHandler) release(att *attachment) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.attachments[att.id] != att {
		return false
	}
	delete(h.attachments, att.id)
	return true
}

// closeAttachment ends an attachment the host gave up on and tells the
// control plane, which frees the id.
func (h *linkHandler) closeAttachment(att *attachment, reason string) {
	att.flow.close()
	att.cancel()
	_ = att.pty.Close()
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: att.id, Reason: reason})
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
