package domain

import (
	"encoding/json"
	"reflect"
	"slices"
	"strings"
	"testing"
)

var briefed = Launch{
	Note:  "/w/acct/ws/sessions.noindex/bold-otter/CLAUDE.md",
	Tools: []string{"runner", "mcp"},
}

// Codex reads AGENTS.md from its checkout down and never the session's folder
// above it, so without this it is the one agent that never learns the session
// note or `runner --skill` exist. Checked against codex-cli 0.171: the
// instructions sit beside the repository's own AGENTS.md, and the server is
// listed by `codex mcp list` under the override.
func TestCodexIsToldWhereTheNoteIsAndGivenTheRunnersTools(t *testing.T) {
	launch := briefed
	launch.Prompt = "fix it"
	got := launch.Args(AgentCodex)
	at := slices.Index(got, "-c")
	if at < 0 || !strings.HasPrefix(got[at+1], "developer_instructions=") {
		t.Fatalf("codex argv %q carries no developer_instructions", got)
	}
	var instructions string
	if err := json.Unmarshal([]byte(strings.TrimPrefix(got[at+1], "developer_instructions=")), &instructions); err != nil {
		t.Fatalf("developer_instructions is not one quoted string: %v", err)
	}
	for _, says := range []string{briefed.Note, "runner --skill", "`oppenheimer` MCP server"} {
		if !strings.Contains(instructions, says) {
			t.Fatalf("instructions %q do not mention %q", instructions, says)
		}
	}
	for _, override := range []string{`mcp_servers.oppenheimer.command="runner"`, `mcp_servers.oppenheimer.args=["mcp"]`} {
		if !slices.Contains(got, override) {
			t.Fatalf("codex argv %q lacks %q", got, override)
		}
	}
	if got[len(got)-1] != "fix it" {
		t.Fatalf("the prompt is no longer last: %q", got)
	}
	// A resume leads with its subcommand, which takes the same overrides.
	launch.Resume = true
	if resumed := launch.Args(AgentCodex); resumed[0] != "resume" || !slices.Contains(resumed, `mcp_servers.oppenheimer.args=["mcp"]`) {
		t.Fatalf("codex resume argv = %q", resumed)
	}
}

// Claude Code finds the note on its own, so it gets only the server, added to
// the person's own MCP servers rather than replacing them.
func TestClaudeIsGivenTheRunnersToolsBesideItsOwnServers(t *testing.T) {
	launch := briefed
	launch.Prompt = "fix it"
	got := launch.Args(AgentClaude)
	// One word: `--mcp-config` takes several values, and a prompt following a
	// separate value is read as a config file (checked on Claude Code 2.1.330).
	at := slices.IndexFunc(got, func(word string) bool { return strings.HasPrefix(word, "--mcp-config=") })
	if at < 0 || slices.Contains(got, "--strict-mcp-config") || got[len(got)-1] != "fix it" {
		t.Fatalf("claude argv = %q", got)
	}
	var config struct {
		MCPServers map[string]struct {
			Command string   `json:"command"`
			Args    []string `json:"args"`
		} `json:"mcpServers"`
	}
	raw := strings.TrimPrefix(got[at], "--mcp-config=")
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		t.Fatal(err)
	}
	if server := config.MCPServers[ToolsServer]; server.Command != "runner" || !reflect.DeepEqual(server.Args, []string{"mcp"}) {
		t.Fatalf("mcp config = %s", raw)
	}
}

// OpenCode takes both in one config variable, which the effort level already
// writes its model's variant into: the briefing joins it and loses nothing.
func TestOpenCodeConfigCarriesTheNoteAndToolsBesideTheEffort(t *testing.T) {
	launch := briefed
	launch.Model, launch.Effort, launch.EffortIsLevel = "anthropic/claude-opus-5-5", "high", true
	var config struct {
		Agent        map[string]map[string]string `json:"agent"`
		Instructions []string                     `json:"instructions"`
		MCP          map[string]struct {
			Type    string   `json:"type"`
			Command []string `json:"command"`
		} `json:"mcp"`
	}
	if err := json.Unmarshal([]byte(launch.Env(AgentOpenCode)[openCodeConfig]), &config); err != nil {
		t.Fatal(err)
	}
	if config.Agent["build"]["variant"] != "high" {
		t.Fatalf("the effort level was lost: %+v", config.Agent)
	}
	if !reflect.DeepEqual(config.Instructions, []string{briefed.Note}) {
		t.Fatalf("instructions = %q", config.Instructions)
	}
	if server := config.MCP[ToolsServer]; server.Type != "local" || !reflect.DeepEqual(server.Command, briefed.Tools) {
		t.Fatalf("mcp = %+v", config.MCP)
	}
}

// A folder session gets no note (the folder is the person's), and an agent
// whose CLI has no checked way in gets nothing on its command line.
func TestNothingIsHandedWhereThereIsNothingOrNoWayIn(t *testing.T) {
	tools := Launch{Tools: briefed.Tools}
	if got := tools.Args(AgentCodex); !strings.Contains(strings.Join(got, " "), "runner --skill") || strings.Contains(strings.Join(got, " "), "Read ") {
		t.Fatalf("a folder session's codex argv = %q", got)
	}
	if env := (Launch{}).Env(AgentOpenCode); env != nil {
		t.Fatalf("an unbriefed OpenCode launch sets %v", env)
	}
	if got := (Launch{}).Args(AgentCodex); len(got) != 1 || got[0] != "--no-daemon" {
		t.Fatalf("an unbriefed codex argv = %q", got)
	}
	for _, agent := range []Agent{AgentGrok, AgentPi} {
		if got := strings.Join(briefed.Args(agent), " "); strings.Contains(got, "mcp") || strings.Contains(got, "CLAUDE.md") {
			t.Fatalf("%s argv = %q", agent, got)
		}
	}
}
