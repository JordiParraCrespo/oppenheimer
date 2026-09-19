// Package manifest decides what a session is doing by reading its screen.
//
// The runner has no API into Claude Code or Codex — no hook, no exit code,
// nothing but the terminal. A manifest is the file that says how one agent's
// terminal looks in each state: a list of rules, each naming the region it
// reads, the patterns that make it match, the patterns that veto it, and a
// priority so that adding a rule cannot silently reorder the others.
//
// Manifests are data, not code, for two reasons. Agents change their screens
// often — a new spinner glyph in a point release breaks detection — and a data
// file can be replaced without building, signing and rolling out a binary to
// every host. And one agent is a rule set, while five agents are a treadmill:
// keeping that current should not be a release.
//
// The format is ours. The shape of it — regions, priorities, negative guards,
// the terminal title as the most trustworthy signal — is what reading herdr's
// detection engine taught us (product/13-lessons-from-herdr.md).
package manifest

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Schema is the value every manifest carries, so an old runner rejects a
// future format instead of misreading it.
const Schema = "oppenheimer.manifest/v1"

// Engine is what this build of the runner can evaluate. A manifest that needs
// more is skipped, not failed: the host keeps working on the rules it has
// while a newer runner picks up the rest.
const Engine = 1

// Errors from parsing and validating a manifest.
var (
	ErrSchema  = errors.New("manifest: unknown schema")
	ErrAgent   = errors.New("manifest: no agent id")
	ErrRules   = errors.New("manifest: no rules")
	ErrRuleID  = errors.New("manifest: duplicate rule id")
	ErrState   = errors.New("manifest: unknown state")
	ErrRegion  = errors.New("manifest: unknown region")
	ErrPattern = errors.New("manifest: rule has no patterns")
	ErrNewer   = errors.New("manifest: needs a newer engine")
)

// Manifest is one agent's rules.
type Manifest struct {
	Schema string `json:"schema"`
	// Agent is the agent these rules describe, matching domain.Agent.
	Agent domain.Agent `json:"agent"`
	// Version is the manifest's own version, independent of the runner's.
	// Date-based, because that is what a person comparing two of them wants
	// to know.
	Version string `json:"version"`
	// MinEngine is the engine version these rules need.
	MinEngine int `json:"minEngine"`
	// Notes explains, for the human editing the file, what the agent's
	// screen looks like and where the rules came from.
	Notes string `json:"notes,omitempty"`
	Rules []Rule `json:"rules"`
}

// Rule is one signal on the screen.
type Rule struct {
	// ID names the rule in a report and in a test failure.
	ID string `json:"id"`
	// State is what this rule concludes when it matches.
	State domain.State `json:"state"`
	// Priority breaks ties: the highest match wins. A question outranks a
	// spinner, because a spinner frame is usually still on screen under a
	// question that has just appeared.
	Priority int `json:"priority"`
	// Region is where to look: "title", "screen", "bottom:N" or "top:N".
	Region Region `json:"region"`
	// Any matches when at least one pattern hits.
	Any []Pattern `json:"any"`
	// Not vetoes the rule when any of these substrings is in the region,
	// compared case-insensitively. Substrings rather than patterns on
	// purpose: a guard should be obvious to whoever reads the file.
	Not []string `json:"not,omitempty"`
	// Note is why the rule exists, for the next person to edit it.
	Note string `json:"note,omitempty"`

	compiled []*regexp.Regexp
}

// Pattern is a regular expression in a manifest. It is a named type so that
// compiling happens once, at load, and a broken pattern is a load error
// rather than a surprise on some host at three in the morning.
type Pattern string

// Region names a part of the captured terminal.
type Region string

// Regions.
const (
	// RegionTitle is the terminal title the agent sets with an escape
	// sequence. It is the most trustworthy signal there is: the agent
	// controls it, it is one short string, and nothing a person types into
	// their prompt can appear in it.
	RegionTitle Region = "title"
	// RegionScreen is the whole visible pane.
	RegionScreen Region = "screen"
	// RegionBottom is "bottom:N", the last N non-empty lines — where an
	// agent draws its status, its question or its prompt.
	RegionBottom Region = "bottom"
	// RegionTop is "top:N", the first N non-empty lines, for the banner an
	// agent prints when it starts.
	RegionTop Region = "top"
)

