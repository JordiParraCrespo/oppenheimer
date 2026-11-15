package cli

import (
	"context"
	"errors"
	"log/slog"
	"sync"

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
//
// A device.select moves the session onto another device and streams its
// screen on the same attachment: the old screen's pump is stopped and a new
// one started, under the attachment's context.
type deviceAttachment struct {
	id        uint32
	sessionID string
	// life is the attachment's, cancelled when it is dropped.
	life    context.Context
	cancel  context.CancelFunc
	credits chan int

	// switching holds one device.select at a time; stopPump ends the screen
	// being streamed now.
	switching sync.Mutex
	pumpMu    sync.Mutex
	stopPump  context.CancelFunc
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
	att := &deviceAttachment{id: m.AttachmentID, sessionID: m.SessionID, life: ctx, cancel: cancel, credits: make(chan int, 64)}
	h.mu.Lock()
	if !h.linkUp || h.epoch != epoch {
		h.mu.Unlock()
		cancel()
		_ = screen.Close()
		return
	}
	h.screens[att.id] = att
	h.mu.Unlock()

	h.sendDeviceInfo(att, device)
	h.startPump(att, screen)
}

// startPump streams a screen on the attachment in place of the one before.
func (h *linkHandler) startPump(att *deviceAttachment, screen devapp.Screen) {
	ctx, stop := context.WithCancel(att.life)
	att.pumpMu.Lock()
	previous := att.stopPump
	att.stopPump = stop
	att.pumpMu.Unlock()
	if previous != nil {
		previous()
	}
	go h.pumpScreen(ctx, att, screen)
}

// sendDeviceInfo tells the browser which device the attachment shows, and
// which others the session could move to.
func (h *linkHandler) sendDeviceInfo(att *deviceAttachment, device devdomain.Device) {
	choices := h.devices.Choices(att.sessionID)
	if len(choices) > maxDeviceChoices {
		choices = choices[:maxDeviceChoices]
	}
	listed := make([]link.DeviceInfoDevices, 0, len(choices))
	for _, c := range choices {
		listed = append(listed, link.DeviceInfoDevices{
			Serial: c.Serial, Name: c.Name, Platform: string(c.Platform), Free: c.Free,
		})
	}
	_ = h.client.Send(link.DeviceInfo{
		Type: link.TypeDeviceInfo, AttachmentID: att.id,
		Serial: device.Serial, Name: device.Name, Platform: string(device.Platform),
		Devices: listed,
	})
}

// maxDeviceChoices is DEVICE_CHOICES_MAX, the most a device.info may list.
const maxDeviceChoices = 32

// deviceSelect moves the attachment's session onto the device the reader
// picked and streams it in place. A pick that cannot be honoured (another
// session took the device meanwhile) leaves the session where it was, and
// the device.info that answers says so.
func (h *linkHandler) deviceSelect(m link.DeviceSelect) {
	att := h.screenByID(m.AttachmentID)
	if att == nil || h.devices == nil {
		return
	}
	att.switching.Lock()
	defer att.switching.Unlock()
	if att.life.Err() != nil {
		return
	}
	if _, err := h.devices.Choose(att.sessionID, m.Serial); err != nil {
		h.logger.Info("device pick refused", slog.String("session", att.sessionID), slog.String("serial", m.Serial), slog.Any("error", err))
		if current, held := h.devices.Held(att.sessionID); held {
			h.sendDeviceInfo(att, current)
		}
		return
	}
	device, screen, err := h.devices.WatchHeld(att.life, att.sessionID)
	if err != nil {
		h.endScreen(att, err)
		return
	}
	if att.life.Err() != nil {
		_ = screen.Close()
		return
	}
	h.repinDevice(att.sessionID, device)
	h.sendDeviceInfo(att, device)
	h.startPump(att, screen)
}

// repinDevice rewrites the session's note for its agent with the device it
// has now. Its environment keeps the serial it started with.
func (h *linkHandler) repinDevice(sessionID string, device devdomain.Device) {
	if h.app == nil || h.app.Sessions == nil {
		return
	}
	session, err := h.app.Sessions.Get(sessionID)
	if err != nil {
		return
	}
	writeSessionNote(session, h.app.Ports != nil, &device)
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
			// A screen replaced by a device.select ends with its context.
			if ctx.Err() == nil {
				h.endScreen(att, err)
			}
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
