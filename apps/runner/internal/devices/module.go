// Package devices wires a session's device: the simulators and emulators this
// host offers, one per session, reached through Argent.
package devices

import (
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/adapters/argent"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// Options are the host's devices and where Argent is.
type Options struct {
	Devices []domain.Device
	// SimulatorServer is Argent's simulator-server binary.
	SimulatorServer string
	// ToolsURL and ToolsToken reach Argent's tool-server.
	ToolsURL, ToolsToken string
	// AndroidHome is the Android SDK, when it is not on the runner's PATH.
	AndroidHome string
}

// New builds the context, or nil when the host offers no device.
func New(opts Options) *app.Service {
	if len(opts.Devices) == 0 {
		return nil
	}
	adb := ""
	if opts.AndroidHome != "" {
		adb = filepath.Join(opts.AndroidHome, "platform-tools", "adb")
	}
	return app.New(app.Options{
		Devices:  opts.Devices,
		Screens:  argent.NewScreens(argent.ScreensOptions{Binary: opts.SimulatorServer, AndroidHome: opts.AndroidHome}),
		Controls: argent.NewControls(argent.ControlsOptions{URL: opts.ToolsURL, Token: opts.ToolsToken}),
		Waker:    argent.ADBWaker{ADB: adb},
	})
}
