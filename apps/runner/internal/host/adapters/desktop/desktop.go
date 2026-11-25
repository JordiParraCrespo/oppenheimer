// Package desktop is app.Desktop: the host's screen, mouse and keyboard, for
// a bot's `computer.act`. The runner is built without cgo, so each platform
// is driven through the tools it ships or its package manager has: on a Mac
// `screencapture` and `osascript`, on Linux an X display through `xdotool`
// and ImageMagick's `import` (or `scrot`), with `Xvfb` as the screen of a
// host that has none.
package desktop

import (
	"context"
	"errors"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

// commandTimeout bounds one tool call: a capture or a click that takes
// longer is a screen that is not answering.
const commandTimeout = 20 * time.Second

// Options are what the composition root knows about the machine. They are
// read on Linux only.
type Options struct {
	// Display is the X display the runner was started with ($DISPLAY), "" for
	// none.
	Display string
	// Wayland says this account's desktop session is a Wayland one: its X
	// displays are XWayland's, which show and take nothing of the real
	// desktop.
	Wayland bool
	// Home is the account's home directory, where the X authority file a
	// virtual screen is locked with lives (~/.Xauthority).
	Home string
}

// WaylandSession reports whether the environment the runner was started in,
// or the account's runtime directory, shows a Wayland session. A user
// service often has neither variable, so the session's socket is looked for
// too.
func WaylandSession(sessionType, waylandDisplay, runtimeDir string) bool {
	if sessionType == "wayland" || waylandDisplay != "" {
		return true
	}
	if runtimeDir == "" {
		runtimeDir = fmt.Sprintf("/run/user/%d", os.Getuid())
	}
	sockets, _ := filepath.Glob(filepath.Join(runtimeDir, "wayland-*"))
	return len(sockets) > 0
}

// run runs one tool to completion and answers what it printed. env is added
// to the runner's own environment.
func run(ctx context.Context, env []string, name string, args ...string) (string, error) {
	return runWithin(ctx, commandTimeout, env, name, args...)
}

// runWithin is run with a bound of the caller's: typing a long text takes
// longer than a click.
func runWithin(ctx context.Context, timeout time.Duration, env []string, name string, args ...string) (string, error) {
	spec := execx.Spec{Name: name, Args: args, Timeout: timeout, KillGroup: true}
	if len(env) > 0 {
		spec.Env = append(os.Environ(), env...)
	}
	res, err := execx.Run(ctx, spec)
	if err != nil {
		if said := lastLine(res.Out); said != "" {
			return res.Out, fmt.Errorf("%s: %s", name, said)
		}
		return res.Out, fmt.Errorf("%s: %w", name, execx.Cause(err))
	}
	return res.Out, nil
}

func lastLine(out string) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	return strings.TrimSpace(lines[len(lines)-1])
}

// capturePNG has a tool write the screen to a file as a PNG and reads it
// back: shoot is given the file to write.
func capturePNG(shoot func(path string) error) (image.Image, error) {
	file, err := os.CreateTemp("", "oppenheimer-screen-*.png")
	if err != nil {
		return nil, err
	}
	path := file.Name()
	_ = file.Close()
	defer os.Remove(path) //nolint:errcheck // a leftover temp file is the OS's to clear
	if err := shoot(path); err != nil {
		return nil, err
	}
	written, err := os.Open(path) //nolint:gosec // the file this call made
	if err != nil {
		return nil, err
	}
	defer written.Close() //nolint:errcheck // read only
	shown, err := png.Decode(written)
	if err != nil {
		return nil, errors.New("the capture is not an image")
	}
	return shown, nil
}
