// Package manifest reads a captured screen and says what the session is
// doing. It is the "screen manifest" of the design notes.
//
// The engine is a rule table rather than a chain of ifs, and the shape is
// taken from herdr, which has been doing this against a dozen agents for
// longer than we have: every rule declares the region it reads, a priority,
// the patterns that make it match, and the patterns that must *not* be on the
// screen for it to count. The highest-priority match wins, so adding a rule
// cannot silently reorder the others — the failure mode of a chain of ifs.
//
// Two deliberate limits. `unknown` is a legitimate answer: guessing `idle`
// during a long unattended run would be worse than admitting we cannot tell.
// And only vendor login hosts become buttons, compared by exact host, because
// the agent's output is untrusted and a clickable link is an action (F3).
//
// The rules live in Go for now. They want to be versioned data the control
// plane can ship without a runner release — an agent's next release can
// change its spinner — which is what herdr does with per-agent TOML. The
// table below is deliberately shaped so that move is mechanical.
package manifest

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Classifier = (*Classifier)(nil)

// region is the part of the pane a rule reads. The state is always near the
// bottom; reading the whole scrollback matches output that has scrolled away.
type region int

const (
	// tail12 is the last twelve non-empty lines: where an agent draws its
	// status, its question, or its prompt.
	tail12 region = iota
	// tail5 is the last five, for rules that would misfire on anything a
	// person could have typed further up.
	tail5
)

// Priorities. A login prompt and a question both mean nothing happens until a
// person acts, so they outrank "working"; "working" outranks the idle prompt,
// because an agent that is mid-turn also has a prompt box on screen.
const (
	priorityLogin   = 1200
	priorityBlocked = 1000
	priorityWorking = 970
	priorityDone    = 900
	priorityIdle    = 800
)

// rule is one signal on the screen.
type rule struct {
	// id names the rule in a test failure, and will be the key when these
	// become data.
	id       string
	state    domain.State
	priority int
	region   region
	// any matches when at least one pattern hits.
	any []*regexp.Regexp
	// not blocks the rule when any of these (lowercased) strings is on the
	// screen. This is what stops "⠹ Working…" from being reported while the
	// agent is in fact waiting for an answer under it.
	not []string
	// agents limits the rule to some agents; empty means every agent.
	agents []domain.Agent
}

var rules = []rule{
	{
		id: "question", state: domain.StateBlocked, priority: priorityBlocked, region: tail12,
		any: patterns(
			`(?i)\bdo you want to (proceed|continue|allow)\b`,
			`(?i)[(\[]?\b(y/n|yes/no)\b[)\]]?`,
			`(?i)^\s*\d\.\s+(yes|no)\b`,
			`(?i)\bpress enter to (continue|confirm)\b`,
			`(?i)\bwaiting for (your )?(input|approval|confirmation)\b`,
			`(?i)\bpaste (the )?code\b`,
			`(?i)\b(permission|approval) (needed|required)\b`,
		),
	},
	{
		id: "spinner", state: domain.StateWorking, priority: priorityWorking, region: tail12,
		any: patterns(
			`(?i)\b(thinking|working|running|building|searching|editing|analyzing|analysing)\b\s*[.…]`,
			`(?i)esc to interrupt`,
			`(?i)\((\d+s|\d+m\s?\d*s?)\s*·`,
			`[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]`, // a braille spinner is still a spinner
		),
		// A spinner frame can still be on screen under a question that has
		// just appeared. The question is what matters.
		not: []string{
			"do you want to proceed", "do you want to continue", "do you want to allow",
			"waiting for permission", "permission required", "approval required",
			"esc to cancel", "(y/n)",
		},
	},
	{
		id: "turn finished", state: domain.StateDone, priority: priorityDone, region: tail12,
		any: patterns(
			`(?i)\bdone\b.*\((\d+)\s*(files?|changes?|edits?)\)`,
			`(?i)^\s*✓\s`,
			`(?i)\bcompleted\b`,
		),
		not: []string{"esc to interrupt"},
	},
	{
		id: "agent prompt", state: domain.StateIdle, priority: priorityIdle, region: tail5,
		any: patterns(
			`(?m)^\s*(>|❯|›)\s*$`,
			`(?i)\btry "`,
			`(?i)\bwhat would you like\b`,
		),
		not: []string{"esc to interrupt"},
	},
	{
		id: "shell prompt", state: domain.StateIdle, priority: priorityIdle, region: tail5,
		any:    patterns(`(?m)[$#%❯]\s*$`),
		agents: []domain.Agent{domain.AgentShell},
	},
}

// loginTargets is the allowlist of vendor logins whose URL becomes a button.
// The host is compared for equality, never by substring: `claude.ai` and
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

// Classifier applies the rule table.
type Classifier struct{}

// New builds the classifier.
func New() *Classifier { return &Classifier{} }

// Classify returns the state and, when the screen shows one, a vendor login
// URL. A login prompt outranks every rule: nothing happens until a person
// opens it.
func (c *Classifier) Classify(screen string, agent domain.Agent) (domain.State, string) {
	tails := map[region]string{
		tail12: lastLines(screen, 12),
		tail5:  lastLines(screen, 5),
	}
	if strings.TrimSpace(tails[tail12]) == "" {
		return domain.StateUnknown, ""
	}
	if url := LoginURL(tails[tail12]); url != "" {
		return domain.StateBlocked, url
	}

	best := rule{priority: -1}
	for _, r := range rules {
		if !r.appliesTo(agent) || r.priority <= best.priority {
			continue
		}
		if r.matches(tails[r.region]) {
			best = r
		}
	}
	if best.priority < 0 {
		return domain.StateUnknown, ""
	}
	return best.state, ""
}

func (r rule) appliesTo(agent domain.Agent) bool {
	if len(r.agents) == 0 {
		return true
	}
	for _, a := range r.agents {
		if a == agent {
			return true
		}
	}
	return false
}

func (r rule) matches(text string) bool {
	lower := strings.ToLower(text)
	for _, blocker := range r.not {
		if strings.Contains(lower, blocker) {
			return false
		}
	}
	for _, pattern := range r.any {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
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

func patterns(exprs ...string) []*regexp.Regexp {
	out := make([]*regexp.Regexp, 0, len(exprs))
	for _, expr := range exprs {
		out = append(out, regexp.MustCompile(expr))
	}
	return out
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
