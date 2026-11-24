package manifest_test

import (
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

// Claude Code asks before an edit or a new file with a question no phrase in
// the manifest names; its numbered Yes under the cursor is what says it waits.
// Before the option line was read on every line of the region, both of these
// were `unknown`, and a session stopped on one never reached the Inbox.
func TestAnEditOrCreateDialogIsBlocked(t *testing.T) {
	c := classifier(t, "")
	for _, title := range []string{
		"Do you want to make this edit to src/app.ts?",
		"Do you want to create empty-state.tsx?",
	} {
		body := strings.Join([]string{
			strings.Repeat("─", 60),
			" Edit file",
			"",
			"  src/app.ts",
			"  +  export const wallet = createWallet();",
			"",
			" " + title,
			" ❯ 1. Yes",
			"   2. Yes, allow all edits during this session (shift+tab)",
			"   3. No, and tell Claude what to do differently (esc)",
			"",
			" Esc to cancel",
		}, "\n")
		if state, _ := c.Classify(app.Screen{Body: body}, domain.AgentClaude); state != domain.StateBlocked {
			t.Errorf("%q: state = %q, want blocked", title, state)
		}
	}
}

// Grok 1.0.41 on a host that has never signed in, as the pane showed it in a
// live session: the braille logo, then the code and a wait on the person. The
// logo is braille, which is why no spinner rule may read this as work.
const grokSignIn = `
                    ⠀⠀⠀⠀⠀⠀⣀⣀⡀⠀⠀⠀⢀⠄
                    ⠀⠀⠀⣠⣾⠿⠛⠛⠛⠛⢀⡴⠁⠀
                    ⠀⠀⣼⡟⠁⠀⠀⠀⢀⡴⠻⣿⡀⠀

             Approve in your browser to finish signing in.
                             FGQ4-ECWK
                Make sure your browser shows this code.
                If it doesn't open, click here to copy.

           Copying not working? Click here to show full URL.
                        Waiting for approval...




                             ctrl+q  quit
`

func TestGrokWaitingToSignInIsBlocked(t *testing.T) {
	c := classifier(t, "")

	if state, _ := c.Classify(app.Screen{Title: "grok", Body: grokSignIn}, domain.AgentGrok); state != domain.StateBlocked {
		t.Fatalf("sign-in screen: state = %q, want blocked", state)
	}
	revealed := "Select the URL below with your mouse and copy manually.\n" +
		"https://accounts.x.ai/oauth2/device?user_code=KKG6-57R3\n\nctrl+q  go back\n"
	state, login := c.Classify(app.Screen{Title: "grok", Body: revealed}, domain.AgentGrok)
	if state != domain.StateBlocked {
		t.Fatalf("revealed URL: state = %q, want blocked", state)
	}
	if login != "https://accounts.x.ai/oauth2/device?user_code=KKG6-57R3" {
		t.Fatalf("login = %q, want the device URL grok printed", login)
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

	// The broken override is ignored and the bundled rules stay in force.
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
	for _, agent := range []domain.Agent{domain.AgentClaude, domain.AgentCodex, domain.AgentOpenCode, domain.AgentGrok, domain.AgentPi, domain.AgentOmp, domain.AgentAntigravity, domain.AgentZCode, domain.AgentFx, domain.AgentHermes, domain.AgentMuse, domain.AgentQwen, domain.AgentShell} {
		if !agents[agent] {
			t.Errorf("no bundled manifest for %q, which the runner can start", agent)
		}
	}
}

// The login allowlist is generated per agent from the catalog, so each agent
// offers only its own vendors' logins.

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

// Claude Code 2.1 draws its prompt as `❯` and a no-break space, captured from
// a real pane after a turn. Go's `\s` does not match U+00A0, so this screen
// read `unknown`, the turn never completed, and a bot waiting on its
// follow-up never heard back.
func TestAnEmptyPromptAfterATurnIsIdle(t *testing.T) {
	rule := strings.Repeat("─", 60)
	state, _ := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body: "❯ Please reply with the exact phrase: Follow-up received.\n\n" +
			"● Follow-up received.\n\n" +
			"✻ Cooked for 1s · done 7:56 AM\n\n" +
			rule + "\n❯  \n" + rule + "\n" +
			"  ⏵⏵ auto mode on (shift+tab to cycle)\n",
	}, domain.AgentClaude)

	if state != domain.StateIdle {
		t.Fatalf("state = %q, want idle", state)
	}
}

