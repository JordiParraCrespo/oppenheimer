package cli

// `terminal.drive`: a bot typing into a blank-terminal session and reading
// its screen back (25 §4.2, "Driving a terminal"). The host's exec policy
// decides first: a shell runs anything, so only `full` lets a bot drive one.
// Answered with `terminal.screen`, or `command.failed`.

import (
	"context"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// laneTerminal is one lane per session: drives of one terminal in order, and
// a retried drive (the same command id) behind the one it repeats.
const laneTerminal = "terminal:"

func (h *linkHandler) driveTerminal(ctx context.Context, m link.TerminalDrive) {
	if left, ok := h.drives.get(m.CommandID); ok {
		_ = h.client.Send(left)
		return
	}
	policy, err := h.app.Host.ExecPolicy()
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	if policy.Mode != hostdomain.ExecFull {
		h.fail(m.CommandID, hostdomain.ErrTerminalNeedsFull.WithDetail(
			"this host's exec mode is %s; the person on this host can allow it with `runner exec mode full`", policy.Mode))
		return
	}
	result, err := h.app.Sessions.Drive(ctx, m.SessionID, sessionsapp.DriveRequest{
		Window: m.Window, Text: m.Text, Keys: m.Keys, WaitFor: m.WaitFor,
		Wait: time.Duration(m.WaitSeconds) * time.Second, History: m.History,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	screen := result.Screen
	if len(screen) > link.TerminalScreenMaxBytes {
		screen = screen[len(screen)-link.TerminalScreenMaxBytes:]
	}
	left := link.TerminalScreen{
		Type: link.TypeTerminalScreen, CommandID: m.CommandID,
		Screen: screen, Matched: result.Matched, WaitedMs: result.Waited.Milliseconds(),
	}
	h.drives.put(m.CommandID, left)
	_ = h.client.Send(left)
}
