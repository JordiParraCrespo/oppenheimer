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
	want = []string{
		"--no-daemon",
		"--dangerously-bypass-approvals-and-sandbox",
		"-c",
		"model_reasoning_effort=ultra",
	}
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
	// Codex always carries `--no-daemon`, so "only the model" is three words.
	if got := (Launch{Model: "gpt-5.6-luna", Effort: "ultra", EffortIsLevel: true}).Args(AgentCodex); len(got) != 3 {
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
	resumed := Launch{Conversation: id, Prompt: "Do the thing.", Resume: true}.Args(AgentShell)

	if containsValue(resumed, id) {
		t.Fatalf("offered a conversation id to an agent that cannot take one: %v", resumed)
	}
}

// Codex and OpenCode name their own conversations, so the control plane never
// has an id to hand them — and they do not need one: each scopes "the last
// one" to the directory it was started in, which for a session is its own
// worktree and never another's. A resume that waited for an id would never
// fire for them, and the session would come back empty beside the transcript
// it should have continued.
func TestResumeWithoutAnIDReopensByTheWorkingDirectory(t *testing.T) {
	for _, c := range []struct {
		agent Agent
		want  []string
	}{
		{AgentCodex, []string{"resume", "--last"}},
		{AgentOpenCode, []string{"--continue"}},
	} {
		resumed := Launch{Prompt: "Do the thing.", Resume: true}.Args(c.agent)
		for _, word := range c.want {
			if !containsValue(resumed, word) {
				t.Fatalf("%s did not reopen its conversation: %v", c.agent, resumed)
			}
		}
		// The conversation already holds the first task.
		if containsValue(resumed, "Do the thing.") {
			t.Fatalf("%s replayed the first task on a resume: %v", c.agent, resumed)
		}
	}
}

// A session is a terminal nobody is watching, so what makes it independent of
// the host is not a choice a caller makes: it is sent every time, on a fresh
// launch and on a resume alike. Codex refusing to share a background server of
// a different release is the case that costs a session — it stops on a modal
// nobody is there to answer.
func TestWhatEveryLaunchCarriesIsSentOnBothPaths(t *testing.T) {
	fresh := Launch{Prompt: "Do the thing."}.Args(AgentCodex)
	if !containsValue(fresh, "--no-daemon") {
		t.Fatalf("a fresh codex launch shared the host's daemon: %v", fresh)
	}
	resumed := Launch{Resume: true}.Args(AgentCodex)
	if !containsValue(resumed, "--no-daemon") {
		t.Fatalf("a resumed codex launch shared the host's daemon: %v", resumed)
	}
	// It is how the session runs, not what it is: the subcommand still leads.
	if resumed[0] != "resume" {
		t.Fatalf("resume no longer leads the argv: %v", resumed)
	}
}

// `codex resume` is a subcommand, so it has to be the first word: clap reads
// `codex --model x resume --last` as a global flag followed by a subcommand it
// no longer accepts there. Appended like a flag it would launch nothing.
func TestASubcommandResumeLeadsTheArguments(t *testing.T) {
	resumed := Launch{Model: "gpt-5.6-sol", Permission: "ask", Resume: true}.Args(AgentCodex)

	if len(resumed) < 2 || resumed[0] != "resume" || resumed[1] != "--last" {
		t.Fatalf("resume did not lead the argv: %v", resumed)
	}
	if !containsPair(resumed, "--model", "gpt-5.6-sol") {
		t.Fatalf("a leading resume dropped the rest of the launch: %v", resumed)
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
