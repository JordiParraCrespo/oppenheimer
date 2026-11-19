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
	"syscall"
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
	// Every file read must resolve inside the folder: a project can commit a
	// symlink, and what one points at would leave the host as a description.
	inside, err := filepath.EvalSymlinks(dir)
	if err != nil {
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
	add(collect(filepath.Join(dir, ".claude", "skills"), inside, skillSource, max))
	add(collect(filepath.Join(dir, ".claude", "commands"), inside, commandSource, max))
	return out
}

// candidate is a file that may hold a command, and the name it goes by
// unless its source lets the front matter name it.
type candidate struct{ path, name string }

// source is how one kind of file reads as a command: whether the front
// matter's `name` wins over the file's, and whether a body's first line
// stands in for a missing description.
type source struct {
	kind            domain.SlashCommandKind
	namedByHeader   bool
	describedByBody bool
	candidatesUnder func(root string) []candidate
}

var (
	// skillSource is `<dir>/SKILL.md`, through a symlinked folder.
	skillSource = source{kind: domain.SlashCommandSkill, namedByHeader: true, candidatesUnder: skillFiles}
	// commandSource is each `.md` under the folder, a subfolder's name joined
	// to the file's with `:`.
	commandSource = source{kind: domain.SlashCommandCommand, describedByBody: true, candidatesUnder: commandFiles}
)

// collect reads the commands a source finds under root, at most max, by
// name, leaving out one whose front matter says `user-invocable: false` and
// one whose file does not resolve inside the folder inside.
func collect(root, inside string, from source, max int) []domain.SlashCommand {
	var out []domain.SlashCommand
	for _, found := range from.candidatesUnder(root) {
		if len(out) >= max {
			break
		}
		head, ok := readHead(found.path, inside)
		if !ok {
			continue
		}
		fields, body := frontMatter(head)
		if strings.EqualFold(fields["user-invocable"], "false") {
			continue
		}
		name := found.name
		if from.namedByHeader && fields["name"] != "" {
			name = fields["name"]
		}
		description := fields["description"]
		if from.describedByBody && description == "" {
			description = firstLine(body)
		}
		if command, ok := build(name, from.kind, description); ok {
			out = append(out, command)
		}
	}
	sortByName(out)
	return out
}

func skillFiles(root string) []candidate {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var found []candidate
	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name(), ".") {
			found = append(found, candidate{path: filepath.Join(root, entry.Name(), "SKILL.md"), name: entry.Name()})
		}
	}
	return found
}

// commandFiles walks root commandsDepth folders deep at most.
func commandFiles(root string) []candidate {
	var found []candidate
	var walk func(dir string, prefix []string)
	walk = func(dir string, prefix []string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, entry := range entries {
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
			if strings.HasSuffix(name, ".md") {
				full := strings.Join(append(append([]string{}, prefix...), strings.TrimSuffix(name, ".md")), ":")
				found = append(found, candidate{path: path, name: full})
			}
		}
	}
	walk(root, nil)
	return found
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

// readHead reads the start of a regular file whose real path, through any
// symlink, is inside the folder inside (itself resolved). Anything else is
// refused before it is opened: a link out of the folder could hand a host's
// key to whoever reads the chat, and opening a FIFO blocks until a writer
// comes, which would hold the chat's first batch back for good. The real
// path is opened without following a link, so one swapped in after the
// check is refused too.
func readHead(path, inside string) (string, bool) {
	real, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", false
	}
	if rel, err := filepath.Rel(inside, real); err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", false
	}
	if info, err := os.Lstat(real); err != nil || !info.Mode().IsRegular() {
		return "", false
	}
	file, err := os.OpenFile(real, os.O_RDONLY|syscall.O_NOFOLLOW, 0) //nolint:gosec // resolved and held inside the session's folder above
	if err != nil {
		return "", false
	}
	defer func() { _ = file.Close() }()
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
// of YAML as a skill's header uses and no more: a plain or quoted scalar, one
// folded onto the indented lines below it, or a block (`>`, `|`) on those
// lines. A nested map or a list reads as its lines joined into one string;
// only `name`, `description` and `user-invocable` are read, and a key that
// needs more than this belongs to a real YAML parser. It answers the fields
// and the body after the front matter.
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
