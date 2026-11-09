package desktop

import (
	"encoding/json"
	"fmt"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

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

// macModifiers are the protocol's modifiers as System Events names them.
var macModifiers = map[string]string{
	"ctrl": "control down", "alt": "option down", "shift": "shift down", "cmd": "command down",
}

// macKeyCodes are the virtual key codes of an ANSI keyboard
// (Carbon's kVK_* constants), by the protocol's key names.
var macKeyCodes = map[string]int{
	"a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11,
	"q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21,
	"6": 22, "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "o": 31, "u": 32, "i": 34, "p": 35,
	"l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
	"enter": 36, "tab": 48, "space": 49, "backspace": 51, "escape": 53, "delete": 117,
	"home": 115, "end": 119, "pageup": 116, "pagedown": 121,
	"left": 123, "right": 124, "down": 125, "up": 126,
	"f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98, "f8": 100,
	"f9": 101, "f10": 109, "f11": 103, "f12": 111,
}

type macPress struct {
	Code  int      `json:"code"`
	Using []string `json:"using"`
}

type macAction struct {
	Action  string     `json:"action"`
	Pointed bool       `json:"pointed"`
	X       int        `json:"x"`
	Y       int        `json:"y"`
	ToX     int        `json:"toX"`
	ToY     int        `json:"toY"`
	ScrollX int        `json:"scrollX"`
	ScrollY int        `json:"scrollY"`
	Text    string     `json:"text,omitempty"`
	Presses []macPress `json:"presses,omitempty"`
}

// macActionJSON is req as macActScript reads it: its keys already virtual
// key codes with the modifiers System Events takes.
func macActionJSON(req domain.ComputerRequest) (string, error) {
	action := macAction{
		Action: string(req.Action), Pointed: req.Action.Pointed(),
		X: req.X, Y: req.Y, ToX: req.ToX, ToY: req.ToY,
		ScrollX: req.ScrollX, ScrollY: req.ScrollY, Text: req.Text,
	}
	for _, key := range req.Keys {
		press, err := domain.ParseKeyPress(key)
		if err != nil {
			return "", err
		}
		code, ok := macKeyCodes[press.Key]
		if !ok {
			return "", fmt.Errorf("%w: %q has no key code", domain.ErrComputerKey, press.Key)
		}
		using := make([]string, 0, len(press.Modifiers))
		for _, modifier := range press.Modifiers {
			using = append(using, macModifiers[modifier])
		}
		action.Presses = append(action.Presses, macPress{Code: code, Using: using})
	}
	raw, err := json.Marshal(action)
	return string(raw), err
}
