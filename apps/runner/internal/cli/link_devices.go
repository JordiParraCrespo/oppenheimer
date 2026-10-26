package cli

import (
	"context"
	"errors"
	"log/slog"

	devapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	devdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// deviceAttachment is one browser watching a session's device: its screen as
// JPEG frames under the attachment id, its input applied to that device.
//
// Frames are latest-wins. A frame waits for credit, and one that is still
// waiting when the next arrives is dropped for it: a viewer on a slow link
// sees fewer frames, never older ones, and the link never queues a backlog of
// a screen nobody has drawn yet. The credit is bytes, as for a PTY, so the
// browser credits each frame once it has drawn it.
type deviceAttachment struct {
	id        uint32
	sessionID string
	cancel    context.CancelFunc
	credits   chan int
}

func (d *deviceAttachment) credit(bytes int) {
	select {
	case d.credits <- bytes:
	default:
		// The pump is behind on credits it has not read; it has plenty.
	}
}

// deviceAttach opens the session's device for one browser: device.info, then
// frames until the browser detaches, the link drops or the stream ends.
func (h *linkHandler) deviceAttach(m link.DeviceAttach, epoch uint64) {
	if h.devices == nil {
		h.fail(m.CommandID, devdomain.ErrNoDevice)
		return
	}
	ctx, cancel := context.WithCancel(h.life)
	device, screen, err := h.devices.Watch(ctx, m.SessionID)
	if err != nil {
		cancel()
		h.fail(m.CommandID, err)
		return
	}
	att := &deviceAttachment{id: m.AttachmentID, sessionID: m.SessionID, cancel: cancel, credits: make(chan int, 64)}
	h.mu.Lock()
	if !h.linkUp || h.epoch != epoch {
		h.mu.Unlock()
		cancel()
		_ = screen.Close()
		return
	}
	h.screens[att.id] = att
	h.mu.Unlock()

	_ = h.client.Send(link.DeviceInfo{
		Type: link.TypeDeviceInfo, AttachmentID: att.id,
		Serial: device.Serial, Name: device.Name, Platform: string(device.Platform),
	})
	go h.pumpScreen(ctx, att, screen)
}

// pumpScreen reads the device's frames and sends the newest one each time
// the browser has credit for it.
func (h *linkHandler) pumpScreen(ctx context.Context, att *deviceAttachment, screen devapp.Screen) {
	defer func() { _ = screen.Close() }()
	latest := make(chan []byte, 1)
	ended := make(chan error, 1)
	go func() {
		for {
			frame, err := screen.Next(ctx)
			if err != nil {
				ended <- err
				return
			}
			if link.FrameHeader+len(frame) > link.MaxFrameBytes {
				continue // too large for the link: the next one may fit
			}
			select {
			case <-latest: // an older frame nobody had credit for
			default:
			}
			latest <- frame
		}
	}()

	window := link.CreditWindow
	for {
		var frame []byte
		select {
		case <-ctx.Done():
			return
		case err := <-ended:
			h.endScreen(att, err)
			return
		case n := <-att.credits:
			window += n
			continue
		case frame = <-latest:
		}
		for window <= 0 {
			select {
			case <-ctx.Done():
				return
			case n := <-att.credits:
				window += n
			case newer := <-latest:
				frame = newer
			}
		}
		if err := h.client.SendFrame(ctx, att.id, frame); err != nil {
			if ctx.Err() == nil {
				h.endScreen(att, err)
			}
			return
		}
		window -= len(frame)
	}
}

// endScreen closes an attachment whose stream ended on the host's side.
func (h *linkHandler) endScreen(att *deviceAttachment, err error) {
	if !h.dropScreen(att.id) {
		return
	}
	reason := "device stream ended"
	if err != nil && !errors.Is(err, context.Canceled) {
		h.logger.Warn("device stream ended", slog.Uint64("attachment", uint64(att.id)), slog.Any("error", err))
	}
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: att.id, Reason: reason})
}

// dropScreen forgets and stops an attachment, and reports whether it was open.
func (h *linkHandler) dropScreen(id uint32) bool {
	h.mu.Lock()
	att, ok := h.screens[id]
	delete(h.screens, id)
	h.mu.Unlock()
	if ok {
		att.cancel()
	}
	return ok
}

func (h *linkHandler) screenByID(id uint32) *deviceAttachment {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.screens[id]
}

// deviceInput applies the browser's input to the device of the session the
// attachment is for: the session, not the message, names the device.
func (h *linkHandler) deviceInput(m link.DeviceInput) {
	att := h.screenByID(m.AttachmentID)
	if att == nil || h.devices == nil {
		return
	}
	err := h.devices.Input(h.life, att.sessionID, devdomain.Input{
		Kind: m.Kind, X: m.X, Y: m.Y, ToX: m.ToX, ToY: m.ToY, Text: m.Text, Key: m.Key, Button: m.Button,
	})
	if err != nil {
		h.logger.Warn("device input failed", slog.String("session", att.sessionID), slog.String("kind", m.Kind), slog.Any("error", err))
	}
}

// stopScreens ends every device attachment: the link they streamed on is gone.
func (h *linkHandler) stopScreens(open map[uint32]*deviceAttachment) {
	for _, att := range open {
		att.cancel()
	}
}
