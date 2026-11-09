package agenttrust_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pelletier/go-toml/v2"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/agenttrust"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func codexProjects(t *testing.T, path string) map[string]map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var config struct {
		Projects map[string]map[string]any `toml:"projects"`
	}
	if err := toml.Unmarshal(raw, &config); err != nil {
		t.Fatalf("config.toml no longer parses: %v\n%s", err, raw)
	}
	return config.Projects
}

// Without an entry for the session's folder Codex opens on "Do you trust the
// files in this folder?" in a terminal nobody may be watching. The file is
// the person's own and often hand-edited, so its comments and keys survive.
func TestTrustMarksTheFolderForCodexAndKeepsTheFile(t *testing.T) {
	config := filepath.Join(t.TempDir(), "config.toml")
	work := workDir(t)
	before := "# my settings\nmodel = \"gpt-5\"\n\n[projects.\"/elsewhere\"]\ntrust_level = \"untrusted\""
	if err := os.WriteFile(config, []byte(before), 0o640); err != nil {
		t.Fatal(err)
	}

	if err := agenttrust.New(agenttrust.Options{CodexConfig: config}).Trust(domain.AgentCodex, work); err != nil {
		t.Fatal(err)
	}

	after, _ := os.ReadFile(config)
	if !strings.HasPrefix(string(after), before) {
		t.Fatalf("rewrote what was there:\n%s", after)
	}
	projects := codexProjects(t, config)
	if projects[work]["trust_level"] != "trusted" || projects["/elsewhere"]["trust_level"] != "untrusted" {
		t.Fatalf("projects = %v", projects)
	}
	if info, _ := os.Stat(config); info.Mode().Perm() != 0o640 {
		t.Fatalf("mode = %v, want the file's own", info.Mode().Perm())
	}
}

// A first run on a host where Codex has never saved a setting.
func TestTrustWritesCodexConfigWhenThereIsNone(t *testing.T) {
	config := filepath.Join(t.TempDir(), "codex-home", "config.toml")
	work := workDir(t)

	if err := agenttrust.New(agenttrust.Options{CodexConfig: config}).Trust(domain.AgentCodex, work); err != nil {
		t.Fatal(err)
	}

	if codexProjects(t, config)[work]["trust_level"] != "trusted" {
		t.Fatal("folder not trusted")
	}
}

// An answer already given, either one, is the person's: the file is not
// touched, and a second launch adds no duplicate table that would leave
// Codex unable to read its config.
func TestTrustLeavesACodexAnswerAlone(t *testing.T) {
	config := filepath.Join(t.TempDir(), "config.toml")
	work := workDir(t)
	store := agenttrust.New(agenttrust.Options{CodexConfig: config})
	before := "[projects.\"" + work + "\"]\ntrust_level = \"untrusted\"\n"
	if err := os.WriteFile(config, []byte(before), 0o600); err != nil {
		t.Fatal(err)
	}

	for range 2 {
		if err := store.Trust(domain.AgentCodex, work); err != nil {
			t.Fatal(err)
		}
	}

	if after, _ := os.ReadFile(config); string(after) != before {
		t.Fatalf("touched an answered folder:\n%s", after)
	}
}

// A config the appended table would break is left as it is, not broken.
func TestTrustNeverBreaksCodexConfig(t *testing.T) {
	config := filepath.Join(t.TempDir(), "config.toml")
	before := "projects = { \"/elsewhere\" = { trust_level = \"trusted\" } }\n"
	if err := os.WriteFile(config, []byte(before), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := agenttrust.New(agenttrust.Options{CodexConfig: config}).Trust(domain.AgentCodex, workDir(t)); err == nil {
		t.Fatal("want an error for a config it cannot extend")
	}
	if after, _ := os.ReadFile(config); string(after) != before {
		t.Fatalf("changed a config it could not extend:\n%s", after)
	}
}

// Codex keys a folder in a git repository by the repository's main
// checkout, so a session's worktree is only trusted once that is.
func TestTrustMarksTheRepositoryOfAWorktreeForCodex(t *testing.T) {
	work, repo := linkedWorktree(t)
	config := filepath.Join(t.TempDir(), "config.toml")

	if err := agenttrust.New(agenttrust.Options{CodexConfig: config}).Trust(domain.AgentCodex, work); err != nil {
		t.Fatal(err)
	}

	projects := codexProjects(t, config)
	for _, dir := range []string{work, repo} {
		if projects[dir]["trust_level"] != "trusted" {
			t.Fatalf("%s not trusted: %v", dir, projects)
		}
	}
}

// Claude's file is not Codex's: trusting a folder for one writes nothing for
// the other.
func TestTrustForCodexLeavesClaudeAlone(t *testing.T) {
	claude := filepath.Join(t.TempDir(), ".claude.json")
	codex := filepath.Join(t.TempDir(), "config.toml")
	store := agenttrust.New(agenttrust.Options{ClaudeConfig: claude, CodexConfig: codex})

	if err := store.Trust(domain.AgentCodex, workDir(t)); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(claude); !os.IsNotExist(err) {
		t.Fatalf("wrote Claude's file for Codex: %v", err)
	}
	if err := store.Trust(domain.AgentClaude, workDir(t)); err != nil {
		t.Fatal(err)
	}
	if len(codexProjects(t, codex)) != 1 {
		t.Fatal("wrote Codex's file for Claude")
	}
}
