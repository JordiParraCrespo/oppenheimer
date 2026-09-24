package domain

import (
	"sort"
	"strings"
)

// Launch is how a session's agent was started: the structured choices
// `session.create` carries (01-protocol), kept on the session so a restart
// reproduces the launch without asking anyone.
type Launch struct {
	Model      string `json:"model,omitempty"`
	Permission string `json:"permission,omitempty"`
	Effort     string `json:"effort,omitempty"`
	// Prompt is the first task, appended as the trailing positional so it is
	// in the process's arguments before it starts (02-runner §5). It is kept
	// for restart only and never logged.
	Prompt string `json:"prompt,omitempty"`
}

// launchMap is one agent's `launch` entry of the catalog
// (`packages/shared/src/agents/catalog.ts`): argument *vectors* per choice, so
// the runner concatenates and never parses, and a value needing quoting cannot
// become a second word. The table itself is `launch_catalog.gen.go`, written
// from the catalog by `packages/shared/scripts/emit-agent-catalog.cjs` at the
// shared package's build and checked against it by `catalog.spec.ts`, so the
// next catalog edit reaches this host or fails the build — never drifts.
type launchMap struct {
	command    string
	model      []string
	permission map[string][]string
	// permissionEnv is set on the agent's process per permission level, for
	// a CLI whose approvals are configuration rather than a flag (OpenCode).
	permissionEnv map[string]map[string]string
	effort        map[string][]string
	prompt        []string
}

// AgentFromCatalogID maps a catalog agent id (`claude-code`, `codex`,
// `opencode`, `shell`) onto this runner's agent; the ids are the catalog's
// `CODING_AGENT_IDS`.
func AgentFromCatalogID(id string) (Agent, bool) {
	switch id {
	case "claude-code":
		return AgentClaude, true
	case "codex":
		return AgentCodex, true
	case "opencode":
		return AgentOpenCode, true
	case "shell":
		return AgentShell, true
	}
	return "", false
}

// CatalogID is the inverse, for snapshots the control plane reads.
func (a Agent) CatalogID() string {
	switch a {
	case AgentCodex:
		return "codex"
	case AgentOpenCode:
		return "opencode"
	case AgentShell:
		return "shell"
	}
	return "claude-code"
}

// Env is the environment the launch sets on the agent's process: the
// catalog's `permissionEnv` for the chosen level, or nil.
func (l Launch) Env(agent Agent) map[string]string {
	m, ok := launchCatalog[agent.CatalogID()]
	if !ok || agent == AgentShell {
		return nil
	}
	env := m.permissionEnv[l.Permission]
	if len(env) == 0 {
		return nil
	}
	return env
}

// Args turns the launch into the argument vector appended to the agent's
// command. A choice the catalog has no entry for is **dropped**, never a
// reason to refuse the session: a thinking budget is not worth a failed launch,
// and the console has already hidden a control the catalog declares nothing
// for. The prompt is always last.
func (l Launch) Args(agent Agent) []string {
	m, ok := launchCatalog[agent.CatalogID()]
	if !ok || agent == AgentShell {
		return nil
	}
	var args []string
	if l.Model != "" && m.model != nil {
		args = append(args, substitute(m.model, "<model>", l.Model)...)
	}
	if v, ok := m.permission[l.Permission]; ok {
		args = append(args, v...)
	}
	if v, ok := m.effort[l.Effort]; ok {
		args = append(args, v...)
	}
	if l.Prompt != "" && m.prompt != nil {
		args = append(args, substitute(m.prompt, "<prompt>", l.Prompt)...)
	}
	return args
}

func substitute(vector []string, placeholder, value string) []string {
	out := make([]string, len(vector))
	for i, word := range vector {
		if word == placeholder {
			out[i] = value
		} else {
			out[i] = word
		}
	}
	return out
}

// CommandLine is the one string tmux runs in window 0: the agent's command
// and the launch argv, each word quoted for a POSIX shell so a prompt with
// spaces, quotes or a `$` stays one argument. Empty for the plain shell.
//
// A launch that sets environment is prefixed with `env NAME=value …`: env(1)
// rather than a shell assignment, because tmux hands the line to the user's
// own shell and not every shell spells assignments the POSIX way, and on the
// command line rather than in the tmux session's environment, so only window
// 0 gets it and a shell tab opened beside the agent does not.
func (l Launch) CommandLine(agent Agent) string {
	if agent == AgentShell {
		return ""
	}
	m, ok := launchCatalog[agent.CatalogID()]
	if !ok {
		return agent.Command()
	}
	var words []string
	if env := l.Env(agent); env != nil {
		names := make([]string, 0, len(env))
		for name := range env {
			names = append(names, name)
		}
		sort.Strings(names)
		words = append(words, "env")
		for _, name := range names {
			words = append(words, name+"="+env[name])
		}
	}
	words = append(words, m.command)
	words = append(words, l.Args(agent)...)
	quoted := make([]string, len(words))
	for i, word := range words {
		quoted[i] = shellQuote(word)
	}
	return strings.Join(quoted, " ")
}

// shellQuote single-quotes a word for sh; the only character a single-quoted
// word cannot contain is the quote itself, which is spelled '\”.
func shellQuote(word string) string {
	if word == "" {
		return "''"
	}
	safe := true
	for _, r := range word {
		letter := r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z'
		digit := r >= '0' && r <= '9'
		if !letter && !digit && !strings.ContainsRune("-_./=:@,+", r) {
			safe = false
			break
		}
	}
	if safe {
		return word
	}
	return "'" + strings.ReplaceAll(word, "'", `'\''`) + "'"
}
