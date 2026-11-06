// Package agenttrust tells an agent CLI that a session's folder is one it may
// work in, so the CLI's "do you trust the files in this folder?" question is
// already answered when the session opens.
package agenttrust

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Store is app.Trust over Claude Code's own state file. Other agents have no
// such question this runner answers yet, and are left alone.
type Store struct {
	// claudeConfig is Claude Code's global state, `~/.claude.json`, or
	// `$CLAUDE_CONFIG_DIR/.claude.json` when that is set.
	claudeConfig string
	// claudeProjects is where Claude Code keeps each folder's conversations,
	// `~/.claude/projects` or `$CLAUDE_CONFIG_DIR/projects`.
	claudeProjects string
	logger         *slog.Logger
	mu             sync.Mutex
}

// Options names the files the store edits.
type Options struct {
	ClaudeConfig string
	// ClaudeProjects is Claude Code's `projects` folder, which Forget clears a
	// removed folder's conversations from; empty leaves it alone.
	ClaudeProjects string
	// Logger reports a mark that failed, which the session service drops
	// (app.Trust is best-effort); nil is the process's default logger.
	Logger *slog.Logger
}

// New builds the store.
func New(opts Options) *Store {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Store{claudeConfig: opts.ClaudeConfig, claudeProjects: opts.ClaudeProjects, logger: logger}
}

// Trust records dir as accepted. Claude Code keeps the answer per folder, as
// `projects[<dir>].hasTrustDialogAccepted`; every other key in the file, and
// in that folder's entry, is Claude Code's and is written back untouched.
//
// When dir is a linked worktree, the repository it belongs to is marked too:
// Claude Code reads a worktree's own entry for the question itself, but the
// repository's entry before it lets the repository's `.claude/settings.json`
// pre-approve tools, and without it asks again, in a trusted folder, whether
// to "continue without these permissions".
//
// The write is a temporary file renamed over the old one, so a CLI starting at
// the same moment reads the old file or the new one, never half of either.
//
// The file is written back as Claude Code writes it, two-space JSON; Go
// orders its keys, which Claude Code neither reads nor keeps, since it
// rewrites the whole file itself on every save.
func (s *Store) Trust(agent domain.Agent, dir string) error {
	if agent != domain.AgentClaude || s.claudeConfig == "" {
		return nil
	}
	if err := s.trustClaude(dir); err != nil {
		s.logger.Warn("could not mark the session folder trusted; Claude Code will ask",
			slog.String("dir", dir), slog.Any("error", err))
		return err
	}
	return nil
}

func (s *Store) trustClaude(dir string) error {
	dirs := []string{realPath(dir)}
	if root := repositoryRoot(dirs[0]); root != "" && root != dirs[0] {
		dirs = append(dirs, root)
	}
	return s.editProjects(func(projects map[string]map[string]json.RawMessage) bool {
		changed := false
		for _, dir := range dirs {
			project := projects[dir]
			if project == nil {
				project = map[string]json.RawMessage{}
			}
			var accepted bool
			if json.Unmarshal(project["hasTrustDialogAccepted"], &accepted) == nil && accepted {
				continue
			}
			project["hasTrustDialogAccepted"] = json.RawMessage("true")
			projects[dir] = project
			changed = true
		}
		return changed
	})
}

// editProjects lets change edit Claude Code's per-folder entries,
// `projects` in the state file, and writes them back when it reports a
// change. Trust and Forget are each one change to that map.
func (s *Store) editProjects(change func(projects map[string]map[string]json.RawMessage) bool) error {
	return s.edit(func(root map[string]json.RawMessage) (bool, error) {
		projects := map[string]map[string]json.RawMessage{}
		if existing, ok := root["projects"]; ok {
			if err := json.Unmarshal(existing, &projects); err != nil {
				return false, err
			}
		}
		if projects == nil {
			projects = map[string]map[string]json.RawMessage{}
		}
		if !change(projects) {
			return false, nil
		}
		encoded, err := json.Marshal(projects)
		if err != nil {
			return false, err
		}
		root["projects"] = encoded
		return true, nil
	})
}

