package manifest

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Classifier = (*Classifier)(nil)

// bundled are the manifests compiled into the binary. They are the floor: a
// runner with no control plane, no network and an empty disk still classifies
// its sessions. Anything newer is loaded over the top (see Options.Dir).
//
//go:embed manifests/*.json
var bundled embed.FS

// Classifier evaluates the loaded manifests against a captured screen.
type Classifier struct {
	byAgent map[domain.Agent]*Manifest
	logger  *slog.Logger
}

// Options configure loading.
type Options struct {
	// Dir holds manifests that override the bundled ones by agent id, which
	// is how the control plane ships a fix for an agent's new spinner
	// without a runner release. A missing directory is not an error.
	Dir string
	// Logger reports a manifest that was skipped and why; nil discards.
	Logger *slog.Logger
}

// New loads the bundled manifests, then anything in Options.Dir on top.
// A manifest that does not parse is skipped with a reason rather than taking
// the runner down: one bad file must not stop a host classifying the agents
// whose files are fine.
func New(opts Options) *Classifier {
	logger := opts.Logger
	if logger == nil {
		logger = slog.New(slog.DiscardHandler)
	}
	c := &Classifier{byAgent: map[domain.Agent]*Manifest{}, logger: logger}

	c.load(bundled, "manifests", "bundled")
	if opts.Dir != "" {
		c.load(os.DirFS(opts.Dir), ".", opts.Dir)
	}
	return c
}

func (c *Classifier) load(fsys fs.FS, dir, source string) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			c.logger.Warn("could not read manifests", slog.String("source", source), slog.Any("error", err))
		}
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := fs.ReadFile(fsys, filepath.Join(dir, entry.Name()))
		if err != nil {
			c.logger.Warn("could not read a manifest",
				slog.String("source", source), slog.String("file", entry.Name()), slog.Any("error", err))
			continue
		}
		parsed, err := Parse(raw)
		if err != nil {
			c.logger.Warn("ignoring a manifest",
				slog.String("source", source), slog.String("file", entry.Name()), slog.Any("error", err))
			continue
		}
		c.byAgent[parsed.Agent] = parsed
	}
}

// Manifest returns the rules loaded for an agent, for `runner status` and for
// tests that want to see which version is in force.
func (c *Classifier) Manifest(agent domain.Agent) (*Manifest, bool) {
	m, ok := c.byAgent[agent]
	return m, ok
}

// Classify reads a screen and says what the session is doing, plus the vendor
// login URL when the screen is showing one.
//
// A login prompt outranks every rule: until a person opens that link, nothing
// else on the screen is going to change. Only *this agent's* logins count: a
// blank terminal has none, so a URL somebody prints in one is just text, and
// never a snapshot the control plane would refuse.
func (c *Classifier) Classify(screen app.Screen, agent domain.Agent) (domain.State, string) {
	if login := LoginURL(screen.Body, agent.LoginTargets()); login != "" {
		return domain.StateBlocked, login
	}
	manifest, ok := c.byAgent[agent]
	if !ok {
		return domain.StateUnknown, ""
	}

	best := -1
	state := domain.StateUnknown
	for i := range manifest.Rules {
		rule := &manifest.Rules[i]
		if rule.Priority <= best {
			continue
		}
		if rule.matches(region(screen, rule.Region)) {
			best, state = rule.Priority, rule.State
		}
	}
	return state, ""
}

// region extracts the text a rule reads.
func region(screen app.Screen, r Region) string {
	kind, n, err := r.parse()
	if err != nil {
		// Parse rejects these at load; a rule that got here with a bad
		// region simply never matches.
		return ""
	}
	switch kind {
	case RegionTitle:
		return screen.Title
	case RegionScreen:
		return screen.Body
	case RegionBottom:
		return edgeLines(screen.Body, n, true)
	case RegionTop:
		return edgeLines(screen.Body, n, false)
	}
	return ""
}

// edgeLines returns the first or last n non-empty lines. Blank lines at the
// end are what a full-screen TUI leaves behind, and the state is above them;
// counting them would push the interesting lines out of the window.
func edgeLines(text string, n int, fromBottom bool) string {
	var lines []string
	for _, line := range strings.Split(text, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) > n {
		if fromBottom {
			lines = lines[len(lines)-n:]
		} else {
			lines = lines[:n]
		}
	}
	return strings.Join(lines, "\n")
}

var urlPattern = regexp.MustCompile(`https://[^\s"'<>)]+`)

// LoginURL returns the first URL on one of targets, or "".
//
// The targets are the agent's catalog entry (`domain.Agent.LoginTargets`,
// generated from `packages/shared/src/agents/catalog.ts`), which is also what
// the link's own check is built from, so the runner and the control plane
// cannot disagree about what a login is. It is code, not manifest data, on
// purpose: a manifest may one day arrive over the network, and what the
// console is allowed to turn into a clickable link must not travel with it.
//
// The host is compared for equality, never by substring: `claude.ai` and
// `claude.ai.attacker.test` differ by a suffix, and a Contains check would
// hand a person a button to the second one (F3).
func LoginURL(screen string, targets []domain.LoginTarget) string {
	if len(targets) == 0 {
		return ""
	}
	for _, candidate := range urlPattern.FindAllString(screen, -1) {
		trimmed := strings.TrimRight(candidate, ".,;:)]}'\"")
		parsed, err := url.Parse(trimmed)
		if err != nil || parsed.Scheme != "https" {
			continue
		}
		host := strings.ToLower(parsed.Hostname())
		for _, target := range targets {
			if host != target.Host || !pathMatches(parsed.Path, target.Path) {
				continue
			}
			return trimmed
		}
	}
	return ""
}

// Bundled reads the manifests compiled into this binary, for tests and for
// `runner status`.
func Bundled() ([]*Manifest, error) {
	entries, err := fs.ReadDir(bundled, "manifests")
	if err != nil {
		return nil, err
	}
	out := make([]*Manifest, 0, len(entries))
	for _, entry := range entries {
		raw, err := fs.ReadFile(bundled, filepath.Join("manifests", entry.Name()))
		if err != nil {
			return nil, err
		}
		parsed, err := Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", entry.Name(), err)
		}
		out = append(out, parsed)
	}
	return out, nil
}

// pathMatches reports whether path is the target's path or continues it at a
// segment boundary, so `/login/device` admits `/login/device/abc` and not
// `/login/devicefoo`. An empty target path admits any path.
func pathMatches(path, target string) bool {
	if target == "" || path == target {
		return true
	}
	return strings.HasPrefix(path, strings.TrimSuffix(target, "/")+"/")
}
