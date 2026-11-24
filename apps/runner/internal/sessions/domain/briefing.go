package domain

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

// ToolsServer is the name the runner's MCP server is registered under in
// each agent's configuration.
const ToolsServer = "oppenheimer"

// LongestToolCall is the longest a call to the runner's MCP server may take:
// a wait on child sessions, capped there. An agent that bounds a tool call
// is told to allow it.
const LongestToolCall = 30 * time.Minute

// briefingDelta is what a launch adds to hand the agent the session note
// and the runner's MCP server: words for its command line and variables for
// its environment.
type briefingDelta struct {
	args []string
	env  map[string]string
}

// briefingFor is the one place each agent's way in is spelled, added to what
// the person configured rather than replacing it; Args and Env only apply
// it. env is what the launch's levels already set, for an agent whose way in
// is a variable those may have written first.
//
//   - Claude Code finds the note itself (NoteFile) and takes the server as
//     `--mcp-config`, which adds to the person's own servers.
//   - Codex reads AGENTS.md only from its checkout down, never the session's
//     folder above it, so it is told where the note is in
//     `developer_instructions`, which sits beside the repository's own
//     AGENTS.md and after the value the override would otherwise replace
//     (OwnInstructions); the server is a `-c mcp_servers.<name>` override.
//   - OpenCode takes both in its config content, an environment variable
//     the effort level writes its `agent` key into.
//
// The other agents get neither: their CLIs have no way in that has been
// checked.
func (l Launch) briefingFor(agent Agent, env map[string]string) briefingDelta {
	if l.Note == "" && len(l.Tools) == 0 {
		return briefingDelta{}
	}
	switch agent {
	case AgentClaude:
		if len(l.Tools) == 0 {
			return briefingDelta{}
		}
		config, _ := json.Marshal(map[string]any{"mcpServers": map[string]any{
			ToolsServer: map[string]any{"type": "stdio", "command": l.Tools[0], "args": l.Tools[1:]},
		}})
		// One word: the flag takes several values, so a prompt after a
		// separate value would be read as another config file.
		return briefingDelta{args: []string{"--mcp-config=" + string(config)}}
	case AgentCodex:
		instructions := l.briefing()
		if own := strings.TrimSpace(l.OwnInstructions); own != "" {
			instructions = own + "\n\n" + instructions
		}
		args := []string{"-c", "developer_instructions=" + tomlString(instructions)}
		if len(l.Tools) > 0 {
			args = append(args,
				"-c", "mcp_servers."+ToolsServer+".command="+tomlString(l.Tools[0]),
				"-c", "mcp_servers."+ToolsServer+".args="+tomlStrings(l.Tools[1:]),
				// Codex gives a tool call 60 s; a wait may take its longest.
				"-c", "mcp_servers."+ToolsServer+".tool_timeout_sec="+strconv.Itoa(int(toolCallBound().Seconds())))
		}
		return briefingDelta{args: args}
	case AgentOpenCode:
		config, ok := l.openCodeConfig(env[openCodeConfig])
		if !ok {
			return briefingDelta{}
		}
		return briefingDelta{env: map[string]string{openCodeConfig: config}}
	}
	return briefingDelta{}
}

// openCodeConfig merges the note and the server into OpenCode's config
// content, config being what the levels already put there or "". It is not
// ok when that is not a JSON object, which OpenCode would refuse either way,
// so it is left as it was.
func (l Launch) openCodeConfig(config string) (string, bool) {
	merged := map[string]any{}
	if config != "" {
		if err := json.Unmarshal([]byte(config), &merged); err != nil {
			return "", false
		}
	}
	if l.Note != "" {
		merged["instructions"] = []string{l.Note}
	}
	if len(l.Tools) > 0 {
		// OpenCode bounds a request to the server, a tool call included, to
		// `timeout` ms, 5 s unless set; a wait may take its longest.
		merged["mcp"] = map[string]any{ToolsServer: map[string]any{
			"type": "local", "command": l.Tools, "timeout": toolCallBound().Milliseconds(),
		}}
		// OpenCode allows a tool no rule names, and the permission levels
		// short of Full name only its own tools. Starting an agent was a
		// shell command those levels ask about, so the server's tools ask
		// too; Full allows them, as it allows the shell.
		if l.Permission != "full" {
			rules, _ := merged["permission"].(map[string]any)
			if rules == nil {
				rules = map[string]any{}
			}
			rules[ToolsServer+"_*"] = "ask"
			merged["permission"] = rules
		}
	}
	encoded, err := json.Marshal(merged)
	if err != nil {
		return "", false
	}
	return string(encoded), true
}

// toolCallBound is what an agent that bounds a tool call is told to allow:
// the longest call, and a minute for the answer to come back.
func toolCallBound() time.Duration { return LongestToolCall + time.Minute }

// openCodeConfig is the variable OpenCode reads config content from, on top
// of the person's own config files.
const openCodeConfig = "OPENCODE_CONFIG_CONTENT"

// briefing is the line an agent that does not read the note itself is
// given: where the note is, and what the runner offers it.
func (l Launch) briefing() string {
	var b strings.Builder
	b.WriteString("You are running in an Oppenheimer session: a terminal on this host that the person watches from their browser.")
	if l.Note != "" {
		b.WriteString(" Read " + l.Note + " before you start: it says how this session is set up and what to do when you finish a task.")
	}
	b.WriteString(" The `runner` command lets you start other agents, tell the person, send them a file and be woken later; run `runner --skill` once for how.")
	if len(l.Tools) > 0 {
		b.WriteString(" The same commands are the tools of the `" + ToolsServer + "` MCP server.")
	}
	return b.String()
}

// tomlString is a TOML basic string. JSON's string escapes are all valid in
// one, so the encoder does the quoting.
func tomlString(value string) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

// tomlStrings is a TOML array of basic strings, which a JSON array of
// strings also is.
func tomlStrings(values []string) string {
	if values == nil {
		values = []string{}
	}
	encoded, _ := json.Marshal(values)
	return string(encoded)
}
