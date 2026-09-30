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

// The agent's own transcript is what makes a stopped session continuable, and
// the only thing missing was a name both sides agree on. These pin that name's
// two uses: given once at launch, and given back to reopen.
func TestLaunchNamesAndReopensTheConversation(t *testing.T) {
	const id = "17a57597-65a4-4517-84e3-b4010c7b8ed9"
	agent := AgentClaude

	created := Launch{Conversation: id, Prompt: "Do the thing."}.Args(agent)
	if !containsPair(created, "--session-id", id) {
		t.Fatalf("a new session does not name its conversation: %v", created)
	}
	if !containsValue(created, "Do the thing.") {
		t.Fatalf("a new session dropped its first task: %v", created)
	}

	resumed := Launch{Conversation: id, Prompt: "Do the thing.", Resume: true}.Args(agent)
	if !containsPair(resumed, "--resume", id) {
		t.Fatalf("a resume does not reopen the conversation: %v", resumed)
	}
	// The conversation already holds the first task; sending it again would
	// ask for the same work twice.
	if containsValue(resumed, "Do the thing.") {
		t.Fatalf("a resume replayed the first task: %v", resumed)
	}
	if containsValue(resumed, "--session-id") {
		t.Fatalf("a resume tried to name a conversation that exists: %v", resumed)
	}
}

func containsPair(args []string, flag, value string) bool {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == flag && args[i+1] == value {
			return true
		}
	}
	return false
}

func containsValue(args []string, value string) bool {
	for _, a := range args {
		if a == value {
			return true
		}
	}
	return false
}

// An agent the catalog gives no way to reopen a conversation restarts the way
// it always did: a fresh conversation and the first task sent again. The one
// thing it must never do is offer an id that already exists.
func TestResumeFallsBackForAnAgentThatCannotReopen(t *testing.T) {
	const id = "17a57597-65a4-4517-84e3-b4010c7b8ed9"
	resumed := Launch{Conversation: id, Prompt: "Do the thing.", Resume: true}.Args(AgentCodex)

	if containsValue(resumed, id) {
		t.Fatalf("offered a conversation id to an agent that cannot take one: %v", resumed)
	}
	if !containsValue(resumed, "Do the thing.") {
		t.Fatalf("dropped the first task with nothing to resume: %v", resumed)
	}
}