// Forget drops what Claude Code keeps about dir, a folder about to be removed
// that nothing will open again (a cloud start's scratch checkout): its entry
// in the state file, which Trust wrote, and the folder of conversations
// Claude Code may have kept for it under `projects/`. Without it every cloud
// start leaves one more of each behind. The repository's own entry, which
// Trust may also have written, is shared with the sessions that live there
// and is kept. Best-effort: a failure is logged, and leaves only litter.
func (s *Store) Forget(dir string) {
	dir = realPath(dir)
	if s.claudeConfig != "" {
		err := s.editProjects(func(projects map[string]map[string]json.RawMessage) bool {
			if _, ok := projects[dir]; !ok {
				return false
			}
			delete(projects, dir)
			return true
		})
		if err != nil {
			s.logger.Warn("could not forget a removed folder in Claude Code's state",
				slog.String("dir", dir), slog.Any("error", err))
		}
	}
	if s.claudeProjects != "" {
		folder := filepath.Join(s.claudeProjects, claudeProjectFolder(dir))
		if err := os.RemoveAll(folder); err != nil {
			s.logger.Warn("could not remove Claude Code's conversations for a removed folder",
				slog.String("folder", folder), slog.Any("error", err))
		}
	}
}

// claudeProjectFolder is dir as Claude Code names its folder under
// `projects/`: every character but a letter or a digit is a dash.
func claudeProjectFolder(dir string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			return r
		}
		return '-'
	}, dir)
}

// cloudSettingsKey is where Claude Code (2.1.31x) keeps this machine's answer
// to "Use this machine's settings in cloud sessions?", which `claude --cloud`
// asks once before it creates a session: "forward" or "keep_local".
const cloudSettingsKey = "remoteHomeSettingsMode"

// KeepCloudSettingsLocal answers Claude Code's "use this machine's settings in
// cloud sessions?" with "No, keep them on this machine" when the person has
// not answered it, so a cloud start with nobody at the terminal is not held on
// the question. That answer is what cloud sessions did before the question
// existed: they keep their own defaults and nothing of the host's is sent. An
// answer already given, either one, is left as it is; `/config` changes it.
func (s *Store) KeepCloudSettingsLocal() error {
	if s.claudeConfig == "" {
		return nil
	}
	err := s.edit(func(root map[string]json.RawMessage) (bool, error) {
		var mode string
		if json.Unmarshal(root[cloudSettingsKey], &mode) == nil && (mode == "forward" || mode == "keep_local") {
			return false, nil
		}
		root[cloudSettingsKey] = json.RawMessage(`"keep_local"`)
		return true, nil
	})
	if err != nil {
		s.logger.Warn("could not answer Claude Code's cloud settings question; claude --cloud will ask",
			slog.Any("error", err))
	}
	return err
}

// edit reads Claude Code's state file, lets change edit its top-level keys,
// and writes it back when change reports a change. Every key change leaves
// alone is written back untouched.
func (s *Store) edit(change func(root map[string]json.RawMessage) (bool, error)) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	root := map[string]json.RawMessage{}
	mode := fs.FileMode(0o600)
	raw, err := os.ReadFile(s.claudeConfig)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return err
	default:
		if info, statErr := os.Stat(s.claudeConfig); statErr == nil {
			mode = info.Mode().Perm()
		}
		if err := json.Unmarshal(raw, &root); err != nil {
			return err
		}
	}
	// JSON `null` decodes to a nil map, and a write to one panics.
	if root == nil {
		root = map[string]json.RawMessage{}
	}
	changed, err := change(root)
	if err != nil || !changed {
		return err
	}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(s.claudeConfig, out, mode)
}

func realPath(dir string) string {
	if real, err := filepath.EvalSymlinks(dir); err == nil {
		return real
	}
	return dir
}

// repositoryRoot is the folder Claude Code files a linked worktree's settings
// under: the main checkout, or the repository itself when it is bare. It is
// "" when dir is not a linked worktree. Claude Code resolves it the same way,
// from the `gitdir:` line of the worktree's `.git` file and the `commondir`
// beside it.
func repositoryRoot(dir string) string {
	raw, err := os.ReadFile(filepath.Join(dir, ".git")) //nolint:gosec // the session folder the runner made
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(raw))
	if !strings.HasPrefix(line, "gitdir:") {
		return ""
	}
	gitDir := resolve(dir, strings.TrimSpace(strings.TrimPrefix(line, "gitdir:")))
	common, err := os.ReadFile(filepath.Join(gitDir, "commondir")) //nolint:gosec // inside the git dir that folder names
	if err != nil {
		return ""
	}
	commonDir := resolve(gitDir, strings.TrimSpace(string(common)))
	if filepath.Base(commonDir) == ".git" {
		return realPath(filepath.Dir(commonDir))
	}
	return realPath(commonDir)
}

func resolve(base, path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Join(base, path)
}

func writeAtomic(path string, data []byte, mode fs.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".oppenheimer-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	// After the rename there is nothing at name, and before it the
	// temporary file is only litter: either way the error says nothing.
	defer func() { _ = os.Remove(name) }()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Chmod(mode); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
