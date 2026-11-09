//go:build darwin

package desktop

import (
	"context"
	"fmt"
	"image"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Desktop = Mac{}

// macPermissions is said with every failure: on a Mac the usual reason is a
// permission the person has not given yet, and macOS reports it in many ways.
const macPermissions = "the runner needs Screen Recording and Accessibility, " +
	"in System Settings > Privacy & Security, and macOS asks for them the first time"

// Mac drives the primary screen of the Mac the runner is logged in on:
// `screencapture` reads it, `osascript` posts the mouse and keyboard events.
type Mac struct{}

// New is the Mac desktop.
func New(Options) app.Desktop { return Mac{} }

// Screen is the primary screen's size in points.
func (Mac) Screen(ctx context.Context) (domain.Screen, error) {
	out, err := run(ctx, nil, "osascript", "-l", "JavaScript", "-e", macScreenScript)
	if err != nil {
		return domain.Screen{}, fmt.Errorf("%w: %v (is someone logged in at this Mac's screen?)", domain.ErrNoScreen, err)
	}
	var width, height int
	if _, err := fmt.Sscanf(strings.TrimSpace(out), "%d %d", &width, &height); err != nil || width <= 0 || height <= 0 {
		return domain.Screen{}, fmt.Errorf("%w: macOS reported no screen size: %q", domain.ErrNoScreen, out)
	}
	return domain.Screen{Width: width, Height: height}, nil
}

// Capture reads the primary screen. Without Screen Recording macOS answers
// with the desktop picture alone, no windows, and no error.
func (Mac) Capture(ctx context.Context) (image.Image, error) {
	shown, err := capturePNG(func(path string) error {
		_, err := run(ctx, nil, "screencapture", "-x", "-m", "-t", "png", path)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("%w; %s", err, macPermissions)
	}
	return shown, nil
}

// Act posts the action's events.
func (Mac) Act(ctx context.Context, req domain.ComputerRequest) error {
	action, err := macActionJSON(req)
	if err != nil {
		return err
	}
	env := []string{macActionVariable + "=" + action}
	if _, err := run(ctx, env, "osascript", "-l", "JavaScript", "-e", macActScript); err != nil {
		return fmt.Errorf("%w; %s", err, macPermissions)
	}
	return nil
}
