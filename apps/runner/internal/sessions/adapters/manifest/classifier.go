// Package manifest reads a captured screen and says what the session is
// doing. It is the "screen manifest" of the design notes: a small set of
// rules per agent over the last lines of the pane, plus the one link the
// console is allowed to turn into a button.
//
// It is deliberately conservative. `unknown` is a legitimate answer and the
// sidebar shows it as such; guessing `idle` for a long unattended run would
// be worse than admitting we cannot tell.
package manifest

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Classifier = (*Classifier)(nil)

// tailLines is how much of the pane the rules look at. The state is always in
// the last few lines; reading the whole scrollback would match old output.
const tailLines = 12

// loginTargets is the allowlist of vendor logins whose URL becomes a button.
// Anything else stays plain text, however much it looks like a link: the
// agent's output is untrusted, and a clickable link is an action (F3).
//
// The host is compared for equality, never by substring. `claude.ai` and
// `claude.ai.attacker.test` differ by a suffix, and a Contains check would
// hand a person a button to the second one.
var loginTargets = []struct {
	host string
	// path, when set, must prefix the URL's path: GitHub is only a login
	// host at /login/device.
	path string
}{
	{host: "claude.ai"},
	{host: "console.anthropic.com"},
	{host: "auth.openai.com"},
	{host: "platform.openai.com"},
	{host: "chatgpt.com"},
	{host: "github.com", path: "/login/device"},
}

var urlPattern = regexp.MustCompile(`https://[^\s"'<>)]+`)

// Rules that say the agent is waiting for the person.
var blockedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bdo you want to (proceed|continue|allow)\b`),
	regexp.MustCompile(`(?i)[(\[]?\b(y/n|yes/no)\b[)\]]?`),
	regexp.MustCompile(`(?i)^\s*\d\.\s+(yes|no)\b`),
	regexp.MustCompile(`(?i)\bpress enter to (continue|confirm)\b`),
	regexp.MustCompile(`(?i)\bwaiting for (your )?(input|approval|confirmation)\b`),
	regexp.MustCompile(`(?i)\bpaste (the )?code\b`),
	regexp.MustCompile(`(?i)\b(permission|approval) (needed|required)\b`),
}

// Rules that say the agent is working.
var workingPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(thinking|working|running|building|searching|editing|analyzing|analysing)\b\s*[.…]`),
	regexp.MustCompile(`(?i)esc to interrupt`),
	regexp.MustCompile(`(?i)\((\d+s|\d+m\s?\d*s?)\s*·`),
	regexp.MustCompile(`[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]`), // a braille spinner is still a spinner
}

// Rules that say a turn finished.
var donePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bdone\b.*\((\d+)\s*(files?|changes?|edits?)\)`),
	regexp.MustCompile(`(?i)^\s*✓\s`),
	regexp.MustCompile(`(?i)\bcompleted\b`),
}

// promptPatterns say the agent is up and waiting for a task, which is idle.
var promptPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?m)^\s*(>|❯|›)\s*$`),
	regexp.MustCompile(`(?i)\btry "`),
	regexp.MustCompile(`(?i)\bwhat would you like\b`),
}

// shellPrompt recognises a plain shell waiting at the end of the pane.
var shellPrompt = regexp.MustCompile(`(?m)[$#%❯]\s*$`)

// Classifier applies the rules.
type Classifier struct{}

// New builds the classifier.
func New() *Classifier { return &Classifier{} }

// Classify returns the state and, when the screen shows one, a vendor login
// URL. The order is the order of urgency: a login prompt and a question both
// mean nothing happens until a person acts, so they win over "working".
func (c *Classifier) Classify(screen string, agent domain.Agent) (domain.State, string) {
	tail := lastLines(screen, tailLines)
	if strings.TrimSpace(tail) == "" {
		return domain.StateUnknown, ""
	}
	loginURL := LoginURL(tail)

	switch {
	case loginURL != "":
		return domain.StateBlocked, loginURL
	case matchesAny(tail, blockedPatterns):
		return domain.StateBlocked, ""
	case matchesAny(tail, workingPatterns):
		return domain.StateWorking, ""
	case matchesAny(tail, donePatterns):
		return domain.StateDone, ""
	case matchesAny(tail, promptPatterns):
		return domain.StateIdle, ""
	case agent == domain.AgentShell && shellPrompt.MatchString(tail):
		return domain.StateIdle, ""
	default:
		return domain.StateUnknown, ""
	}
}

// LoginURL returns the first URL on an allowlisted vendor login host, or "".
// It is exported because the same allowlist decides what the console may
// render as a button.
func LoginURL(screen string) string {
	for _, candidate := range urlPattern.FindAllString(screen, -1) {
		trimmed := strings.TrimRight(candidate, ".,;:)]}'\"")
		parsed, err := url.Parse(trimmed)
		if err != nil || parsed.Scheme != "https" {
			continue
		}
		host := strings.ToLower(parsed.Hostname())
		for _, target := range loginTargets {
			if host != target.host {
				continue
			}
			if target.path != "" && !strings.HasPrefix(parsed.Path, target.path) {
				continue
			}
			return trimmed
		}
	}
	return ""
}

func matchesAny(text string, patterns []*regexp.Regexp) bool {
	for _, pattern := range patterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}

func lastLines(text string, n int) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	// Blank trailing lines are what a full-screen TUI leaves behind; the
	// state is above them.
	end := len(lines)
	for end > 0 && strings.TrimSpace(lines[end-1]) == "" {
		end--
	}
	start := end - n
	if start < 0 {
		start = 0
	}
	return strings.Join(lines[start:end], "\n")
}
