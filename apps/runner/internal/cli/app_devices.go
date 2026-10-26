package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices"
	devapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	devdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// hostDevices is the device context for the simulators and emulators this
// host offers (EnvDevices), or nil when it offers none.
func hostDevices() (*devapp.Service, error) {
	offered, err := devdomain.ParseDevices(os.Getenv(EnvDevices))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", EnvDevices, err)
	}
	return devices.New(devices.Options{
		Devices:         offered,
		SimulatorServer: os.Getenv(EnvArgentSimulatorServer),
		ToolsURL:        os.Getenv(EnvArgentToolsURL),
		ToolsToken:      os.Getenv(EnvArgentToken),
		AndroidHome:     os.Getenv("ANDROID_HOME"),
	}), nil
}

// deviceNote is the file the session's agent reads its device from. Claude
// Code reads CLAUDE.md from every folder above the one it runs in, and the
// session's own folder holds the checkout without being part of it, so the
// note reaches the agent and can never be committed.
const deviceNote = "CLAUDE.md"

// pinDevice gives the session its device, when the host offers one: the
// serial in its environment (adb reads ANDROID_SERIAL), and a note naming it
// beside the checkout, so the agent's Argent calls name this device and no
// other. A host whose devices are all held gives the session none, and the
// console says so when it asks for the screen.
func pinDevice(service *devapp.Service, session sessionsdomain.Session) map[string]string {
	if service == nil {
		return nil
	}
	device, err := service.ForSession(session.ID)
	if err != nil {
		return nil
	}
	env := map[string]string{"OPPENHEIMER_DEVICE": device.Serial}
	if device.Platform == devdomain.Android {
		env["ANDROID_SERIAL"] = device.Serial
	}
	if session.Place != sessionsdomain.PlaceFolder && session.Dir != "" {
		note := fmt.Sprintf(`# This session's device

This session has its own %[1]s: %[2]s. The person reading the session
watches and taps the same device from the console, beside the terminal.

- Pass %[2]s as the udid (or device_id) to every Argent tool. Do not call
  list-devices to pick one, and do not boot, shut down or use any other
  device on this host: other sessions own them.
- Plain adb already targets it (ANDROID_SERIAL).
`, device.Name, device.Serial)
		// Best effort: the device is the session's either way, and the
		// environment still names it.
		_ = os.WriteFile(filepath.Join(session.Dir, deviceNote), []byte(note), 0o600)
	}
	return env
}
