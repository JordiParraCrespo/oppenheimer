package cli

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	devapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	devdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

const devicesSession = "5b1c2d3e-4f50-4a61-8b72-9c83d4e5f601"

// stillScreen streams one frame naming its device, then waits to be closed.
type stillScreen struct {
	serial string
	sent   bool
	closed chan struct{}
	once   sync.Once
}

func (s *stillScreen) Next(ctx context.Context) ([]byte, error) {
	if !s.sent {
		s.sent = true
		return []byte(s.serial), nil
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-s.closed:
		return nil, errors.New("closed")
	}
}

func (s *stillScreen) Close() error {
	s.once.Do(func() { close(s.closed) })
	return nil
}

// hostScreens opens any device but the broken ones.
type hostScreens struct{ broken map[string]bool }

func (h hostScreens) Open(_ context.Context, device devdomain.Device) (devapp.Screen, error) {
	if h.broken[device.Serial] {
		return nil, errors.New("simulator-server exited")
	}
	return &stillScreen{serial: device.Serial, closed: make(chan struct{})}, nil
}

func devicesHandler(t *testing.T, broken map[string]bool) (*linkHandler, *capturedLink) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{}, logger: logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
		devices: devapp.New(devapp.Options{
			Devices: []devdomain.Device{
				{Serial: "UDID-1", Name: "iPhone 17 Pro", Platform: devdomain.IOS},
				{Serial: "UDID-2", Name: "iPad Air", Platform: devdomain.IOS},
			},
			Screens: hostScreens{broken: broken},
		}),
		screens: map[uint32]*deviceAttachment{},
	}
	t.Cleanup(func() { h.lanes.close(time.Second) })
	h.Connected(context.Background(), 1)
	return h, sent
}

// lastInfo is the newest device.info sent for the attachment.
func lastInfo(t *testing.T, sent *capturedLink, attachmentID uint32, serial string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		sent.mu.Lock()
		var newest string
		for _, message := range sent.sent {
			if info, ok := message.(link.DeviceInfo); ok && info.AttachmentID == attachmentID {
				newest = info.Serial
			}
		}
		sent.mu.Unlock()
		if newest == serial {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("attachment %d shows %q, want %q", attachmentID, newest, serial)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// Two viewers of one session: a pick on one moves the session, and the other
// follows onto the new device rather than showing the old one while its taps
// reach the new one.
func TestAPickMovesEveryViewerOfTheSession(t *testing.T) {
	h, sent := devicesHandler(t, nil)
	for _, id := range []uint32{1, 2} {
		h.deviceAttach(link.DeviceAttach{Type: link.TypeDeviceAttach, CommandID: "c", SessionID: devicesSession, AttachmentID: id}, h.currentEpoch())
		lastInfo(t, sent, id, "UDID-1")
	}

	h.deviceSelect(link.DeviceSelect{Type: link.TypeDeviceSelect, AttachmentID: 1, Serial: "UDID-2"})
	lastInfo(t, sent, 1, "UDID-2")
	lastInfo(t, sent, 2, "UDID-2")
	if held, _ := h.devices.Held(devicesSession); held.Serial != "UDID-2" {
		t.Fatalf("the session holds %q after the pick", held.Serial)
	}
}

// A picked device that cannot be opened puts the session back on the one it
// had, and the viewer keeps watching it rather than the tab ending.
func TestAPickThatCannotOpenKeepsTheOldDevice(t *testing.T) {
	h, sent := devicesHandler(t, map[string]bool{"UDID-2": true})
	h.deviceAttach(link.DeviceAttach{Type: link.TypeDeviceAttach, CommandID: "c", SessionID: devicesSession, AttachmentID: 1}, h.currentEpoch())
	lastInfo(t, sent, 1, "UDID-1")

	h.deviceSelect(link.DeviceSelect{Type: link.TypeDeviceSelect, AttachmentID: 1, Serial: "UDID-2"})
	if held, _ := h.devices.Held(devicesSession); held.Serial != "UDID-1" {
		t.Fatalf("the session holds %q after a pick that failed", held.Serial)
	}
	if h.screenByID(1) == nil {
		t.Fatal("a failed pick ended the viewer's attachment")
	}
	for _, message := range sent.sent {
		if closed, ok := message.(link.AttachmentClosed); ok {
			t.Fatalf("a failed pick closed the attachment: %+v", closed)
		}
	}
	lastInfo(t, sent, 1, "UDID-1")
}
