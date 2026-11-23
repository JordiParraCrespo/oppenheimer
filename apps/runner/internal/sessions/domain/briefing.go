package domain

import (
	"encoding/json"
	"strings"
)

// ToolsServer is the name the runner's MCP server is registered under in
// each agent's configuration.
const ToolsServer = "oppenheimer"

// briefingArgs is how a launch hands the agent the session note and the
// runner's MCP server on its command line, spelled the agent's own way, and
// added to what the person configured rather than replacing it:
//
//   - Claude Code finds the note itself (NoteFile) and takes the server as
//     `--mcp-config`, which adds to the person's own servers.
//   - Codex reads AGENTS.md only from its checkout down, never the session's
//     folder above it, so it is told where the note is in
//     `developer_instructions`, which sits beside the repository's own
//     AGENTS.md; the server is a `-c mcp_servers.<name>` override.
//   - OpenCode takes both in its config, which is an environment variable
//     (briefingConfig).
//
// The other agents get neither: their CLIs have no way in that has been
// checked.
func (l Launch) briefingArgs(agent Agent) []string {
	switch agent {
	case AgentClaude:
		if len(l.Tools) == 0 {
			return nil
		}
		config, _ := json.Marshal(map[string]any{"mcpServers": map[string]any{
			ToolsServer: map[string]any{"type": "stdio", "command": l.Tools[0], "args": l.Tools[1:]},
		}})
		// One word: the flag takes several values, so a prompt after a
		// separate value would be read as another config file.
		return []string{"--mcp-config=" + string(config)}
	case AgentCodex:
		var args []string
		if l.Note != "" || len(l.Tools) > 0 {
			args = append(args, "-c", "developer_instructions="+tomlString(l.briefing()))
		}
		if len(l.Tools) > 0 {
			args = append(args,
				"-c", "mcp_servers."+ToolsServer+".command="+tomlString(l.Tools[0]),
				"-c", "mcp_servers."+ToolsServer+".args="+tomlStrings(l.Tools[1:]))
		}
		return args
	}
	return nil
}

// briefingConfig merges the note and the server into OpenCode's config
// content: config is what the effort level already put there (its `agent`
// key), or "". It is returned unchanged when there is nothing to add, or
// when it is not a JSON object, which would make OpenCode refuse the launch
// either way.
func (l Launch) briefingConfig(config string) string {
	if l.Note == "" && len(l.Tools) == 0 {
		return config
	}
	merged := map[string]any{}
	if config != "" {
		if err := json.Unmarshal([]byte(config), &merged); err != nil {
			return config
		}
	}
	if l.Note != "" {
		merged["instructions"] = []string{l.Note}
	}
	if len(l.Tools) > 0 {
		merged["mcp"] = map[string]any{ToolsServer: map[string]any{"type": "local", "command": l.Tools}}
	}
	encoded, err := json.Marshal(merged)
	if err != nil {
		return config
	}
	return string(encoded)
}

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
