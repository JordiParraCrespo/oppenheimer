// Package agenttrust tells an agent CLI that a session's folder is one it may
// work in, so the CLI's "do you trust the files in this folder?" question is
// already answered when nobody is at the terminal to answer it.
package agenttrust

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Store is app.Trust over Claude Code's own state file. Other agents have no
// such question this runner answers yet, and are left alone.
type Store struct {
	// claudeConfig is Claude Code's global state, `~/.claude.json`, or
	// `$CLAUDE_CONFIG_DIR/.claude.json` when that is set.
	claudeConfig string
	logger       *slog.Logger
	mu           sync.Mutex
}

// Options names the files the store edits.
type Options struct {
	ClaudeConfig string
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
	return &Store{claudeConfig: opts.ClaudeConfig, logger: logger}
}

// Trust records dir as accepted. Claude Code keeps the answer per folder, as
// `projects[<dir>].hasTrustDialogAccepted`; every other key in the file, and
// in that folder's entry, is Claude Code's and is written back untouched. The
// write is a temporary file renamed over the old one, so a CLI starting at the
// same moment reads the old file or the new one, never half of either.
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
	if real, err := filepath.EvalSymlinks(dir); err == nil {
		dir = real
	}
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

	projects := map[string]map[string]json.RawMessage{}
	if existing, ok := root["projects"]; ok {
		if err := json.Unmarshal(existing, &projects); err != nil {
			return err
		}
	}
	if projects == nil {
		projects = map[string]map[string]json.RawMessage{}
	}
	project := projects[dir]
	if project == nil {
		project = map[string]json.RawMessage{}
	}
	var accepted bool
	if json.Unmarshal(project["hasTrustDialogAccepted"], &accepted) == nil && accepted {
		return nil
	}
	project["hasTrustDialogAccepted"] = json.RawMessage("true")
	projects[dir] = project
	encoded, err := json.Marshal(projects)
	if err != nil {
		return err
	}
	root["projects"] = encoded
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(s.claudeConfig, out, mode)
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
