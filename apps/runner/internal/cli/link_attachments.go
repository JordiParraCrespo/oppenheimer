package cli

// The attachments of the link: one PTY per browser connection, opened by
// `session.attach` under the id the control plane allocated, pumped one read
// per frame under that id, paused by the credit window, and closed by
// `session.detach`, by the PTY ending, or by the link going away.

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

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
		history: make(chan int, 1),
	}
	if m.ChatTail {
		// The console can ask for older turns, so the chat goes tail first.
		att.chatOlder = make(chan int64, 1)
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
		previous.stop()
	}
	go h.pump(readCtx, att)
	go h.inputPump(readCtx, att)
	go h.chat(readCtx, att)
	go h.history(readCtx, att)
}

// historyWait bounds one scrollback read: tmux answers in milliseconds, and
// a stuck one must not hold the next ask.
const historyWait = 10 * time.Second

// history answers the attachment's `attachment.history` asks while it is
// open, one at a time, each with one `attachment.history.page`. A read that
// fails answers with an empty page, so the console stops waiting.
func (h *linkHandler) history(ctx context.Context, att *attachment) {
	for {
		select {
		case <-ctx.Done():
			return
		case lines := <-att.history:
			readCtx, cancel := context.WithTimeout(ctx, historyWait)
			text, err := h.app.Sessions.Scrollback(readCtx, att.sessionID, att.window, lines)
			cancel()
			if err != nil {
				h.logger.Debug("could not read the session's scrollback", slog.String("session", att.sessionID), slog.Any("error", err))
				text = ""
			}
			if ctx.Err() != nil {
				return
			}
			page, truncated := historyTail(text, link.AttachmentHistoryMaxBytes)
			_ = h.client.Send(link.AttachmentHistoryPage{
				Type: link.TypeAttachmentHistoryPage, AttachmentID: att.id, Text: page, Truncated: truncated,
			})
		}
	}
}

// historyTail keeps the newest whole lines of text whose JSON encoding fits
// max bytes, so the page and its envelope fit one frame: a control byte (the
// escape every colour starts with) goes out as six. A page never opens
// mid-line or mid-escape. It reports whether it cut.
func historyTail(text string, max int) (string, bool) {
	size := 0
	start := len(text)
	for start > 0 {
		from := strings.LastIndexByte(text[:start-1], '\n') + 1
		line := jsonSize(text[from:start])
		if size+line > max {
			return text[start:], true
		}
		size += line
		start = from
	}
	return text, false
}

// jsonSize is how many bytes s takes as a JSON string's contents, the way
// encoding/json writes it: control bytes, quotes, backslashes and the HTML
// characters escaped.
func jsonSize(s string) int {
	size := 0
	for i := 0; i < len(s); i++ {
		switch c := s[i]; {
		case c == '\n' || c == '\r' || c == '\t' || c == '"' || c == '\\':
			size += 2
		case c < 0x20 || c == '<' || c == '>' || c == '&':
			size += 6
		default:
			size++
		}
	}
	return size
}

// chat follows the attached session's conversation for the console's chat
// view while the attachment is open, as `attachment.chat`. It rides the
// control queue, so a full one holds the batch for the next check rather
// than dropping it. An agent with no transcript to follow sends nothing.
func (h *linkHandler) chat(ctx context.Context, att *attachment) {
	err := h.app.Conversations.FollowChat(ctx, att.sessionID, link.ChatEntryMaxBytes, link.ChatBatchMaxEntries, link.ChatCommandsMax, att.chatOlder, func(batch sessionsapp.ChatBatch) error {
		return h.client.Send(attachmentChat(att.id, batch))
	})
	if err != nil && !errors.Is(err, sessionsapp.ErrNoChat) {
		h.logger.Debug("could not follow the session's transcript", slog.String("session", att.sessionID), slog.Any("error", err))
	}
}

// attachmentChat is one batch on the wire. Its entries are always a list:
// the follower's first word on a conversation with nothing written yet is a
// reset with no entries, and a nil slice would go as `null`, which the
// control plane refuses, so the console would never learn the chat is there
// and would show the terminal until the agent's first line.
func attachmentChat(id uint32, batch sessionsapp.ChatBatch) link.AttachmentChat {
	entries := batch.Entries
	if entries == nil {
		entries = []string{}
	}
	var commands []link.AttachmentChatCommands
	for _, command := range batch.Commands {
		commands = append(commands, link.AttachmentChatCommands{
			Name: command.Name, Kind: string(command.Kind), Description: command.Description,
		})
	}
	return link.AttachmentChat{
		Type: link.TypeAttachmentChat, AttachmentID: id, Reset: batch.Reset, History: batch.History,
		Before: batch.Before, Older: batch.Older, Entries: entries, Commands: commands,
	}
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
			if sendErr := h.sendOutput(ctx, att, buf[:n]); sendErr != nil {
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
	att.stop()
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
	att.stop()
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: att.id, Reason: reason})
}

func (h *linkHandler) detach(id uint32) {
	h.mu.Lock()
	att := h.attachments[id]
	delete(h.attachments, id)
	h.mu.Unlock()
	if att != nil {
		att.stop()
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
