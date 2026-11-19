// Package slashcommands reads the slash commands a project gives Claude Code
// from the folder its agent runs in: each skill, `.claude/skills/<dir>/SKILL.md`,
// and each command, `.claude/commands/<path>.md`, a subfolder's name joined to
// the file's with `:`. Only what the chat's `/` menu shows leaves the host: a
// name and the first part of a description.
package slashcommands

import (
	"bufio"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode/utf16"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The wire's bounds on one command (`chatCommandSchema`), and how much of a
// file is read for its front matter and first line.
const (
	nameMax        = 64
	descriptionMax = 300
	headBytes      = 8 * 1024
	// commandsDepth is how many folders deep under `.claude/commands` a
	// command is looked for.
	commandsDepth = 3
)

var namePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]*$`)

// Reader reads a folder's skills and commands from disk.
type Reader struct{}

var _ sessionsapp.SlashCommands = Reader{}

// InFolder lists dir's skills, then its commands, each by name, at most max
// in all. A command named as a skill is left out: the skill is what runs.
func (Reader) InFolder(dir string, max int) []domain.SlashCommand {
	if dir == "" || max <= 0 {
		return nil
	}
	seen := map[string]bool{}
	var out []domain.SlashCommand
	add := func(list []domain.SlashCommand) {
		for _, command := range list {
			if len(out) >= max {
				return
			}
			if seen[command.Name] {
				continue
			}
			seen[command.Name] = true
			out = append(out, command)
		}
	}
	add(skills(filepath.Join(dir, ".claude", "skills"), max))
	add(commands(filepath.Join(dir, ".claude", "commands"), max))
	return out
}

// skills reads each `<dir>/SKILL.md`, following a symlinked folder, and leaves
// out one whose front matter says `user-invocable: false`.
func skills(root string, max int) []domain.SlashCommand {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var out []domain.SlashCommand
	for _, entry := range entries {
		if len(out) >= max {
			break
		}
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		head, ok := readHead(filepath.Join(root, entry.Name(), "SKILL.md"))
		if !ok {
			continue
		}
		fields, _ := frontMatter(head)
		if strings.EqualFold(fields["user-invocable"], "false") {
			continue
		}
		name := fields["name"]
		if name == "" {
			name = entry.Name()
		}
		if command, ok := build(name, domain.SlashCommandSkill, fields["description"]); ok {
			out = append(out, command)
		}
	}
	sortByName(out)
	return out
}

// commands reads each `.md` under root, commandsDepth folders deep at most.
// Its description is the front matter's, or else the body's first line.
func commands(root string, max int) []domain.SlashCommand {
	var out []domain.SlashCommand
	var walk func(dir string, prefix []string)
	walk = func(dir string, prefix []string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, entry := range entries {
			if len(out) >= max {
				return
			}
			name := entry.Name()
			if strings.HasPrefix(name, ".") {
				continue
			}
			path := filepath.Join(dir, name)
			info, err := os.Stat(path)
			if err != nil {
				continue
			}
			if info.IsDir() {
				if len(prefix)+1 < commandsDepth {
					walk(path, append(append([]string{}, prefix...), name))
				}
				continue
			}
			if !strings.HasSuffix(name, ".md") {
				continue
			}
			head, ok := readHead(path)
			if !ok {
				continue
			}
			fields, body := frontMatter(head)
			description := fields["description"]
			if description == "" {
				description = firstLine(body)
			}
			full := strings.Join(append(append([]string{}, prefix...), strings.TrimSuffix(name, ".md")), ":")
			if command, ok := build(full, domain.SlashCommandCommand, description); ok {
				out = append(out, command)
			}
		}
	}
	walk(root, nil)
	sortByName(out)
	return out
}

// build is one command as the wire takes it, or false for a name it refuses.
func build(name string, kind domain.SlashCommandKind, description string) (domain.SlashCommand, bool) {
	if len(name) > nameMax || !namePattern.MatchString(name) {
		return domain.SlashCommand{}, false
	}
	return domain.SlashCommand{Name: name, Kind: kind, Description: clip(description)}, true
}

// clip cuts a description to what the wire takes, counted as the console
// counts a string's length: in UTF-16 units.
func clip(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	units := 0
	for i, r := range text {
		units += len(utf16.Encode([]rune{r}))
		if units > descriptionMax {
			return strings.TrimSpace(text[:i])
		}
	}
	return text
}

// readHead reads the start of a regular file, through any symlink. Anything
// else is refused before it is opened: opening a FIFO blocks until a writer
// comes, which would hold the chat's first batch back for good.
func readHead(path string) (string, bool) {
	if info, err := os.Stat(path); err != nil || !info.Mode().IsRegular() {
		return "", false
	}
	file, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer file.Close()
	if info, err := file.Stat(); err != nil || !info.Mode().IsRegular() {
		return "", false
	}
	head, err := io.ReadAll(io.LimitReader(file, headBytes))
	if err != nil {
		return "", false
	}
	return string(head), true
}

// frontMatter reads the top-level keys of a file's YAML front matter, as much
// of YAML as a skill's header uses: a plain or quoted value, one folded onto
// the indented lines below it, or a block (`>`, `|`) on those lines. It
// answers the fields and the body after the front matter.
func frontMatter(text string) (map[string]string, string) {
	fields := map[string]string{}
	scanner := bufio.NewScanner(strings.NewReader(text))
	if !scanner.Scan() || strings.TrimSpace(scanner.Text()) != "---" {
		return fields, text
	}
	var key string
	var lines []string
	flush := func() {
		if key != "" {
			fields[key] = unquote(strings.Join(lines, " "))
		}
		key, lines = "", nil
	}
	var body strings.Builder
	closed := false
	for scanner.Scan() {
		line := scanner.Text()
		if closed {
			body.WriteString(line)
			body.WriteByte('\n')
			continue
		}
		if strings.TrimSpace(line) == "---" {
			flush()
			closed = true
			continue
		}
		if line != "" && (line[0] == ' ' || line[0] == '\t') {
			if key != "" {
				lines = append(lines, strings.TrimSpace(line))
			}
			continue
		}
		flush()
		name, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(name))
		value = strings.TrimSpace(value)
		switch value {
		case "", ">", ">-", "|", "|-":
		default:
			lines = append(lines, value)
		}
	}
	if !closed {
		return map[string]string{}, text
	}
	return fields, body.String()
}

func unquote(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		first, last := value[0], value[len(value)-1]
		if (first == '"' || first == '\'') && last == first {
			return value[1 : len(value)-1]
		}
	}
	return value
}

// firstLine is the first line of a command's body with words in it, without
// a heading's marks.
func firstLine(body string) string {
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(line), "#"))
		if line != "" {
			return line
		}
	}
	return ""
}

func sortByName(list []domain.SlashCommand) {
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
}
