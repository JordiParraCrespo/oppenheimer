package desktop

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// One key name on the wire is two different things to press: an X keysym on
// Linux and a virtual key code on a Mac. A wrong row here presses another key.
func TestAKeyPressIsNamedForEachPlatform(t *testing.T) {
	cases := []struct {
		key     string
		keysym  string
		code    int
		holding []string
	}{
		{"enter", "Return", 36, []string{}},
		{"cmd+shift+4", "super+shift+4", 21, []string{"command down", "shift down"}},
		{"ctrl+c", "ctrl+c", 8, []string{"control down"}},
		{"alt+f4", "alt+F4", 118, []string{"option down"}},
		{"pagedown", "Next", 121, []string{}},
	}
	for _, c := range cases {
		t.Run(c.key, func(t *testing.T) {
			press, err := domain.ParseKeyPress(c.key)
			if err != nil {
				t.Fatal(err)
			}
			if got := xKeysym(press); got != c.keysym {
				t.Fatalf("xKeysym = %q, want %q", got, c.keysym)
			}
			raw, err := macActionJSON(domain.ComputerRequest{Action: domain.ComputerKey, Keys: []string{c.key}})
			if err != nil {
				t.Fatal(err)
			}
			var action macAction
			if err := json.Unmarshal([]byte(raw), &action); err != nil {
				t.Fatal(err)
			}
			if len(action.Presses) != 1 || action.Presses[0].Code != c.code {
				t.Fatalf("mac presses = %+v, want code %d", action.Presses, c.code)
			}
			if got := action.Presses[0].Using; len(got) != len(c.holding) || (len(got) > 0 && got[0] != c.holding[0]) {
				t.Fatalf("mac modifiers = %v, want %v", got, c.holding)
			}
		})
	}
}

// Every key the protocol lets a bot press has a Mac key code: one missing
// would pass validation and then fail on the host, after the approval.
func TestEveryProtocolKeyHasAMacKeyCode(t *testing.T) {
	keys := []string{"enter", "tab", "escape", "backspace", "delete", "space", "up", "down", "left", "right", "home", "end", "pageup", "pagedown"}
	for c := 'a'; c <= 'z'; c++ {
		keys = append(keys, string(c))
	}
	for c := '0'; c <= '9'; c++ {
		keys = append(keys, string(c))
	}
	keys = append(keys, "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12")
	seen := map[int]string{}
	for _, key := range keys {
		code, ok := macKeyCodes[key]
		if !ok {
			t.Errorf("%q has no Mac key code", key)
			continue
		}
		if other, dup := seen[code]; dup {
			t.Errorf("%q and %q share Mac key code %d", key, other, code)
		}
		seen[code] = key
	}
	if _, err := macActionJSON(domain.ComputerRequest{Action: domain.ComputerKey, Keys: []string{"ctrl+banana"}}); !errors.Is(err, domain.ErrComputerKey) {
		t.Fatalf("a key that is not one = %v, want ErrComputerKey", err)
	}
}
