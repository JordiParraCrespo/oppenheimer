package cli

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/execpolicy"
	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/policyfile"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

type settingsHarness struct {
	h        *linkHandler
	sent     *capturedLink
	browser  policyfile.Browser
	computer policyfile.Computer
	exec     execpolicy.File
}

func newSettingsHarness(t *testing.T) *settingsHarness {
	t.Helper()
	dir := t.TempDir()
	s := &settingsHarness{
		sent:     &capturedLink{},
		browser:  policyfile.Browser{Path: filepath.Join(dir, "browser.json")},
		computer: policyfile.Computer{Path: filepath.Join(dir, "computer.json")},
		exec:     execpolicy.File{Path: filepath.Join(dir, "exec.json")},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	s.h = &linkHandler{
		app: &App{Host: hostapp.New(hostapp.Options{
			Prober: hostfake.New(), BrowserPolicies: s.browser, ComputerPolicies: s.computer,
			ExecPolicies: s.exec,
		})},
		identity: pairdomain.Identity{HostID: "host-1", AccountID: "acct"},
		logger:   logger, client: s.sent, reporter: link.NewReporter("run-test", s.sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { s.h.lanes.close(5 * time.Second) })
	s.h.Connected(context.Background(), 1)
	return s
}

func (s *settingsHarness) set(t *testing.T, commandID string, fields map[string]any) {
	t.Helper()
	body := map[string]any{"commandId": commandID}
	for key, value := range fields {
		body[key] = value
	}
	s.h.Message(context.Background(), message(t, "host.settings.set", body))
}

func isHostSettings(commandID string) func(any) bool {
	return func(sent any) bool {
		settings, ok := sent.(link.HostSettings)
		return ok && settings.CommandID == commandID
	}
}

// When the person asks a bot to turn the browser on, the bot's
// `host.settings.set` writes the same file `runner browser on` does, so the
// next `browser.act` is no longer refused with BROWSER_001. Breaks if the
// link stops writing the host's switches, which is what made a bot answer
// "only you can run `runner browser on`".
func TestABotTurnsOnTheSwitchesThePersonAskedFor(t *testing.T) {
	s := newSettingsHarness(t)
	const id = "77777777-7777-4777-8777-777777777771"
	s.set(t, id, map[string]any{
		"browser": "on", "computer": "on", "execMode": "allowlist", "execAllow": []string{"python3"},
	})

	got := s.sent.waitFor(t, "host.settings", isHostSettings(id)).(link.HostSettings)
	if got.Browser != "on" || got.Computer != "on" || got.ExecMode != "allowlist" ||
		!slices.Equal(got.ExecAllow, []string{"python3"}) {
		t.Fatalf("answered %+v", got)
	}
	if browser, _ := s.browser.Load(); !browser.Enabled {
		t.Fatal("browser.json was not turned on")
	}
	if computer, _ := s.computer.Load(); !computer.Enabled {
		t.Fatal("computer.json was not turned on")
	}
	if exec, _ := s.exec.Load(); exec.Mode != hostdomain.ExecAllowlist || !slices.Equal(exec.Allow, []string{"python3"}) {
		t.Fatalf("exec.json = %+v", exec)
	}
}

// "off" turns a switch off, and a field left out keeps its value: a change
// to the browser never resets the exec policy the person set by hand.
func TestASwitchLeftOutKeepsItsValueAndOffTurnsOneOff(t *testing.T) {
	s := newSettingsHarness(t)
	if err := s.browser.Save(hostdomain.BrowserPolicy{Enabled: true}); err != nil {
		t.Fatal(err)
	}
	if err := s.exec.Save(hostdomain.ExecPolicy{Mode: hostdomain.ExecFull}); err != nil {
		t.Fatal(err)
	}
	const id = "77777777-7777-4777-8777-777777777772"
	s.set(t, id, map[string]any{"browser": "off"})

	got := s.sent.waitFor(t, "host.settings", isHostSettings(id)).(link.HostSettings)
	if got.Browser != "off" || got.ExecMode != "full" {
		t.Fatalf("answered %+v", got)
	}
	if browser, _ := s.browser.Load(); browser.Enabled {
		t.Fatal("browser.json is still on")
	}
}

// A bad allowlist entry changes nothing at all, the switches given beside
// it included: a half-applied change would leave the bot and the person
// reading different settings.
func TestABadAllowlistEntryChangesNothing(t *testing.T) {
	s := newSettingsHarness(t)
	const id = "77777777-7777-4777-8777-777777777773"
	s.set(t, id, map[string]any{"browser": "on", "execAllow": []string{"scripts/run.sh"}})

	failed := s.sent.waitFor(t, "command.failed", isCommandFailed(id)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrExecEntry.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrExecEntry.Code)
	}
	if browser, _ := s.browser.Load(); browser.Enabled {
		t.Fatal("the browser was turned on by a refused change")
	}
}

// An exec policy that cannot be read refuses the whole change before any
// file is written: a browser turned on beside it would be a change the bot
// was told never happened.
func TestAnUnreadableExecPolicyChangesNothingElse(t *testing.T) {
	s := newSettingsHarness(t)
	if err := os.WriteFile(s.exec.Path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	const id = "77777777-7777-4777-8777-777777777774"
	s.set(t, id, map[string]any{"browser": "on", "execMode": "full"})

	failed := s.sent.waitFor(t, "command.failed", isCommandFailed(id)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrExecPolicyFile.Code || !strings.Contains(failed.Detail, "nothing changed") {
		t.Fatalf("failed = %+v", failed)
	}
	if browser, _ := s.browser.Load(); browser.Enabled {
		t.Fatal("the browser was turned on by a change that failed")
	}
}

// An allowlist grown past what the policy file holds is refused before it
// is saved: a file over the bound can no longer be read, which would break
// every later command on the host.
func TestAnAllowlistIsNeverGrownPastWhatItsFileHolds(t *testing.T) {
	s := newSettingsHarness(t)
	long := func(batch, i int) string { return fmt.Sprintf("/opt/%d/%d/%s", batch, i, strings.Repeat("a", 1000)) }
	for batch := 0; ; batch++ {
		entries := make([]string, 32)
		for i := range entries {
			entries[i] = long(batch, i)
		}
		id := fmt.Sprintf("77777777-7777-4777-8777-%012d", 100+batch)
		s.set(t, id, map[string]any{"execMode": "allowlist", "execAllow": entries})
		sent := s.sent.waitFor(t, "an answer", func(sent any) bool {
			return isHostSettings(id)(sent) || isCommandFailed(id)(sent)
		})
		if failed, ok := sent.(link.CommandFailed); ok {
			if failed.Code != hostdomain.ErrExecAllowFull.Code {
				t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrExecAllowFull.Code)
			}
			break
		}
		if batch > 10 {
			t.Fatal("the allowlist kept growing")
		}
	}
	if _, err := s.exec.Load(); err != nil {
		t.Fatalf("the policy file can no longer be read: %v", err)
	}
}
