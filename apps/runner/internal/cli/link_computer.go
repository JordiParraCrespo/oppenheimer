package cli

// `computer.act`: a bot using this host's screen, mouse and keyboard (25
// §4.2, "Using a computer"), through the host service, which reads this
// host's own setting first. Answered with `computer.screen`, or
// `command.failed` with a COMPUTER_* code.

import (
	"context"
	"encoding/base64"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// laneComputer is the one lane every `computer.act` runs on.
const laneComputer = "computer"

func (h *linkHandler) computerAct(ctx context.Context, m link.ComputerAct) {
	if left, ok := h.shots.get(m.CommandID); ok {
		_ = h.client.Send(left)
		return
	}
	shot, err := h.app.Host.Computer(ctx, hostdomain.ComputerRequest{
		Action: hostdomain.ComputerAction(m.Action),
		X:      m.X, Y: m.Y, ToX: m.ToX, ToY: m.ToY,
		ScrollX: m.ScrollX, ScrollY: m.ScrollY,
		Text: m.Text, Keys: m.Keys,
		Wait:    time.Duration(m.Seconds) * time.Second,
		MaxEdge: link.ComputerScreenMaxEdge, MaxBytes: link.ComputerScreenshotMaxBytes,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	left := link.ComputerScreen{
		Type: link.TypeComputerScreen, CommandID: m.CommandID,
		Image: base64.StdEncoding.EncodeToString(shot.JPEG),
		Width: shot.Width, Height: shot.Height, Display: shot.Display,
	}
	h.shots.put(m.CommandID, left)
	_ = h.client.Send(left)
}
