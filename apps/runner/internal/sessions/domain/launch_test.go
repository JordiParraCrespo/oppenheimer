package domain

import (
	"reflect"
	"strings"
	"testing"
)

func TestLaunchArgsMirrorTheCatalog(t *testing.T) {
	// A level is the CLI's own name for it, passed through as that name.
	got := Launch{Model: "claude-fable-5-1", Permission: "auto", Effort: "xhigh", EffortIsLevel: true, Prompt: "fix the picker"}.Args(AgentClaude)
	want := []string{"--model", "claude-fable-5-1", "--permission-mode", "acceptEdits", "--effort", "xhigh", "fix the picker"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("claude argv = %q, want %q", got, want)
	}
	// No model is the default model, whose levels go to `ultra`.
	got = Launch{Permission: "full", Effort: "ultra", EffortIsLevel: true}.Args(AgentCodex)
	want = []string{"--dangerously-bypass-approvals-and-sandbox", "-c", "model_reasoning_effort=ultra"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("codex argv = %q, want %q", got, want)
	}
	got = Launch{Model: "grok-4.7", Permission: "ask", Effort: "minimal", EffortIsLevel: true, Prompt: "fix the picker"}.Args(AgentGrok)
	want = []string{"--model", "grok-4.7", "--permission-mode", "default", "--reasoning-effort", "minimal", "fix the picker"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("grok argv = %q, want %q", got, want)
	}
}

// The levels are the model's, so a level one model has and another lacks is
// sent for the first and dropped for the second — never passed to a CLI that
// would refuse it or forward it to an API that would.
func TestEffortIsTheModelsOwn(t *testing.T) {
	if got := (Launch{Model: "gpt-5.6-luna", Effort: "ultra", EffortIsLevel: true}).Args(AgentCodex); len(got) != 2 {
		t.Fatalf("luna has no ultra, want only the model, got %q", got)
	}
	if got := (Launch{Model: "claude-haiku-4-5", Effort: "high", EffortIsLevel: true}).Args(AgentClaude); len(got) != 2 {
		t.Fatalf("haiku takes no effort, want only the model, got %q", got)
	}
	if got := (Launch{Model: "an-unlisted-model", Effort: "high", EffortIsLevel: true}).Args(AgentClaude); len(got) != 2 {
		t.Fatalf("an unlisted model's levels are unknown, want only the model, got %q", got)
	}
}

// OpenCode takes a level as the model's variant, in configuration; it lands
// beside the permission block, and a level that is the model left alone sets
// nothing.
func TestOpenCodeEffortIsTheVariantInConfiguration(t *testing.T) {
	launch := Launch{Model: "anthropic/claude-opus-5-5", Permission: "ask", Effort: "xhigh", EffortIsLevel: true, Prompt: "go"}
	env := launch.Env(AgentOpenCode)
	if want := `{"agent":{"build":{"model":"anthropic/claude-opus-5-5","variant":"xhigh"}}}`; env["OPENCODE_CONFIG_CONTENT"] != want {
		t.Fatalf("OPENCODE_CONFIG_CONTENT = %q, want %q", env["OPENCODE_CONFIG_CONTENT"], want)
	}
	if !strings.HasPrefix(env["OPENCODE_PERMISSION"], `{"edit":"ask"`) {
		t.Fatalf("the effort displaced the permission block: %v", env)
	}
	if got := launch.Args(AgentOpenCode); !reflect.DeepEqual(got, []string{"--model", "anthropic/claude-opus-5-5", "--prompt", "go"}) {
		t.Fatalf("argv = %q, want no effort in it", got)
	}
	off := Launch{Model: "anthropic/claude-haiku-4-5", Permission: "full", Effort: "none", EffortIsLevel: true}
	if env := off.Env(AgentOpenCode); len(env) != 0 {
		t.Fatalf("haiku with thinking off sets nothing, got %v", env)
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
	got := Launch{Permission: "sometimes", Effort: "ultra", EffortIsLevel: true, Prompt: "go"}.Args(AgentClaude)
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

func TestPromptWithImagesListsThePathsAfterTheTask(t *testing.T) {
	if got := PromptWithImages("look", []string{"/a.png", "/b.jpg"}); got != "look\n\n/a.png\n/b.jpg" {
		t.Fatalf("prompt = %q", got)
	}
	if got := PromptWithImages("look", nil); got != "look" {
		t.Fatalf("prompt = %q, want the task unchanged", got)
	}
	if got := PromptWithImages("", []string{"/a.png"}); got != "/a.png" {
		t.Fatalf("prompt = %q", got)
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

// A launch saved before effort was per model holds one of the old product
// stops ("medium" was Claude Code's `--effort high`). Read as a level it would
// restart the agent at one nobody chose, so it is not sent at all.
func TestAnEffortSavedBeforeLevelsIsNotSent(t *testing.T) {
	stored := Launch{Model: "claude-opus-5-5", Effort: "medium"}
	if got := stored.Args(AgentClaude); !reflect.DeepEqual(got, []string{"--model", "claude-opus-5-5"}) {
		t.Fatalf("argv = %q, want no effort", got)
	}
	stored.EffortIsLevel = true
	if got := stored.Args(AgentClaude); !reflect.DeepEqual(got, []string{"--model", "claude-opus-5-5", "--effort", "medium"}) {
		t.Fatalf("argv = %q, want the level", got)
	}
}

// An effort must not be able to loosen what the agent may do: were the two
// ever to name the same variable, the permission level's value is the one set.
func TestThePermissionLevelWinsAnEnvironmentName(t *testing.T) {
	saved := launchCatalog["opencode"]
	defer func() { launchCatalog["opencode"] = saved }()
	clash := saved
	clash.effort = launchLevel{env: map[string]string{"OPENCODE_PERMISSION": `{"edit":"allow"}`}}
	launchCatalog["opencode"] = clash
	env := Launch{Model: "anthropic/claude-opus-5-5", Permission: "ask", Effort: "high", EffortIsLevel: true}.Env(AgentOpenCode)
	if !strings.HasPrefix(env["OPENCODE_PERMISSION"], `{"edit":"ask"`) {
		t.Fatalf("OPENCODE_PERMISSION = %q, want the permission level's", env["OPENCODE_PERMISSION"])
	}
}
