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
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

// commandTimeout bounds one tool call: a capture or a click that takes
// longer is a screen that is not answering.
const commandTimeout = 20 * time.Second

// Options are what the composition root knows about the machine.
type Options struct {
	// Display is the X display the runner was started with ($DISPLAY), "" for
	// none. Read on Linux only.
	Display string
}

// run runs one tool to completion and answers what it printed. env is added
// to the runner's own environment.
func run(ctx context.Context, env []string, name string, args ...string) (string, error) {
	spec := execx.Spec{Name: name, Args: args, Timeout: commandTimeout, KillGroup: true}
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
