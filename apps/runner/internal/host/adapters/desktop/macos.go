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

// macActionVariable carries one action to macActScript, as JSON. The
// environment, not an argument: what a bot types may start with a dash.
const macActionVariable = "OPPENHEIMER_COMPUTER_ACTION"

// macScreenScript prints the primary screen's size in points, "W H": the
// units a mouse event is placed in, and the screen `screencapture -m` reads.
const macScreenScript = `ObjC.import('AppKit');
var frame = $.NSScreen.screens.objectAtIndex(0).frame;
Math.round(frame.size.width) + ' ' + Math.round(frame.size.height);`

// macActScript does one action, read from the environment. Mouse events are
// posted through CoreGraphics by number (the bridge names no enum): event
// types 1/2 left down/up, 3/4 right, 25/26 other, 5 moved, 6 left dragged;
// buttons 0 left, 1 right, 2 middle; field 1 the click count; tap 0 the HID
// tap; scroll unit 1 lines. Keys go through System Events. Both need the
// runner to be allowed under Accessibility.
const macActScript = `ObjC.import('CoreGraphics');
ObjC.import('Foundation');
function run() {
  var raw = $.NSProcessInfo.processInfo.environment.objectForKey('` + macActionVariable + `');
  var a = JSON.parse(ObjC.unwrap(raw));
  function mouse(type, x, y, button, clicks) {
    var e = $.CGEventCreateMouseEvent(null, type, $.CGPointMake(x, y), button);
    if (clicks) $.CGEventSetIntegerValueField(e, 1, clicks);
    $.CGEventPost(0, e);
    delay(0.04);
  }
  function click(down, up, button, times) {
    for (var n = 1; n <= times; n++) {
      mouse(down, a.x, a.y, button, n);
      mouse(up, a.x, a.y, button, n);
    }
  }
  if (a.pointed) mouse(5, a.x, a.y, 0);
  switch (a.action) {
    case 'move': break;
    case 'click': click(1, 2, 0, 1); break;
    case 'double_click': click(1, 2, 0, 2); break;
    case 'right_click': click(3, 4, 1, 1); break;
    case 'middle_click': click(25, 26, 2, 1); break;
    case 'drag':
      mouse(1, a.x, a.y, 0, 1);
      for (var step = 1; step <= 10; step++) {
        mouse(6, a.x + (a.toX - a.x) * step / 10, a.y + (a.toY - a.y) * step / 10, 0, 1);
      }
      mouse(2, a.toX, a.toY, 0, 1);
      break;
    case 'scroll':
      $.CGEventPost(0, $.CGEventCreateScrollWheelEvent2(null, 1, 2, -a.scrollY, -a.scrollX, 0));
      break;
    case 'type':
      Application('System Events').keystroke(a.text);
      break;
    case 'key':
      var events = Application('System Events');
      a.presses.forEach(function (press) {
        events.keyCode(press.code, { using: press.using });
        delay(0.05);
      });
      break;
    default:
      throw new Error('unknown action ' + a.action);
  }
}`

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
		return domain.Screen{}, fmt.Errorf("%w: %w (is someone logged in at this Mac's screen?)", domain.ErrNoScreen, err)
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
