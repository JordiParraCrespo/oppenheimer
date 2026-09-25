package domain

import (
	"reflect"
	"strings"
	"testing"
)

func TestLaunchArgsMirrorTheCatalog(t *testing.T) {
	got := Launch{Model: "opus", Permission: "auto", Effort: "medium", Prompt: "fix the picker"}.Args(AgentClaude)
	want := []string{"--model", "opus", "--permission-mode", "acceptEdits", "--effort", "high", "fix the picker"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("claude argv = %q, want %q", got, want)
	}
	got = Launch{Permission: "full", Effort: "max"}.Args(AgentCodex)
	want = []string{"--dangerously-bypass-approvals-and-sandbox", "-c", "model_reasoning_effort=xhigh"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("codex argv = %q, want %q", got, want)
	}
	got = Launch{Model: "grok-4.7", Permission: "ask", Effort: "minimal", Prompt: "fix the picker"}.Args(AgentGrok)
	want = []string{"--model", "grok-4.7", "--permission-mode", "default", "--reasoning-effort", "minimal", "fix the picker"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("grok argv = %q, want %q", got, want)
	}
}

func TestGrokStartsInteractiveWithTheTaskAsItsPositional(t *testing.T) {
	// `grok -p` is single-turn and exits; the task is the trailing positional
	// so the person gets the TUI with the task already in it.
	line := Launch{Model: "grok-4.6", Permission: "full", Prompt: "go"}.CommandLine(AgentGrok)
	if want := "grok --model grok-4.6 --permission-mode bypassPermissions go"; line != want {
		t.Fatalf("command line = %s, want %s", line, want)
	}
	if env := (Launch{Permission: "ask"}).Env(AgentGrok); env != nil {
		t.Fatalf("grok's approvals are a flag, want no environment, got %v", env)
	}
}

func TestLaunchDropsWhatTheCatalogHasNoEntryFor(t *testing.T) {
	got := Launch{Permission: "sometimes", Effort: "infinite", Prompt: "go"}.Args(AgentClaude)
	if want := []string{"go"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("argv = %q, want %q", got, want)
	}
	if got := (Launch{Prompt: "go"}).Args(AgentShell); got != nil {
		t.Fatalf("a shell takes no launch, got %q", got)
	}
}

func TestCommandLineKeepsAPromptOneWord(t *testing.T) {
	line := Launch{Permission: "ask", Prompt: `it's $HOME "quoted"`}.CommandLine(AgentClaude)
	want := `claude --permission-mode manual 'it'\''s $HOME "quoted"'`
	if line != want {
		t.Fatalf("command line = %s, want %s", line, want)
	}
	if line := (Launch{}).CommandLine(AgentShell); line != "" {
		t.Fatalf("shell command line = %q, want empty", line)
	}
}

func TestOpenCodeApprovalsAreEnvironmentOnWindowZero(t *testing.T) {
	line := Launch{Model: "anthropic/claude-opus-5-5", Permission: "ask", Prompt: "go"}.CommandLine(AgentOpenCode)
	want := `env 'OPENCODE_PERMISSION={"edit":"ask","bash":"ask","webfetch":"ask","websearch":"ask","codesearch":"ask"}' opencode --model anthropic/claude-opus-5-5 --prompt go`
	if line != want {
		t.Fatalf("command line = %s, want %s", line, want)
	}
	// Full access is the one flag OpenCode has, and sets no environment.
	line = Launch{Permission: "full"}.CommandLine(AgentOpenCode)
	if want := "opencode --auto"; line != want {
		t.Fatalf("command line = %s, want %s", line, want)
	}
	if env := (Launch{Permission: "ask"}).Env(AgentClaude); len(env) != 0 {
		t.Fatalf("claude takes its level as a flag, got env %q", env)
	}
}

// An OpenCode level below Full access is all environment, and OpenCode with no
// configuration allows everything. So the level must never reach the process
// as argv alone: every line built for it, first launch or restart, starts with
// the environment.
func TestAnOpenCodeLevelThatIsEnvironmentNeverStartsWithoutIt(t *testing.T) {
	for _, level := range []string{"ask", "auto"} {
		for _, launch := range []Launch{
			{Permission: level},
			{Permission: level, Model: "openai/gpt-5.6-sol", Prompt: "it's $HOME"},
		} {
			line := launch.CommandLine(AgentOpenCode)
			if !strings.HasPrefix(line, "env 'OPENCODE_PERMISSION=") {
				t.Fatalf("%s: command line %q starts OpenCode without its permission block", level, line)
			}
			if got := launch.Args(AgentOpenCode); len(got) > 0 && got[0] == "--auto" {
				t.Fatalf("%s: argv %q escalates to Full access", level, got)
			}
		}
	}
}

func TestEveryCatalogIDIsAnAgentAndBack(t *testing.T) {
	for id := range launchCatalog {
		agent, ok := AgentFromCatalogID(id)
		if !ok || !agent.Valid() || agent.CatalogID() != id {
			t.Fatalf("%s -> %q (%v) -> %q", id, agent, ok, agent.CatalogID())
		}
	}
	for agent, id := range agentCatalogIDs {
		if _, ok := launchCatalog[id]; !ok {
			t.Fatalf("%s names catalog id %q, which the generated table lacks", agent, id)
		}
	}
	if _, ok := AgentFromCatalogID("cursor"); ok {
		t.Fatal("an id outside the catalog maps onto an agent")
	}
	// An agent the runner does not know has no catalog id and nothing to
	// launch: never Claude Code by default.
	unknown := Agent("cursor")
	if unknown.Valid() || unknown.CatalogID() != "" || (Launch{Prompt: "go"}).CommandLine(unknown) != "" {
		t.Fatal("an unknown agent borrowed another agent's launch")
	}
}