// parse splits "bottom:12" into its kind and count.
func (r Region) parse() (kind Region, n int, err error) {
	name, count, hasCount := strings.Cut(string(r), ":")
	switch Region(name) {
	case RegionTitle, RegionScreen:
		if hasCount {
			return "", 0, fmt.Errorf("%w: %q takes no count", ErrRegion, r)
		}
		return Region(name), 0, nil
	case RegionBottom, RegionTop:
		if !hasCount {
			return "", 0, fmt.Errorf("%w: %q needs a line count", ErrRegion, r)
		}
		n, convErr := strconv.Atoi(count)
		if convErr != nil || n <= 0 || n > 500 {
			return "", 0, fmt.Errorf("%w: %q needs a line count between 1 and 500", ErrRegion, r)
		}
		return Region(name), n, nil
	default:
		return "", 0, fmt.Errorf("%w: %q", ErrRegion, r)
	}
}

// knownStates are the states a rule may conclude. Lifecycle states
// (`starting`, `stopped`, `closed`) are the runner's business, never a
// screen's.
var knownStates = map[domain.State]bool{
	domain.StateWorking: true,
	domain.StateBlocked: true,
	domain.StateDone:    true,
	domain.StateIdle:    true,
	domain.StateUnknown: true,
}

// Parse reads a manifest and compiles it. Everything that can be wrong with a
// manifest is wrong here, at load, rather than on a host in the middle of a
// session.
func Parse(raw []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("manifest: %w", err)
	}
	if m.Schema != Schema {
		return nil, fmt.Errorf("%w: %q", ErrSchema, m.Schema)
	}
	if m.MinEngine > Engine {
		return nil, fmt.Errorf("%w: %s needs engine %d, this runner has %d",
			ErrNewer, m.Agent, m.MinEngine, Engine)
	}
	if m.Agent == "" {
		return nil, ErrAgent
	}
	if len(m.Rules) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrRules, m.Agent)
	}

	seen := map[string]bool{}
	for i := range m.Rules {
		rule := &m.Rules[i]
		switch {
		case rule.ID == "":
			return nil, fmt.Errorf("manifest %s: rule %d has no id", m.Agent, i)
		case seen[rule.ID]:
			return nil, fmt.Errorf("%w: %s/%s", ErrRuleID, m.Agent, rule.ID)
		case !knownStates[rule.State]:
			return nil, fmt.Errorf("%w: %s/%s concludes %q", ErrState, m.Agent, rule.ID, rule.State)
		case len(rule.Any) == 0:
			return nil, fmt.Errorf("%w: %s/%s", ErrPattern, m.Agent, rule.ID)
		}
		seen[rule.ID] = true

		if _, _, err := rule.Region.parse(); err != nil {
			return nil, fmt.Errorf("%s/%s: %w", m.Agent, rule.ID, err)
		}
		rule.compiled = make([]*regexp.Regexp, 0, len(rule.Any))
		for _, pattern := range rule.Any {
			compiled, err := regexp.Compile(string(pattern))
			if err != nil {
				return nil, fmt.Errorf("%s/%s: pattern %q: %w", m.Agent, rule.ID, pattern, err)
			}
			rule.compiled = append(rule.compiled, compiled)
		}
		for i, guard := range rule.Not {
			rule.Not[i] = strings.ToLower(guard)
		}
	}
	return &m, nil
}

// matches reports whether a rule fires against the text of its region.
func (r *Rule) matches(text string) bool {
	if strings.TrimSpace(text) == "" {
		return false
	}
	lower := strings.ToLower(text)
	for _, guard := range r.Not {
		if strings.Contains(lower, guard) {
			return false
		}
	}
	for _, pattern := range r.compiled {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}
