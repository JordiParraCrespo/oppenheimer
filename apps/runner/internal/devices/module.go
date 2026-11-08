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
	// Discover offers the simulators and emulators running on the host,
	// found whenever a session asks for one. It is the one switch for
	// looking: Devices, when named, are offered as well.
	Discover bool
	// ArgentHome is Argent's own directory (~/.argent), where the
	// tool-server is found when ToolsURL is empty.
	ArgentHome string
}

// New builds the context, or nil when the host offers no device: none
// named and no discovery, or no simulator-server to stream one with.
func New(opts Options) *app.Service {
	if opts.SimulatorServer == "" || (len(opts.Devices) == 0 && !opts.Discover) {
		return nil
	}
	adb := ""
	if opts.AndroidHome != "" {
		adb = filepath.Join(opts.AndroidHome, "platform-tools", "adb")
	}
	var finder app.Finder
	if opts.Discover {
		finder = argent.Finder{ADB: adb}
	}
	return app.New(app.Options{
		Devices: opts.Devices,
		Screens: argent.NewScreens(argent.ScreensOptions{Binary: opts.SimulatorServer, AndroidHome: opts.AndroidHome}),
		Controls: argent.NewControls(argent.ControlsOptions{
			URL: opts.ToolsURL, Token: opts.ToolsToken, Home: opts.ArgentHome,
		}),
		Waker:  argent.ADBWaker{ADB: adb},
		Finder: finder,
	})
}
