package cli

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/computerpolicy"
	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

const computerCommandID = "44444444-4444-4444-8444-444444444444"

// computerHarness is a handler on a link that is up, whose host has a
// Retina-sized fake screen and its computer setting in a temp dir.
type computerHarness struct {
	h       *linkHandler
	sent    *capturedLink
	policy  computerpolicy.File
	desktop *hostfake.Desktop
}

func newComputerHarness(t *testing.T, desktop *hostfake.Desktop) *computerHarness {
	t.Helper()
	policy := computerpolicy.File{Path: filepath.Join(t.TempDir(), "computer.json")}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{Host: hostapp.New(hostapp.Options{
			Prober: hostfake.New(), ComputerPolicies: policy, Desktop: desktop,
		})},
		identity: pairdomain.Identity{HostID: "host-1", AccountID: "acct"},
		logger:   logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(5 * time.Second) })
	h.Connected(context.Background(), 1)
	return &computerHarness{h: h, sent: sent, policy: policy, desktop: desktop}
}

func retinaScreen() *hostfake.Desktop {
	return &hostfake.Desktop{
		Size:   hostdomain.Screen{Width: 2560, Height: 1600},
		Pixels: image.Pt(5120, 3200),
	}
}

func (c *computerHarness) on(t *testing.T) {
	t.Helper()
	if err := c.policy.Save(hostdomain.ComputerPolicy{Enabled: true}); err != nil {
		t.Fatal(err)
	}
}

func (c *computerHarness) act(t *testing.T, commandID string, fields map[string]any) {
	t.Helper()
	body := map[string]any{"commandId": commandID}
	for key, value := range fields {
		body[key] = value
	}
	c.h.Message(context.Background(), message(t, "computer.act", body))
}

func (c *computerHarness) screen(t *testing.T, commandID string) link.ComputerScreen {
	t.Helper()
	return c.sent.waitFor(t, "computer.screen", func(m any) bool {
		s, ok := m.(link.ComputerScreen)
		return ok && s.CommandID == commandID
	}).(link.ComputerScreen)
}

// screens counts the computer.screen frames sent for commandID.
func (c *computerHarness) screens(commandID string) int {
	c.sent.mu.Lock()
	defer c.sent.mu.Unlock()
	count := 0
	for _, sent := range c.sent.sent {
		if s, ok := sent.(link.ComputerScreen); ok && s.CommandID == commandID {
			count++
		}
	}
	return count
}

// A host nobody set up shows nothing and moves nothing: off is the default,
// so pairing a machine never hands its screen to a bot.
func TestAHostShowsNoScreenUntilItsOwnerTurnsItOn(t *testing.T) {
	c := newComputerHarness(t, retinaScreen())
	c.act(t, computerCommandID, map[string]any{"action": "click", "x": 10, "y": 10})

	failed := c.sent.waitFor(t, "command.failed", isCommandFailed(computerCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrComputerOff.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrComputerOff.Code)
	}
	if acted := c.desktop.Acted(); len(acted) != 0 {
		t.Fatalf("a refused action reached the screen: %+v", acted)
	}
}

// The bot points in the image it was sent, which is smaller than the screen:
// the click lands where it pointed, and the answer is an image of the size
// the next click will be read in.
func TestAClickLandsWhereTheBotPointedOnALargerScreen(t *testing.T) {
	c := newComputerHarness(t, retinaScreen())
	c.on(t)
	c.act(t, computerCommandID, map[string]any{"action": "click", "x": 640, "y": 400})

	answer := c.screen(t, computerCommandID)
	acted := c.desktop.Acted()
	if len(acted) != 1 || acted[0].Action != hostdomain.ComputerClick || acted[0].X != 1281 || acted[0].Y != 801 {
		t.Fatalf("acted = %+v, want one click at (1281, 801)", acted)
	}
	if answer.Width != 1280 || answer.Height != 800 {
		t.Fatalf("answered %d by %d, want 1280 by 800", answer.Width, answer.Height)
	}
	raw, err := base64.StdEncoding.DecodeString(answer.Image)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) > link.ComputerScreenshotMaxBytes {
		t.Fatalf("image is %d bytes, over the %d a frame carries", len(raw), link.ComputerScreenshotMaxBytes)
	}
	shown, err := jpeg.Decode(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	if size := shown.Bounds().Size(); size.X != answer.Width || size.Y != answer.Height {
		t.Fatalf("the image is %v, but the answer says %d by %d", size, answer.Width, answer.Height)
	}
}

// The control plane sends the same command id again when it retries an
// approved call: the click must not happen twice.
func TestARetriedActionIsAnsweredWithoutActingAgain(t *testing.T) {
	c := newComputerHarness(t, retinaScreen())
	c.on(t)
	c.act(t, computerCommandID, map[string]any{"action": "double_click", "x": 5, "y": 5})
	c.screen(t, computerCommandID)
	c.act(t, computerCommandID, map[string]any{"action": "double_click", "x": 5, "y": 5})

	deadline := time.Now().Add(2 * time.Second)
	for c.screens(computerCommandID) < 2 {
		if time.Now().After(deadline) {
			t.Fatal("the retry was not answered")
		}
		time.Sleep(time.Millisecond)
	}
	if acted := c.desktop.Acted(); len(acted) != 1 {
		t.Fatalf("acted %d times, want once", len(acted))
	}
}

// A point outside the image is refused before the mouse moves, and a host
// with no screen says so with its own code, so the bot tells the person what
// to install instead of trying again.
func TestAnActionThatCannotBeDoneIsRefusedWithItsReason(t *testing.T) {
	c := newComputerHarness(t, retinaScreen())
	c.on(t)
	c.act(t, computerCommandID, map[string]any{"action": "click", "x": 1279, "y": 1000})
	failed := c.sent.waitFor(t, "command.failed", isCommandFailed(computerCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrComputerAction.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrComputerAction.Code)
	}
	if acted := c.desktop.Acted(); len(acted) != 0 {
		t.Fatalf("an action outside the screen was done: %+v", acted)
	}

	const other = "55555555-5555-4555-8555-555555555555"
	headless := newComputerHarness(t, &hostfake.Desktop{
		ScreenErr: fmt.Errorf("%w: xdotool not installed", hostdomain.ErrNoScreen),
	})
	headless.on(t)
	headless.act(t, other, map[string]any{"action": "screenshot"})
	failed = headless.sent.waitFor(t, "command.failed", isCommandFailed(other)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrComputerNoScreen.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrComputerNoScreen.Code)
	}
}
