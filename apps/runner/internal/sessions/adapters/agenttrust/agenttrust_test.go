package agenttrust_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/agenttrust"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// workDir is a folder as the store keys it, symlinks resolved: on macOS the
// temporary directory is under /var, which is /private/var.
func workDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func read(t *testing.T, path string) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// The file is Claude Code's: marking one folder must leave every other key,
// and every other key of that folder's entry, as the CLI wrote it.
func TestTrustMarksTheFolderAndKeepsEverythingElse(t *testing.T) {
	home := t.TempDir()
	config := filepath.Join(home, ".claude.json")
	work := workDir(t)
	before := `{"oauthAccount":{"email":"a@b.c"},"projects":{"/elsewhere":{"hasTrustDialogAccepted":false},"` +
		work + `":{"allowedTools":["Bash"]}}}`
	if err := os.WriteFile(config, []byte(before), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := agenttrust.New(agenttrust.Options{ClaudeConfig: config}).Trust(domain.AgentClaude, work); err != nil {
		t.Fatal(err)
	}

	got := read(t, config)
	if got["oauthAccount"].(map[string]any)["email"] != "a@b.c" {
		t.Fatalf("lost the account: %v", got)
	}
	projects := got["projects"].(map[string]any)
	if projects["/elsewhere"].(map[string]any)["hasTrustDialogAccepted"] != false {
		t.Fatalf("changed another folder: %v", projects)
	}
	entry := projects[work].(map[string]any)
	if entry["hasTrustDialogAccepted"] != true || entry["allowedTools"] == nil {
		t.Fatalf("entry = %v", entry)
	}
	if info, _ := os.Stat(config); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v", info.Mode().Perm())
	}
}

func TestTrustWritesTheFileWhenClaudeHasNoneYet(t *testing.T) {
	config := filepath.Join(t.TempDir(), ".claude.json")
	work := workDir(t)

	if err := agenttrust.New(agenttrust.Options{ClaudeConfig: config}).Trust(domain.AgentClaude, work); err != nil {
		t.Fatal(err)
	}

	entry := read(t, config)["projects"].(map[string]any)[work].(map[string]any)
	if entry["hasTrustDialogAccepted"] != true {
		t.Fatalf("entry = %v", entry)
	}
}

func TestTrustLeavesOtherAgentsAlone(t *testing.T) {
	config := filepath.Join(t.TempDir(), ".claude.json")

	if err := agenttrust.New(agenttrust.Options{ClaudeConfig: config}).Trust(domain.AgentCodex, t.TempDir()); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(config); !os.IsNotExist(err) {
		t.Fatalf("wrote Claude's file for Codex: %v", err)
	}
}

// A folder already trusted is left as it is: the file is Claude Code's, and
// rewriting it on every launch only widens the window a concurrent save can
// race.
func TestTrustLeavesAFolderAlreadyTrustedUntouched(t *testing.T) {
	config := filepath.Join(t.TempDir(), ".claude.json")
	work := workDir(t)
	before := `{"projects":{"` + work + `":{"hasTrustDialogAccepted": true}}, "zeta": 1, "alpha": 2}`
	if err := os.WriteFile(config, []byte(before), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := agenttrust.New(agenttrust.Options{ClaudeConfig: config}).Trust(domain.AgentClaude, work); err != nil {
		t.Fatal(err)
	}

	if after, _ := os.ReadFile(config); string(after) != before {
		t.Fatalf("rewrote a trusted folder's file:\n%s", after)
	}
}

// `null` where a map belongs decodes to a nil map; marking a folder must
// still work rather than panic the runner mid-launch.
func TestTrustSurvivesNullWhereAMapBelongs(t *testing.T) {
	for _, before := range []string{`null`, `{"projects":null}`, `{"projects":{"/x":null}}`} {
		config := filepath.Join(t.TempDir(), ".claude.json")
		work := workDir(t)
		if err := os.WriteFile(config, []byte(before), 0o600); err != nil {
			t.Fatal(err)
		}

		if err := agenttrust.New(agenttrust.Options{ClaudeConfig: config}).Trust(domain.AgentClaude, work); err != nil {
			t.Fatalf("%s: %v", before, err)
		}

		entry := read(t, config)["projects"].(map[string]any)[work].(map[string]any)
		if entry["hasTrustDialogAccepted"] != true {
			t.Fatalf("%s: entry = %v", before, entry)
		}
	}
}
