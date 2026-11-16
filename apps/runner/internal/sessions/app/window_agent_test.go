package app_test

import (
	"context"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// openWithLaunch opens a Claude Code session started with launch.
func (h *fakeHarness) openWithLaunch(t *testing.T, launch domain.Launch) domain.Session {
	t.Helper()
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude, Launch: launch,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

var claudeAtFull = domain.Launch{Model: "claude-sonnet-5-5", Permission: "full", Effort: "high"}

// A second agent starts in its own window, in the session's worktree, at the
// session's permission level, and the window is named after it. The
// regression: the agent typed into a shell, launched in the wrong folder or
// window, or run with a stricter or looser level than the session's.
func TestASecondAgentStartsInItsOwnWindowAtTheSessionsPermission(t *testing.T) {
	h := newFakeHarness(t)
	session := h.openWithLaunch(t, claudeAtFull)
	agentLaunch := h.terminals.Launches[session.Target(0)]

	window, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: domain.AgentCodex})
	if err != nil {
		t.Fatalf("open: %v", err)
	}

	if window.Index == 0 || window.Name != "codex" || window.Agent {
		t.Fatalf("window = %+v, want a new window named codex that is not the session's agent", window)
	}
	launched := h.terminals.Launches[session.Target(window.Index)]
	if launched.Dir != session.Cwd() || !strings.HasPrefix(launched.Command, "codex ") {
		t.Fatalf("launched %+v, want codex in %s", launched, session.Cwd())
	}
	if !strings.Contains(launched.Command, "--dangerously-bypass-approvals-and-sandbox") {
		t.Fatalf("codex ran without the session's full permission: %q", launched.Command)
	}
	if h.terminals.Launches[session.Target(0)] != agentLaunch {
		t.Fatal("opening a second agent relaunched window 0")
	}
	windows, err := h.svc.Windows(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range windows {
		if w.Agent != (w.Index == 0) {
			t.Fatalf("windows = %+v, want window 0 the only agent's", windows)
		}
	}
}

// A model and an effort are one CLI's: the session's own agent opened again
// takes them, another agent never does (codex handed `--model
// claude-sonnet-5-5` fails to start). Neither ever takes the session's
// conversation, which would make Claude Code refuse an id already in use.
func TestASecondAgentTakesTheModelAndEffortOnlyWhenItIsTheSessionsOwn(t *testing.T) {
	h := newFakeHarness(t)
	session := h.openWithLaunch(t, claudeAtFull)

	codex, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: domain.AgentCodex})
	if err != nil {
		t.Fatal(err)
	}
	claude, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}

	other := h.terminals.Launches[session.Target(codex.Index)].Command
	if strings.Contains(other, "--model") || strings.Contains(other, "model_reasoning_effort") {
		t.Fatalf("codex took Claude Code's model or effort: %q", other)
	}
	same := h.terminals.Launches[session.Target(claude.Index)].Command
	for _, want := range []string{"--model claude-sonnet-5-5", "--effort high", "--permission-mode bypassPermissions"} {
		if !strings.Contains(same, want) {
			t.Fatalf("the session's own agent opened again lacks %q: %q", want, same)
		}
	}
	if strings.Contains(same, "--session-id") || strings.Contains(same, session.ID) {
		t.Fatalf("a second Claude Code took the session's conversation: %q", same)
	}
}

// What the person picked for the second agent wins over the session's own:
// its model, its effort (spelled as the CLI's level, as a new session's is)
// and its permission level, for another agent and the session's own alike.
// The regression: the picker's choices dropped and the session's launched.
func TestASecondAgentStartsWithTheModelEffortAndPermissionChosenForIt(t *testing.T) {
	h := newFakeHarness(t)
	session := h.openWithLaunch(t, claudeAtFull)

	codex, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{
		Agent: domain.AgentCodex, Model: "gpt-6.1-terra", Effort: "xhigh", Permission: "ask",
	})
	if err != nil {
		t.Fatal(err)
	}
	claude, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{
		Agent: domain.AgentClaude, Model: "claude-opus-5-5", Effort: "low", Permission: "auto",
	})
	if err != nil {
		t.Fatal(err)
	}

	other := h.terminals.Launches[session.Target(codex.Index)].Command
	for _, want := range []string{"--model gpt-6.1-terra", "model_reasoning_effort=xhigh", "--ask-for-approval on-request"} {
		if !strings.Contains(other, want) {
			t.Fatalf("codex lacks the chosen %q: %q", want, other)
		}
	}
	if strings.Contains(other, "--dangerously-bypass-approvals-and-sandbox") {
		t.Fatalf("codex took the session's full permission over the one chosen: %q", other)
	}
	same := h.terminals.Launches[session.Target(claude.Index)].Command
	for _, want := range []string{"--model claude-opus-5-5", "--effort low", "--permission-mode auto"} {
		if !strings.Contains(same, want) {
			t.Fatalf("the session's own agent lacks the chosen %q: %q", want, same)
		}
	}
	if strings.Contains(same, "claude-sonnet-5-5") || strings.Contains(same, "bypassPermissions") {
		t.Fatalf("the session's own agent took the session's launch over the one chosen: %q", same)
	}
}

