package domain

import (
	"reflect"
	"testing"
)

func TestLaunchArgsMirrorTheCatalog(t *testing.T) {
	got := Launch{Model: "opus", Permission: "auto", Effort: "medium", Prompt: "fix the picker"}.Args(AgentClaude)
	want := []string{"--model", "opus", "--permission-mode", "acceptEdits", "--effort", "high", "fix the picker"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("claude argv = %q, want %q", got, want)
	}
	got = Launch{Permission: "full", Effort: "max"}.Args(AgentCodex)
	want = []string{"--dangerously-bypass-approvals-and-sandbox", "-c", "model_reasoning_effort=high"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("codex argv = %q, want %q", got, want)
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