// After most turns Claude Code 2.1 offers a next prompt in the input box. The
// box is `❯` and a no-break space with the suggestion after it, captured from
// a real pane; an empty-prompt pattern alone read this `unknown`.
func TestASuggestedNextPromptIsIdle(t *testing.T) {
	rule := strings.Repeat("─", 60)
	state, _ := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body: "  where the land meets the sea.\n\n" +
			"✻ Baked for 14s · done 7:45 AM\n\n" +
			rule + "\n❯ save it to a file\n" + rule + "\n" +
			"  ⏸ manual mode on · ? for shortcuts\n",
	}, domain.AgentClaude)

	if state != domain.StateIdle {
		t.Fatalf("state = %q, want idle", state)
	}
}

// Mid-turn the same input box is on screen, so the prompt rule must not turn
// a working session idle; captured from a real pane.
func TestTheInputBoxUnderASpinnerIsStillWorking(t *testing.T) {
	rule := strings.Repeat("─", 60)
	state, _ := manifest.New(manifest.Options{}).Classify(app.Screen{
		Body: "❯ Write a 300-word paragraph about tide pools.\n\n" +
			"· Envisioning… (8s · thinking)\n\n" +
			rule + "\n❯ \n" + rule + "\n" +
			"  ⏸ manual mode on · esc to interrupt\n",
	}, domain.AgentClaude)

	if state != domain.StateWorking {
		t.Fatalf("state = %q, want working", state)
	}
}

// fx's status line is `Working` or `Thinking` on a line of its own, and its replies say the
// word too: one that starts a line in prose ("Working tree is clean") must not
// read as a turn under way, or an idle fx session never shows as needing you.
func TestFxWorkingIsItsStatusLineNotItsProse(t *testing.T) {
	c := manifest.New(manifest.Options{})

	for _, status := range []string{"⠹ Working (3s · esc to interrupt)", " Thinking"} {
		if state, _ := c.Classify(app.Screen{Body: "done\n\n" + status}, domain.AgentFx); state != domain.StateWorking {
			t.Fatalf("status line %q: state = %q, want working", status, state)
		}
	}
	for _, prose := range []string{"Working tree is clean.", "- Working directory: /src", "• Working as expected now", "Thinking about it, the bug is in the parser."} {
		if state, _ := c.Classify(app.Screen{Body: "fx\n\n" + prose + "\n\n> "}, domain.AgentFx); state == domain.StateWorking {
			t.Fatalf("prose %q read as working", prose)
		}
	}
}

// ZCode 0.18.0's input box at rest, mid-turn and under its approval dialog,
// captured from a real pane. Without a rule for the box at rest a finished
// turn read `unknown`, which restarts the wait before the session counts as
// waiting on you.
func TestZCodeAtItsPromptIsIdleAndMidTurnIsNot(t *testing.T) {
	c := classifier(t, "")
	box := func(placeholder string) string {
		return " ╭─ Build ──────────────────────────────╮\n" +
			" │ " + placeholder + "\n │\n │\n │ glm-5.3 zai | max\n" +
			" ╰──────────────────────────────────────╯\n"
	}
	cases := []struct {
		name string
		body string
		want domain.State
	}{
		{"after a turn", "   c.txt now exists in the working directory.\n" + box("Type a prompt") + "     13.5K (7%)\n", domain.StateIdle},
		{"a draft typed", box("fix the picker") + "     242 (0%)\n", domain.StateIdle},
		{"mid-turn", box("Type to queue input") + "  ⠴ esc to interrupt\n", domain.StateWorking},
		{"approval", " │ Tool has side effects and requires approval\n │   Allow once\n" +
			" │   Always allow in this project\n │ > Deny\n │ Up/Down choose, Enter confirms, Esc denies\n", domain.StateBlocked},
	}
	for _, tc := range cases {
		if state, _ := c.Classify(app.Screen{Body: tc.body}, domain.AgentZCode); state != tc.want {
			t.Errorf("%s: state = %q, want %q", tc.name, state, tc.want)
		}
	}
}

