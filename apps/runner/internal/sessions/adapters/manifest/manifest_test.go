package manifest_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A manifest is data that will one day arrive from the control plane, so
// everything that can be wrong with one is wrong at load: a bad file must be
// skipped with a reason, never accepted and never fatal.

func manifestJSON(t *testing.T, body string) []byte {
	t.Helper()
	return []byte(`{"schema":"oppenheimer.manifest/v1","agent":"claude","version":"1","minEngine":1,` + body + `}`)
}

func TestParseRejectsWhatCannotBeEvaluated(t *testing.T) {
	for name, tc := range map[string]struct {
		raw  []byte
		want error
	}{
		"unknown schema": {
			[]byte(`{"schema":"oppenheimer.manifest/v2","agent":"claude","rules":[]}`), manifest.ErrSchema,
		},
		"needs a newer engine": {
			[]byte(`{"schema":"oppenheimer.manifest/v1","agent":"claude","minEngine":99,"rules":[]}`), manifest.ErrNewer,
		},
		"no agent": {
			[]byte(`{"schema":"oppenheimer.manifest/v1","rules":[]}`), manifest.ErrAgent,
		},
		"no rules": {
			manifestJSON(t, `"rules":[]`), manifest.ErrRules,
		},
		"duplicate rule id": {
			manifestJSON(t, `"rules":[
				{"id":"a","state":"idle","priority":1,"region":"screen","any":["x"]},
				{"id":"a","state":"idle","priority":2,"region":"screen","any":["y"]}]`), manifest.ErrRuleID,
		},
		"a state the runner does not have": {
			manifestJSON(t, `"rules":[{"id":"a","state":"on fire","priority":1,"region":"screen","any":["x"]}]`), manifest.ErrState,
		},
		"a lifecycle state a screen cannot decide": {
			manifestJSON(t, `"rules":[{"id":"a","state":"closed","priority":1,"region":"screen","any":["x"]}]`), manifest.ErrState,
		},
		"unknown region": {
			manifestJSON(t, `"rules":[{"id":"a","state":"idle","priority":1,"region":"middle","any":["x"]}]`), manifest.ErrRegion,
		},
		"region without its count": {
			manifestJSON(t, `"rules":[{"id":"a","state":"idle","priority":1,"region":"bottom","any":["x"]}]`), manifest.ErrRegion,
		},
		"no patterns": {
			manifestJSON(t, `"rules":[{"id":"a","state":"idle","priority":1,"region":"screen","any":[]}]`), manifest.ErrPattern,
		},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := manifest.Parse(tc.raw)
			if !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestParseRejectsAPatternThatDoesNotCompile(t *testing.T) {
	_, err := manifest.Parse(manifestJSON(t, `"rules":[{"id":"a","state":"idle","priority":1,"region":"screen","any":["("]}]`))

	if err == nil || !strings.Contains(err.Error(), "pattern") {
		t.Fatalf("err = %v, want the broken pattern named", err)
	}
}

func classifier(t *testing.T, dir string) *manifest.Classifier {
	t.Helper()
	return manifest.New(manifest.Options{Dir: dir})
}

func TestTheTitleOutranksTheScreen(t *testing.T) {
	c := classifier(t, "")

	// The screen still shows the spinner frame; the title says the turn
	// stopped to ask. The title is the one the agent controls.
	state, _ := c.Classify(app.Screen{
		Body:  "⠹ Editing src/main.go… (18s · esc to interrupt)",
		Title: "claude — waiting for input",
	}, domain.AgentClaude)

	if state != domain.StateBlocked {
		t.Fatalf("state = %q, want blocked", state)
	}
}

func TestAQuestionUnderASpinnerWins(t *testing.T) {
	c := classifier(t, "")

	state, _ := c.Classify(app.Screen{
		Body: "⠹ Editing src/main.go… (18s · esc to interrupt)\n\nDo you want to proceed?\n  1. Yes\n  2. No\n",
	}, domain.AgentClaude)

	if state != domain.StateBlocked {
		t.Fatalf("state = %q, want blocked: reporting 'working' here is how a person misses a stuck agent", state)
	}
}

func TestAnAgentWithNoManifestIsUnknownNotGuessed(t *testing.T) {
	c := classifier(t, "")

	state, _ := c.Classify(app.Screen{Body: "⠹ Thinking… (2s)"}, domain.Agent("some-new-agent"))

	if state != domain.StateUnknown {
		t.Fatalf("state = %q, want unknown", state)
	}
}

func TestRegionsReadTheRightPartOfTheScreen(t *testing.T) {
	c := classifier(t, "")
	// A question that scrolled away is not what the session is doing now.
	scrolledAway := "Do you want to proceed?\n" + strings.Repeat("build output\n", 40) +
		"⠹ Working… (3s · esc to interrupt)"

	state, _ := c.Classify(app.Screen{Body: scrolledAway}, domain.AgentClaude)

	if state != domain.StateWorking {
		t.Fatalf("state = %q, want working", state)
	}
}

func TestTrailingBlankLinesDoNotPushTheStateOutOfTheWindow(t *testing.T) {
	c := classifier(t, "")

	state, _ := c.Classify(app.Screen{Body: "⠹ Thinking… (2s · esc to interrupt)\n\n\n\n\n\n\n\n"}, domain.AgentClaude)

	if state != domain.StateWorking {
		t.Fatalf("state = %q, want working", state)
	}
}

func TestADirectoryManifestOverridesTheBundledOne(t *testing.T) {
	// This is how the control plane ships a fix for an agent's new spinner
	// without a runner release.
	dir := t.TempDir()
	newer := manifestJSON(t, `"rules":[{"id":"new-spinner","state":"working","priority":900,"region":"screen","any":["◐◓◑◒"]}]`)
	if err := os.WriteFile(filepath.Join(dir, "claude.json"), newer, 0o600); err != nil {
		t.Fatal(err)
	}
	c := classifier(t, dir)

	state, _ := c.Classify(app.Screen{Body: "◐◓◑◒ doing something new"}, domain.AgentClaude)
	if state != domain.StateWorking {
		t.Fatalf("state = %q, want the newer rules in force", state)
	}
	// And the bundled rules it replaced are gone, not merged: a manifest is
	// a whole description of an agent, not a patch on one.
	if state, _ := c.Classify(app.Screen{Body: "⠹ Thinking… (2s · esc to interrupt)"}, domain.AgentClaude); state != domain.StateUnknown {
		t.Fatalf("state = %q, want the replaced rules gone", state)
	}
	loaded, ok := c.Manifest(domain.AgentClaude)
	if !ok || loaded.Rules[0].ID != "new-spinner" {
		t.Fatalf("loaded = %+v", loaded)
	}
}

func TestABadFileIsSkippedAndTheRestStillWork(t *testing.T) {
	dir := t.TempDir()
	for name, body := range map[string]string{
		"claude.json": `{ this is not json`,
		"notes.txt":   `ignored, not a manifest`,
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	c := classifier(t, dir)

	// The broken override is ignored and the bundled rules stay in force —
	// one bad file must not stop a host classifying its sessions.
	state, _ := c.Classify(app.Screen{Body: "⠹ Thinking… (2s · esc to interrupt)"}, domain.AgentClaude)
	if state != domain.StateWorking {
		t.Fatalf("state = %q, want the bundled rules still working", state)
	}
}

func TestAMissingDirectoryIsTheNormalCase(t *testing.T) {
	c := classifier(t, filepath.Join(t.TempDir(), "never-created"))

	if _, ok := c.Manifest(domain.AgentClaude); !ok {
		t.Fatal("a host with no overrides still has the bundled manifests")
	}
}

// The bundled files are data, and data gets edited by people. These keep them
// honest before a release rather than on a host.

func TestBundledManifestsLoad(t *testing.T) {
	manifests, err := manifest.Bundled()
	if err != nil {
		t.Fatalf("a bundled manifest does not parse: %v", err)
	}
	if len(manifests) < 3 {
		t.Fatalf("expected a manifest per agent, got %d", len(manifests))
	}
	agents := map[domain.Agent]bool{}
	for _, m := range manifests {
		agents[m.Agent] = true
		if m.Version == "" {
			t.Errorf("%s has no version; a manifest that cannot be compared cannot be shipped", m.Agent)
		}
		if m.Notes == "" {
			t.Errorf("%s has no notes; the next person editing it needs to know what the screen looks like", m.Agent)
		}
		for _, rule := range m.Rules {
			if rule.Note == "" {
				t.Errorf("%s/%s has no note: a regex with no reason is unmaintainable", m.Agent, rule.ID)
			}
			if rule.Priority <= 0 {
				t.Errorf("%s/%s has priority %d", m.Agent, rule.ID, rule.Priority)
			}
		}
	}
	for _, agent := range []domain.Agent{domain.AgentClaude, domain.AgentCodex, domain.AgentOpenCode, domain.AgentGrok, domain.AgentShell} {
		if !agents[agent] {
			t.Errorf("no bundled manifest for %q, which the runner can start", agent)
		}
	}
}

func TestBundledManifestsAreValidJSONWithNoStrayFields(t *testing.T) {
	manifests, err := manifest.Bundled()
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range manifests {
		raw, err := json.Marshal(m)
		if err != nil {
			t.Fatalf("%s: %v", m.Agent, err)
		}
		if !strings.Contains(string(raw), manifest.Schema) {
			t.Fatalf("%s round-trips without its schema", m.Agent)
		}
	}
}

// The login allowlist is code rather than manifest data, because what the
// console may turn into a clickable link must never arrive over the network.
// It is generated per agent from the catalog, so each agent offers only its
// own vendors' logins.

func TestOnlyVendorLoginHostsAreOffered(t *testing.T) {
	opencode := domain.AgentOpenCode.LoginTargets()
	for _, screen := range []string{
		"Fix the bug described at https://evil.example/claude.ai/oauth",
		"curl https://claude.ai.attacker.test/oauth",
		"See https://github.com/some/repo/blob/main/README.md",
		"https://github.com/login/devicefoo",
		"http://claude.ai/oauth/authorize",
	} {
		if url := manifest.LoginURL(screen, opencode); url != "" {
			t.Fatalf("LoginURL(%q) = %q, want nothing", screen, url)
		}
	}
	for _, screen := range []string{
		"Open https://claude.ai/oauth/authorize?code=true to log in",
		"go to https://github.com/login/device and enter ABCD-1234",
		"sign in at https://opencode.ai/auth",
	} {
		if manifest.LoginURL(screen, opencode) == "" {
			t.Fatalf("a real vendor login URL must be offered: %q", screen)
		}
	}
	grok := domain.AgentGrok.LoginTargets()
	if manifest.LoginURL("Open https://accounts.x.ai/sign-in?redirect=grok-build to sign in", grok) == "" {
		t.Fatal("grok's own sign-in URL must be offered")
	}
	if url := manifest.LoginURL("Open https://claude.ai/oauth/authorize to log in", grok); url != "" {
		t.Fatalf("another vendor's login on grok's screen = %q, want nothing", url)
	}
}

func TestEachAgentOffersOnlyItsOwnVendors(t *testing.T) {
	openai := "Sign in: https://auth.openai.com/authorize?x=1"
	if manifest.LoginURL(openai, domain.AgentClaude.LoginTargets()) != "" {
		t.Fatal("Claude Code offered OpenAI's login")
	}
	if manifest.LoginURL(openai, domain.AgentCodex.LoginTargets()) == "" {
		t.Fatal("Codex did not offer its own login")
	}
}

func TestABlankTerminalNeverReportsALogin(t *testing.T) {
	// Somebody running `claude` by hand in a blank terminal prints a real
	// vendor URL. The session is a shell, so it is text: a login reported for
	// it would be refused by the link and take the whole heartbeat with it.
	state, url := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body: "$ claude\nOpen this URL to authenticate:\n  https://claude.ai/oauth/authorize?code=true\n$ ",
	}, domain.AgentShell)
	if url != "" || state == domain.StateBlocked {
		t.Fatalf("state = %q, url = %q; a shell has no login", state, url)
	}
}

func TestALoginURLBlocksTheSessionAndIsReturned(t *testing.T) {
	state, url := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body:  "Claude Code v2.x\nOpen this URL to authenticate:\n\n  https://claude.ai/oauth/authorize?code=true\n",
		Title: "claude — thinking",
	}, domain.AgentClaude)

	// Even with a title that says the agent is busy: until a person opens
	// that link, nothing is going to happen.
	if state != domain.StateBlocked || url != "https://claude.ai/oauth/authorize?code=true" {
		t.Fatalf("state = %q, url = %q", state, url)
	}
}

func TestTheTitleAloneIsEnoughToKnowTheAgentIsWorking(t *testing.T) {
	// A full-screen redraw can leave the pane momentarily unreadable; the
	// title survives it, which is half the reason to read it at all.
	state, _ := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body:  "\n\n\n",
		Title: "⠹ claude",
	}, domain.AgentClaude)

	if state != domain.StateWorking {
		t.Fatalf("state = %q, want working from the title alone", state)
	}
}
