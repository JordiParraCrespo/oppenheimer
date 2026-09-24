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
	permission map[string]launchLevel
	effort     map[string][]string
	prompt     []string
}

// launchLevel is one permission level: the argv appended to the command and
// the environment set on the agent's process. The two are one value because
// together they are the level — an OpenCode Ask is all environment, and
// without it OpenCode allows everything — so nothing here can emit one half.
type launchLevel struct {
	argv []string
	env  map[string]string
}

// LoginTarget is one vendor login an agent's screen may show: a host,
// compared for equality, and a path the URL's path must start with when set.
type LoginTarget struct {
	Host string
	Path string
}

// LoginTargets are the logins this agent's screen may turn into a button, from
// the catalog; none for the blank terminal or an agent the catalog lacks.
func (a Agent) LoginTargets() []LoginTarget {
	return loginTargets[a.CatalogID()]
}

// Args turns the launch into the argument vector appended to the agent's
// command. A choice the catalog has no entry for is **dropped**, never a
// reason to refuse the session: a thinking budget is not worth a failed launch,
// and the console has already hidden a control the catalog declares nothing
// for. The prompt is always last.
func (l Launch) Args(agent Agent) []string {
	m, ok := launchCatalog[agent.CatalogID()]
	if !ok {
		return nil
	}
	var args []string
	if l.Model != "" && m.model != nil {
		args = append(args, substitute(m.model, "<model>", l.Model)...)
	}
	args = append(args, m.permission[l.Permission].argv...)
	if v, ok := m.effort[l.Effort]; ok {
		args = append(args, v...)
	}
	if l.Prompt != "" && m.prompt != nil {
		args = append(args, substitute(m.prompt, "<prompt>", l.Prompt)...)
	}
	return args
}

// Env is the environment the chosen permission level sets on the agent's
// process, or nil.
func (l Launch) Env(agent Agent) map[string]string {
	return launchCatalog[agent.CatalogID()].permission[l.Permission].env
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

// CommandLine is the one string tmux runs in window 0: the level's
// environment, the agent's command and the launch argv, each word quoted for a
// POSIX shell so a prompt with spaces, quotes or a `$` stays one argument.
// Empty when there is nothing to launch — the blank terminal, whose command is
// empty, or an agent the catalog has no row for — and tmux starts the login
// shell.
//
// Environment is spelled `env NAME=value …`: env(1) rather than a shell
// assignment, because tmux hands the line to the user's own shell and not
// every shell spells assignments the POSIX way, and on the command line rather
// than in the tmux session's environment, so only window 0 gets it and a
// shell tab opened beside the agent does not.
func (l Launch) CommandLine(agent Agent) string {
	command := agent.Command()
	if command == "" {
		return ""
	}
	var words []string
	if env := l.Env(agent); len(env) > 0 {
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
	words = append(words, command)
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
