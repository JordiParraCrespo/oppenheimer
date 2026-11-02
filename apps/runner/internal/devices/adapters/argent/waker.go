package argent

import (
	"context"
	"os/exec"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// ADBWaker keeps an Android device's screen on: a sleeping display sends the
// simulator-server no frames. A simulator needs nothing.
type ADBWaker struct {
	// ADB is the adb binary; empty is "adb" on PATH.
	ADB string
}

var _ app.Waker = ADBWaker{}

// Wake turns the screen on and keeps it on while the device is plugged in,
// which an emulator always is.
func (w ADBWaker) Wake(ctx context.Context, device domain.Device) error {
	if device.Platform != domain.Android {
		return nil
	}
	adb := w.ADB
	if adb == "" {
		adb = "adb"
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	for _, args := range [][]string{
		{"shell", "svc", "power", "stayon", "true"},
		{"shell", "input", "keyevent", "KEYCODE_WAKEUP"},
	} {
		//nolint:gosec // the host's adb, a serial from its own device list, fixed arguments
		if err := exec.CommandContext(ctx, adb, append([]string{"-s", device.Serial}, args...)...).Run(); err != nil {
			return err
		}
	}
	return nil
}
