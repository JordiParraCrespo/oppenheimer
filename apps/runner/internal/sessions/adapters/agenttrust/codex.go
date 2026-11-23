package agenttrust

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pelletier/go-toml/v2"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// trustCodex records dir, and the repository a worktree belongs to, as
// `[projects."<dir>"] trust_level = "trusted"` in Codex's config.toml: it
// appends to the person's text, keeps an existing answer, and never writes a
// file that no longer parses.
func (s *Store) trustCodex(dir string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := readConfig(s.codexConfig)
	if err != nil {
		return err
	}
	var config struct {
		Projects map[string]any `toml:"projects"`
	}
	if err := toml.Unmarshal(file.raw, &config); err != nil {
		return err
	}
	var add strings.Builder
	for _, dir := range folders(dir) {
		if _, answered := config.Projects[dir]; answered {
			continue
		}
		// A JSON string is a TOML basic string: the same quote, the same
		// escapes.
		key, err := json.Marshal(dir)
		if err != nil {
			return err
		}
		fmt.Fprintf(&add, "\n[projects.%s]\ntrust_level = \"trusted\"\n", key)
	}
	if add.Len() == 0 {
		return nil
	}
	out := append([]byte(nil), file.raw...)
	if len(out) > 0 && out[len(out)-1] != '\n' {
		out = append(out, '\n')
	}
	out = append(out, add.String()...)
	if err := toml.Unmarshal(out, &config); err != nil {
		return fmt.Errorf("adding the folder would leave %s unreadable: %w", file.path, err)
	}
	return file.write(out)
}

// OwnInstructions is the `developer_instructions` Codex would run with in
// dir, for a launch that sets the key itself to keep: the project's
// `.codex/config.toml` nearest dir, up to the checkout's root, over the
// person's own config.toml, as Codex ranks them. "" for any other agent, for
// none, or for files that do not parse, which Codex would refuse anyway.
func (s *Store) OwnInstructions(agent domain.Agent, dir string) string {
	if agent != domain.AgentCodex {
		return ""
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, config := range projectConfigs(dir) {
		if value, ok := developerInstructions(config); ok {
			return value
		}
	}
	if s.codexConfig == "" {
		return ""
	}
	value, _ := developerInstructions(s.codexConfig)
	return value
}

// projectConfigs are the project config files Codex reads for dir, nearest
// first: `.codex/config.toml` in dir and each folder above it, up to the
// one holding `.git`. None when dir is in no checkout.
func projectConfigs(dir string) []string {
	if dir == "" {
		return nil
	}
	var configs []string
	for current := filepath.Clean(dir); ; current = filepath.Dir(current) {
		configs = append(configs, filepath.Join(current, ".codex", "config.toml"))
		if _, err := os.Stat(filepath.Join(current, ".git")); err == nil {
			return configs
		}
		if filepath.Dir(current) == current {
			return nil
		}
	}
}

// developerInstructions reads the key from one config file, and whether the
// file sets it.
func developerInstructions(path string) (string, bool) {
	file, err := readConfig(path)
	if err != nil || len(file.raw) == 0 {
		return "", false
	}
	var config struct {
		DeveloperInstructions *string `toml:"developer_instructions"`
	}
	if err := toml.Unmarshal(file.raw, &config); err != nil || config.DeveloperInstructions == nil {
		return "", false
	}
	return *config.DeveloperInstructions, true
}