// A choice is kept to the catalog the way a create's is: an effort the chosen
// model does not offer is dropped rather than sent, and the launch goes ahead.
func TestASecondAgentDropsAnEffortItsModelDoesNotOffer(t *testing.T) {
	h := newFakeHarness(t)
	session := h.openWithLaunch(t, claudeAtFull)

	window, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{
		Agent: domain.AgentCodex, Model: "gpt-6-luna", Effort: "ultra",
	})
	if err != nil {
		t.Fatalf("open: %v", err)
	}

	command := h.terminals.Launches[session.Target(window.Index)].Command
	if !strings.Contains(command, "--model gpt-6-luna") || strings.Contains(command, "model_reasoning_effort") {
		t.Fatalf("launched %q, want gpt-6-luna and no effort it does not offer", command)
	}
}

// The blank terminal is what a window without an agent already is, and an
// agent this runner does not know has nothing to launch: both are refused,
// and no window is left behind.
func TestAWindowRefusesTheBlankTerminalAndUnknownAgents(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)

	for _, agent := range []domain.Agent{domain.AgentShell, domain.Agent("cursor")} {
		if _, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: agent}); !isProblem(err, domain.ErrInvalidInput) {
			t.Fatalf("%s: err = %v, want %s", agent, err, domain.ErrInvalidInput.Code)
		}
	}
	if windows, _ := h.svc.Windows(context.Background(), session.ID); len(windows) != 1 {
		t.Fatalf("windows = %+v, want only the agent's", windows)
	}
}

// An agent that fails to start takes its window with it: the regression is a
// tab that says codex and holds a bare shell, kept in the record for good.
func TestAFailedSecondAgentLeavesNoWindow(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	h.terminals.FailLaunch = true

	if _, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: domain.AgentCodex}); err == nil {
		t.Fatal("a launch that failed opened a window")
	}

	windows, err := h.svc.Windows(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	held, _ := h.svc.Get(session.ID)
	if len(windows) != 1 || len(held.Windows) != 1 {
		t.Fatalf("tmux holds %+v and the record %+v, want only window 0", windows, held.Windows)
	}
}

// A second copy of the session's own agent is refused when that agent finds
// its conversation by the folder (Codex, OpenCode, Pi): the session's chat
// and its restart would follow the newer one. Claude Code names its
// conversation, so a second Claude in a Claude session starts, and another
// kind of agent in a Codex session starts too. The regression: the session's
// chat flipping to the side agent, or a restart reopening its conversation.
func TestASecondCopyOfAnAgentFoundByItsFolderIsRefused(t *testing.T) {
	h := newFakeHarness(t)
	ctx := context.Background()
	codex, err := h.svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentCodex,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := h.svc.OpenWindow(ctx, codex.ID, app.WindowInput{Agent: domain.AgentCodex}); !isProblem(err, domain.ErrInvalidInput) {
		t.Fatalf("a second codex: err = %v, want %s", err, domain.ErrInvalidInput.Code)
	}
	if windows, _ := h.svc.Windows(ctx, codex.ID); len(windows) != 1 {
		t.Fatalf("windows = %+v, want only the agent's", windows)
	}
	if _, err := h.svc.OpenWindow(ctx, codex.ID, app.WindowInput{Agent: domain.AgentClaude}); err != nil {
		t.Fatalf("claude beside codex: %v", err)
	}

	claude := h.open(t)
	if _, err := h.svc.OpenWindow(ctx, claude.ID, app.WindowInput{Agent: domain.AgentClaude}); err != nil {
		t.Fatalf("a second claude: %v", err)
	}
}

// A Claude session that continues a cloud session finds its conversation by
// the folder, not by its id: a restart continues the newest one there. A
// second Claude beside it would be what the restart reopens, so it is
// refused like a second Codex.
func TestASecondClaudeInATeleportedSessionIsRefused(t *testing.T) {
	h := newFakeHarness(t)
	ctx := context.Background()
	session, err := h.svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude,
		Launch: domain.Launch{Teleport: "session_01ABCDEFGHIJKLMNOPQRSTUV"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := h.svc.OpenWindow(ctx, session.ID, app.WindowInput{Agent: domain.AgentClaude}); !isProblem(err, domain.ErrInvalidInput) {
		t.Fatalf("a second claude: err = %v, want %s", err, domain.ErrInvalidInput.Code)
	}
	if _, err := h.svc.OpenWindow(ctx, session.ID, app.WindowInput{Agent: domain.AgentCodex}); err != nil {
		t.Fatalf("codex beside it: %v", err)
	}
}
