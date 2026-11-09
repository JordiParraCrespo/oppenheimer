package agenttrust

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

// trustCodex records dir, and the repository a worktree belongs to, as
// `[projects."<dir>"] trust_level = "trusted"` in Codex's config.toml. The
// rules (append to the person's text, keep an existing answer, never write a
// file that no longer parses) are product/versions/mvp/02-runner.md §5.
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
