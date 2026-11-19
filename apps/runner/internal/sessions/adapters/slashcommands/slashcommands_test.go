package slashcommands

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

// A project's skills and commands read as Claude Code names them: a skill by
// its front matter's name (its folder's otherwise), through a symlinked
// skills folder, a folded description joined; one the person cannot invoke
// left out; a command by its path with `:`, described by its first line when
// its front matter says nothing; a command named as a skill left to the skill.
func TestAProjectsSkillsAndCommandsAreListedAsClaudeCodeNamesThem(t *testing.T) {
	dir := t.TempDir()
	shared := filepath.Join(dir, ".agents", "skills")
	write(t, filepath.Join(shared, "recap", "SKILL.md"), "---\nname: recap\ndescription: >\n  Close a finished task\n  with a brief.\n---\n# Recap\n")
	write(t, filepath.Join(shared, "cook-dir", "SKILL.md"), "---\nname: \"cook\"\ndescription: 'Pick the lane.'\n---\n")
	write(t, filepath.Join(shared, "unnamed", "SKILL.md"), "---\ndescription: No name of its own\n---\n")
	write(t, filepath.Join(shared, "hidden", "SKILL.md"), "---\nname: hidden\nuser-invocable: false\n---\n")
	write(t, filepath.Join(shared, "empty", "README.md"), "not a skill")
	if err := os.MkdirAll(filepath.Join(dir, ".claude"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join("..", ".agents", "skills"), filepath.Join(dir, ".claude", "skills")); err != nil {
		t.Fatal(err)
	}
	commands := filepath.Join(dir, ".claude", "commands")
	write(t, filepath.Join(commands, "deploy.md"), "# Deploy the stack\n\nSteps.\n")
	write(t, filepath.Join(commands, "frontend", "audit.md"), "---\ndescription: Audit the console\n---\nBody\n")
	write(t, filepath.Join(commands, "recap.md"), "A second recap\n")
	write(t, filepath.Join(commands, "notes.txt"), "not a command")
	write(t, filepath.Join(commands, "bad name.md"), "refused by the wire\n")

	got := Reader{}.InFolder(dir, 200)
	want := []domain.SlashCommand{
		{Name: "cook", Kind: domain.SlashCommandSkill, Description: "Pick the lane."},
		{Name: "recap", Kind: domain.SlashCommandSkill, Description: "Close a finished task with a brief."},
		{Name: "unnamed", Kind: domain.SlashCommandSkill, Description: "No name of its own"},
		{Name: "deploy", Kind: domain.SlashCommandCommand, Description: "Deploy the stack"},
		{Name: "frontend:audit", Kind: domain.SlashCommandCommand, Description: "Audit the console"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("command %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// What leaves the host stays inside the wire's bounds, so one long file or a
// project with many skills cannot get the whole batch refused.
func TestTheListStaysInsideTheWiresBounds(t *testing.T) {
	dir := t.TempDir()
	long := strings.Repeat("é", descriptionMax+50)
	write(t, filepath.Join(dir, ".claude", "skills", "a", "SKILL.md"), "---\ndescription: "+long+"\n---\n")
	write(t, filepath.Join(dir, ".claude", "skills", "b", "SKILL.md"), "---\n---\n")
	write(t, filepath.Join(dir, ".claude", "commands", "c.md"), "c\n")

	got := Reader{}.InFolder(dir, 2)
	if len(got) != 2 || got[0].Name != "a" || got[1].Name != "b" {
		t.Fatalf("got %+v, want the first two", got)
	}
	if n := len([]rune(got[0].Description)); n != descriptionMax {
		t.Fatalf("description is %d characters, want %d", n, descriptionMax)
	}
	if (Reader{}).InFolder(filepath.Join(dir, "missing"), 10) != nil {
		t.Fatal("a folder with no .claude lists commands")
	}
}

// A pipe where a command would be is skipped, not opened: opening it would
// wait for a writer, and the chat's first batch with it.
func TestAPipeInTheProjectDoesNotHoldTheListBack(t *testing.T) {
	dir := t.TempDir()
	commands := filepath.Join(dir, ".claude", "commands")
	write(t, filepath.Join(commands, "ok.md"), "Fine\n")
	if err := syscall.Mkfifo(filepath.Join(commands, "pipe.md"), 0o644); err != nil {
		t.Skipf("no FIFOs here: %v", err)
	}
	if err := os.Symlink(filepath.Join(commands, "pipe.md"), filepath.Join(commands, "linked.md")); err != nil {
		t.Fatal(err)
	}
	done := make(chan []domain.SlashCommand, 1)
	go func() { done <- Reader{}.InFolder(dir, 10) }()
	select {
	case got := <-done:
		if len(got) != 1 || got[0].Name != "ok" {
			t.Fatalf("got %+v, want the regular command alone", got)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("reading the commands blocked on a pipe")
	}
}