// The screens are Qwen Code 0.28.4's in tmux, trimmed to their last rows.
// Regressions: the placeholder, which stays up mid-turn, reading a working
// Qwen as idle; a prompt holding text reading as unknown; a reply quoting
// the timer's words reading as working.
func TestQwenStatesReadOffItsScreen(t *testing.T) {
	c := classifier(t, "")
	rule := strings.Repeat("─", 40)
	box := func(prompt, footer string) string {
		return rule + "\n" + prompt + "\n" + rule + "\n  ➜ work · git:(master) · fake-model\n  " + footer + "\n\n\n"
	}
	cases := []struct {
		name string
		body string
		want domain.State
	}{
		{"after a turn", "  ◆︎ Done: the tool said hello.\n" + box(">   Type your message or @path/to/file", "⏸ Ask permissions (shift + tab to cycle)"), domain.StateIdle},
		{"a message put back by Esc", box("> a slow plain one \u200b", "⏸ Ask permissions (shift + tab to cycle)"), domain.StateIdle},
		{"full access", box("*   Type your message or @path/to/file", "YOLO mode (shift + tab to cycle)"), domain.StateIdle},
		{"one Esc", box(">   Type your message or @path/to/file", "Press Esc again to rewind conversation."), domain.StateIdle},
		{"mid-turn", "  > a slow plain one\n\n  .. Communing with the machine spirit... (2s · esc to cancel)\n" +
			box(">   Type your message or @path/to/file", "Enter to steer · Ctrl+Q to queue · ⏸ Ask permissions (shift + tab to cycle)"), domain.StateWorking},
		{"a reply quoting the timer", "  ◆︎ It shows (2s · esc to cancel) while it works.\n" +
			box(">   Type your message or @path/to/file", "Auto mode (shift + tab to cycle)"), domain.StateIdle},
		{"approval", "  ◆︎ Writing it.\n  ? WriteFile Writing to hello.txt ←\n\n   1 hi\n\n   Apply this change?\n\n" +
			"   › 1. Yes, allow once\n     2. Yes, allow always\n     3. No, suggest changes (esc)\n\n\n  ⠏ Waiting for user confirmation...\n", domain.StateBlocked},
		{"rewind", "  ╭" + rule + "╮\n  │ Rewind Conversation (12 turns)  │\n  │ ↑ #6 plain gap 0.05  │\n" +
			"  │ ↑↓ to navigate · Enter to select · Esc to cancel │\n  ╰" + rule + "╯\n", domain.StateBlocked},
		{"rewind, a turn picked", "  │ Rewind Conversation                  │\n  │ Rewind to: now write it again │\n  │ › Restore conversation only │\n  │   Never mind │\n" +
			"  │ ↑↓ to navigate · Enter to select · Esc to go back │\n", domain.StateBlocked},
		{"a shell command to approve", "  ? Shell rm -f notes.txt (tidy up) ←\n     rm -f notes.txt\n   Allow execution of: 'rm'?\n   › 1. Yes, allow once\n" +
			"     2. Always allow run 'rm *' commands in this project\n     4. No, suggest changes (esc)\n  ⠏ Waiting for user confirmation...\n", domain.StateBlocked},
		{"no provider", "  │ Connect a Provider                     │\n  │                                        │\n" +
			"  │ › Qwen Account with Subscription New   │\n  │   Custom Provider                      │\n", domain.StateBlocked},
		{"signing in", "  │ Qwen Subscription │\n  │ If the browser didn't open, visit: │\n" +
			"  │ https://chat.qwen.ai/authorize?user_code=HDWX-CPPN&client=cli │\n  │ .  Waiting for sign-in… │\n  │ c to copy link · Esc to cancel │\n", domain.StateBlocked},
	}
	for _, tc := range cases {
		if state, _ := c.Classify(app.Screen{Body: tc.body}, domain.AgentQwen); state != tc.want {
			t.Errorf("%s: state = %q, want %q", tc.name, state, tc.want)
		}
	}
}
