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
// screen on the same attachment: the old screen's pump is told it was
// replaced and stops, and a new one starts. Picks run on the attachment's
// lane, behind its input, one at a time.
type deviceAttachment struct {
	id        uint32
	sessionID string
	// life is the attachment's, cancelled when it is dropped.
	life    context.Context
	cancel  context.CancelFunc
	credits chan int

	pumpMu sync.Mutex
	// replaced is closed to stop the screen being streamed now, once a
	// device.select has another to stream in its place.
	replaced chan struct{}
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
	replaced := make(chan struct{})
	att.pumpMu.Lock()
	previous := att.replaced
	att.replaced = replaced
	att.pumpMu.Unlock()
	if previous != nil {
		close(previous)
	}
	go h.pumpScreen(att.life, att, screen, replaced)
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
// the device.info that answers says so. A device that cannot be opened puts
// the session back on the one it had, whose screen is still streaming.
// Every other viewer of the session follows it onto the new device: input
// reaches the session's device, so a screen of the old one would mislead.
func (h *linkHandler) deviceSelect(m link.DeviceSelect) {
	att := h.screenByID(m.AttachmentID)
	if att == nil || h.devices == nil || att.life.Err() != nil {
		return
	}
	previous, hadOne := h.devices.Held(att.sessionID)
	if _, err := h.devices.Choose(att.sessionID, m.Serial); err != nil {
		h.logger.Info("device pick refused", slog.String("session", att.sessionID), slog.String("serial", m.Serial), slog.Any("error", err))
		if hadOne {
			h.sendDeviceInfo(att, previous)
		}
		return
	}
	device, screen, err := h.devices.WatchHeld(att.life, att.sessionID)
	if err != nil {
		h.logger.Warn("picked device could not be opened", slog.String("session", att.sessionID), slog.String("serial", m.Serial), slog.Any("error", err))
		if hadOne {
			if _, back := h.devices.Choose(att.sessionID, previous.Serial); back == nil {
				h.sendDeviceInfo(att, previous)
				return
			}
		}
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
	for _, other := range h.screensOf(att.sessionID) {
		if other != att {
			h.followDevice(other)
		}
	}
}

// followDevice streams the session's device now on another of its
// attachments, after a pick on one of them moved the session.
func (h *linkHandler) followDevice(att *deviceAttachment) {
	device, screen, err := h.devices.WatchHeld(att.life, att.sessionID)
	if err != nil {
		h.endScreen(att, err)
		return
	}
	if att.life.Err() != nil {
		_ = screen.Close()
		return
	}
	h.sendDeviceInfo(att, device)
	h.startPump(att, screen)
}

// screensOf is every attachment watching the session's device.
func (h *linkHandler) screensOf(sessionID string) []*deviceAttachment {
	h.mu.Lock()
	defer h.mu.Unlock()
	var watching []*deviceAttachment
	for _, att := range h.screens {
		if att.sessionID == sessionID {
			watching = append(watching, att)
		}
	}
	return watching
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
// the browser has credit for it, fitted to the width the reader is shown
// (devices.Fit). Only that frame is decoded and scaled: the ones a newer
// frame replaced while the browser drew are dropped as they came.
// It stops when the attachment ends, or quietly when replaced is closed: a
// device.select streams another screen in its place.
func (h *linkHandler) pumpScreen(ctx context.Context, att *deviceAttachment, screen devapp.Screen, replaced <-chan struct{}) {
	// Closing the screen also ends the reader below, blocked in Next.
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
			select {
			case <-latest: // an older frame nobody had credit for
			default:
			}
			latest <- frame
		}
	}()

	unsent := &unsentFrames{logger: h.logger, attachment: att.id}
	window := link.CreditWindow
	for {
		var frame []byte
		select {
		case <-ctx.Done():
			return
		case <-replaced:
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
			case <-replaced:
				return
			case n := <-att.credits:
				window += n
			case newer := <-latest:
				frame = newer
			}
		}
		fitted, err := h.devices.Fit(frame)
		if err != nil {
			unsent.add(len(frame), err)
			continue
		}
		if link.FrameHeader+len(fitted) > link.MaxFrameBytes {
			unsent.add(len(fitted), errFrameTooLarge)
			continue
		}
		if err := h.client.SendFrame(ctx, att.id, fitted); err != nil {
			if ctx.Err() == nil {
				h.endScreen(att, err)
			}
			return
		}
		window -= len(fitted)
	}
}

// errFrameTooLarge is a fitted frame the link cannot carry.
var errFrameTooLarge = errors.New("larger than the link's frame cap")

// unsentFrames counts the frames one attachment could not send and says so
// in the log: the first, then every unsentEvery-th, so a screen that never
// fits is loud without logging each frame.
type unsentFrames struct {
	logger     *slog.Logger
	attachment uint32
	count      int
}

const unsentEvery = 100

func (u *unsentFrames) add(bytes int, err error) {
	u.count++
	if u.count == 1 || u.count%unsentEvery == 0 {
		u.logger.Warn("device frame not sent",
			slog.Uint64("attachment", uint64(u.attachment)), slog.Int("bytes", bytes),
			slog.Int("limit", link.MaxFrameBytes), slog.Int("unsent", u.count), slog.Any("error", err))
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
		Kind: m.Kind, X: m.X, Y: m.Y, ToX: m.ToX, ToY: m.ToY,
		DurationMs: m.DurationMs, Momentum: m.Momentum,
		Text: m.Text, Key: m.Key, Button: m.Button,
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
