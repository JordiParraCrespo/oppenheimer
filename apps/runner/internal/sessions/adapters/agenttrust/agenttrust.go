// Package agenttrust tells an agent CLI that a session's folder is one it may
// work in, so the CLI's "do you trust the files in this folder?" question is
// already answered when nobody is at the terminal to answer it.
package agenttrust

import (
	"encoding/json"
	"errors"
	"io/fs"
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
	mu           sync.Mutex
}

// Options names the files the store edits.
type Options struct {
	ClaudeConfig string
}

// New builds the store.
func New(opts Options) *Store { return &Store{claudeConfig: opts.ClaudeConfig} }

// Trust records dir as accepted. Claude Code keeps the answer per folder, as
// `projects[<dir>].hasTrustDialogAccepted`; every other key in the file, and
// in that folder's entry, is Claude Code's and is written back untouched. The
// write is a temporary file renamed over the old one, so a CLI starting at the
// same moment reads the old file or the new one, never half of either.
func (s *Store) Trust(agent domain.Agent, dir string) error {
	if agent != domain.AgentClaude || s.claudeConfig == "" {
		return nil
	}
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

	projects := map[string]map[string]json.RawMessage{}
	if existing, ok := root["projects"]; ok {
		if err := json.Unmarshal(existing, &projects); err != nil {
			return err
		}
	}
	project := projects[dir]
	if project == nil {
		project = map[string]json.RawMessage{}
	}
	if string(project["hasTrustDialogAccepted"]) == "true" {
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
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
