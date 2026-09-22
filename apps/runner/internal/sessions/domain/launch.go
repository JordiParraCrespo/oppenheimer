package domain

import "strings"

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

// launchMap mirrors one agent's `launch` entry in
// `packages/shared/src/agents/catalog.ts`: argument *vectors* per choice, so
// the runner concatenates and never parses, and a value needing quoting cannot
// become a second word. The TypeScript file is the source; this table has to
// match it, and `launch_test.go` pins the spellings that matter.
type launchMap struct {
	model      []string
	permission map[string][]string
	effort     map[string][]string
	prompt     []string
}

var launches = map[Agent]launchMap{
	AgentClaude: {
		model: []string{"--model", "<model>"},
		permission: map[string][]string{
			"ask":  {"--permission-mode", "manual"},
			"auto": {"--permission-mode", "acceptEdits"},
			"full": {"--permission-mode", "bypassPermissions"},
		},
		effort: map[string][]string{
			"minimal": {"--effort", "low"},
			"low":     {"--effort", "medium"},
			"medium":  {"--effort", "high"},
			"high":    {"--effort", "xhigh"},
			"max":     {"--effort", "max"},
		},
		prompt: []string{"<prompt>"},
	},
	AgentCodex: {
		model: []string{"--model", "<model>"},
		permission: map[string][]string{
			"ask":  {"--ask-for-approval", "on-request", "--sandbox", "workspace-write"},
			"auto": {"--approve-for-me"},
			"full": {"--dangerously-bypass-approvals-and-sandbox"},
		},
		effort: map[string][]string{
			"minimal": {"-c", "model_reasoning_effort=minimal"},
			"low":     {"-c", "model_reasoning_effort=low"},
			"medium":  {"-c", "model_reasoning_effort=medium"},
			"high":    {"-c", "model_reasoning_effort=high"},
			"max":     {"-c", "model_reasoning_effort=high"},
		},
		prompt: []string{"<prompt>"},
	},
}

// Args turns the launch into the argument vector appended to the agent's
// command. A choice the catalog has no entry for is **dropped**, never a
// reason to refuse the session: a thinking budget is not worth a failed launch,
// and the console has already hidden a control the catalog declares nothing
// for. The prompt is always last.
func (l Launch) Args(agent Agent) []string {
	m, ok := launches[agent]
	if !ok {
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
func (l Launch) CommandLine(agent Agent) string {
	command := agent.Command()
	if command == "" {
		return ""
	}
	words := append([]string{command}, l.Args(agent)...)
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
