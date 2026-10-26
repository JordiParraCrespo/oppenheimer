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

// sessionNote is the file the session's agent reads how its session is set
// up from. Claude Code reads CLAUDE.md from every folder above the one it
// runs in, and the session's own folder holds the checkout without being
// part of it, so the note reaches the agent and can never be committed.
const sessionNote = "CLAUDE.md"

// pinDevice gives the session its device, when the host offers one: the
// serial in its environment (adb reads ANDROID_SERIAL). A host whose devices
// are all held gives the session none, and the console says so when it asks
// for the screen.
func pinDevice(service *devapp.Service, session sessionsdomain.Session) (map[string]string, *devdomain.Device) {
	if service == nil {
		return nil, nil
	}
	device, err := service.ForSession(session.ID)
	if err != nil {
		return nil, nil
	}
	env := map[string]string{"OPPENHEIMER_DEVICE": device.Serial}
	if device.Platform == devdomain.Android {
		env["ANDROID_SERIAL"] = device.Serial
	}
	return env, &device
}

// writeSessionNote tells the session's agent what the console shows of its
// work beside the terminal: the ports it listens on, when the host forwards
// them, and its device, when it has one. A folder session gets none: the
// folder is the person's own, and nothing is written into it.
func writeSessionNote(session sessionsdomain.Session, previews bool, device *devdomain.Device) {
	if session.Place == sessionsdomain.PlaceFolder || session.Dir == "" || (!previews && device == nil) {
		return
	}
	note := "# This session\n"
	if previews {
		note += previewNote
	}
	if device != nil {
		note += fmt.Sprintf(deviceNote, device.Name, device.Serial)
	}
	// Best effort: the session works either way, and the environment still
	// names its device.
	_ = os.WriteFile(filepath.Join(session.Dir, sessionNote), []byte(note), 0o600)
}

// previewNote is how a dev server reaches the console's Browser tab
// (product/versions/mvp/28-session-previews.md).
const previewNote = `
## Previewing what you build

The person reading this session sees any port your processes listen on
(1024 and up) in the console's Browser tab. It reaches the port through
this host's runner, from their own browser, wherever they are.

- Start dev servers on localhost (or every address) and leave them running
  in the background, so the preview stays up while you work.
- The server sees requests as from localhost:<port>: you need no allowed
  hosts, public URL or CORS setting for the preview.
- A page cannot call another port directly. In the reader's browser,
  http://localhost:3001 is their own machine, so a front end that calls
  its API that way breaks in the preview. Call the API on the page's own
  origin (fetch("/api/...")) and proxy it in the dev server: Vite's
  server.proxy, Next.js rewrites, the proxy field of Create React App,
  webpack devServer.proxy. Hot reload's websocket works as it is.
`

// deviceNote names the session's device: its name, then its serial.
const deviceNote = `
## This session's device

This session has its own %[1]s: %[2]s. The person reading the session
watches and taps the same device from the console, beside the terminal.

- Pass %[2]s as the udid (or device_id) to every Argent tool. Do not call
  list-devices to pick one, and do not boot, shut down or use any other
  device on this host: other sessions own them.
- Plain adb already targets it (ANDROID_SERIAL).
`
