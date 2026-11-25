package git

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// emptyTree is git's empty tree (SHA-1): what a branch with no commit yet is
// compared with, so every file in it reads as added.
const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

// binarySniff is how much of an untracked file is read to tell text from
// binary, as git's own check reads (a NUL in the first 8000 bytes).
const binarySniff = 8000

// diffFlags make every diff read the same, whatever the host's config says:
// no external diff or textconv program, no colour, renames found.
var diffFlags = []string{"--no-ext-diff", "--no-textconv", "--no-color", "-M"}

// literal makes a path after `--` the path itself, never a glob: a file named
// `app/[id]/page.tsx` must not also match `app/i/page.tsx`.
const literal = "--literal-pathspecs"

// Changes lists what the worktree at path changed: against where the branch
// meets origin/<baseBranch>, or with uncommitted against its last commit.
// The files come without patches; Patch reads one.
//
// When the branch's history does not reach its base yet (the store is
// still fetching it), the base branch's tip stands in and the answer says
// it is approximate. Untracked files git does not ignore are listed as
// untracked, counted from the file itself while fewer than counted files
// are named and ctx lasts: a `node_modules` nobody ignored lists thousands
// of them, and counting each to its end would outlast the read.
func (c *Client) Changes(ctx context.Context, path, baseBranch string, uncommitted bool, counted int) (domain.CheckoutChanges, error) {
	base, approximate := c.compareBase(ctx, path, baseBranch, uncommitted)
	against := base
	if against == "" {
		against = emptyTree
	}
	statuses, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true},
		append(append([]string{"diff"}, diffFlags...), "--name-status", "-z", against)...)
	if err != nil {
		return domain.CheckoutChanges{}, err
	}
	counts, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true},
		append(append([]string{"diff"}, diffFlags...), "--numstat", "-z", against)...)
	if err != nil {
		return domain.CheckoutChanges{}, err
	}
	files := joinCounts(parseNameStatus(statuses), parseNumstat(counts))

	untracked, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true},
		"ls-files", "--others", "--exclude-standard", "-z")
	if err != nil {
		return domain.CheckoutChanges{}, err
	}
	for _, name := range strings.Split(untracked, "\x00") {
		// A directory (an embedded repository) is listed with its slash.
		if name == "" || strings.HasSuffix(name, "/") {
			continue
		}
		file := domain.ChangedFile{Path: name, Status: domain.ChangeUntracked}
		if len(files) < counted && ctx.Err() == nil {
			if lines, binary, ok := countUntracked(ctx, path, name); ok {
				file.Additions, file.Binary = lines, binary
			}
		}
		files = append(files, file)
	}
	return domain.CheckoutChanges{Base: base, Approximate: approximate, Files: files}, nil
}

// compareBase is the commit a read compares with, and whether it only
// stands in for where the branch left its base.
func (c *Client) compareBase(ctx context.Context, path, baseBranch string, uncommitted bool) (string, bool) {
	head := c.revParse(ctx, path, "HEAD")
	if uncommitted || baseBranch == "" {
		// With no base to meet, the last commit is what the read compares
		// with, for `base` as for `uncommitted`: nothing stands in for anything.
		return head, false
	}
	remote := "refs/remotes/origin/" + baseBranch
	if out, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true}, "merge-base", "HEAD", remote); err == nil {
		if base := strings.TrimSpace(out); base != "" {
			return base, false
		}
	}
	if tip := c.revParse(ctx, path, remote); tip != "" {
		return tip, true
	}
	return head, head != ""
}

// revParse is the commit ref names in the worktree at path, or empty when it
// names none (a branch with no commit yet, a base never fetched).
func (c *Client) revParse(ctx context.Context, path, ref string) string {
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true},
		"rev-parse", "--verify", "--quiet", ref+"^{commit}")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}

// Patch reads one file's unified diff against base, from its `diff --git`
// line, and reports false when it is longer than limit bytes (it is then
// not returned at all, never cut: half a hunk reads as a different change).
// An untracked file's patch is made from the file, as `git diff` would print
// it for a new one.
func (c *Client) Patch(ctx context.Context, path, base string, file domain.ChangedFile, limit int) (string, bool, error) {
	if file.Status == domain.ChangeUntracked {
		return untrackedPatch(path, file.Path, limit)
	}
	if base == "" {
		base = emptyTree
	}
	args := append(append([]string{literal, "diff"}, diffFlags...), base, "--")
	if file.OldPath != "" {
		args = append(args, file.OldPath)
	}
	args = append(args, file.Path)
	var cut bool
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: path, stdout: true, limit: limit + 1, cut: &cut}, args...)
	if err != nil {
		return "", false, err
	}
	// run trims the trailing newline every diff ends with.
	patch := out + "\n"
	if cut || len(patch) > limit {
		return "", false, nil
	}
	return patch, true, nil
}

// zRecord is one record of a `-z` diff listing: its leading field (a
// status, or numstat's `added\tdeleted\t`), its path, and for a rename or a
// copy the path it came from.
type zRecord struct {
	head, path, oldPath string
}

// zRecords walks a `-z` diff listing. A record is its leading field and a
// path, or, for a rename or a copy, its leading field, the old path and the
// new one: `--name-status` says so by an R or C status, `--numstat` by a
// leading field whose path is empty. One walk for both listings, so the
// two can never part on where a record ends.
func zRecords(out string, renamed func(head string) bool) []zRecord {
	fields := strings.Split(out, "\x00")
	var records []zRecord
	for i := 0; i < len(fields); i++ {
		head := fields[i]
		if head == "" {
			continue
		}
		if renamed(head) {
			if i+2 >= len(fields) {
				break
			}
			records = append(records, zRecord{head: head, oldPath: fields[i+1], path: fields[i+2]})
			i += 2
			continue
		}
		if path, ok := inlinePath(head); ok {
			records = append(records, zRecord{head: head, path: path})
			continue
		}
		if i+1 >= len(fields) {
			break
		}
		records = append(records, zRecord{head: head, path: fields[i+1]})
		i++
	}
	return records
}

// inlinePath is the path numstat writes on the record's own field
// (`added\tdeleted\tpath`); a name-status field holds no path.
func inlinePath(head string) (string, bool) {
	parts := strings.SplitN(head, "\t", 3)
	if len(parts) == 3 && parts[2] != "" {
		return parts[2], true
	}
	return "", false
}

// parseNameStatus reads `git diff --name-status -z`: a status, then one path,
// or for a rename or a copy the old path and the new one.
func parseNameStatus(out string) []domain.ChangedFile {
	var files []domain.ChangedFile
	for _, r := range zRecords(out, func(head string) bool { return head[0] == 'R' || head[0] == 'C' }) {
		files = append(files, domain.ChangedFile{Status: statusOf(r.head[0]), Path: r.path, OldPath: r.oldPath})
	}
	return files
}

func statusOf(code byte) domain.ChangeStatus {
	switch code {
	case 'A':
		return domain.ChangeAdded
	case 'D':
		return domain.ChangeDeleted
	case 'R':
		return domain.ChangeRenamed
	case 'C':
		return domain.ChangeCopied
	case 'T':
		return domain.ChangeTypeChanged
	default:
		return domain.ChangeModified
	}
}

// lineCounts is one file's numstat: its counts, or binary.
type lineCounts struct {
	additions, deletions int
	binary               bool
}

// parseNumstat reads `git diff --numstat -z`, keyed by the file's path (the
// new one for a rename): `added\tdeleted\tpath`, or for a rename
// `added\tdeleted\t` then the old and new paths; `-` for a binary file.
func parseNumstat(out string) map[string]lineCounts {
	counts := map[string]lineCounts{}
	renamed := func(head string) bool {
		parts := strings.SplitN(head, "\t", 3)
		return len(parts) == 3 && parts[2] == ""
	}
	for _, r := range zRecords(out, renamed) {
		parts := strings.SplitN(r.head, "\t", 3)
		if len(parts) != 3 {
			continue
		}
		var line lineCounts
		if parts[0] == "-" && parts[1] == "-" {
			line.binary = true
		} else {
			line.additions, _ = strconv.Atoi(parts[0])
			line.deletions, _ = strconv.Atoi(parts[1])
		}
		counts[r.path] = line
	}
	return counts
}

func joinCounts(files []domain.ChangedFile, counts map[string]lineCounts) []domain.ChangedFile {
	for i, file := range files {
		if line, ok := counts[file.Path]; ok {
			files[i].Additions, files[i].Deletions, files[i].Binary = line.additions, line.deletions, line.binary
		}
	}
	return files
}

// untrackedFile opens an untracked file in the worktree at root for reading,
// only when it is a regular file inside the worktree once every link is
// resolved: a symlink, or a path that resolves out of the checkout, is never
// read, so a session's files cannot show the host's.
func untrackedFile(root, name string) (*os.File, bool) {
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return nil, false
	}
	full := filepath.Join(root, filepath.FromSlash(name))
	info, err := os.Lstat(full)
	if err != nil || !info.Mode().IsRegular() {
		return nil, false
	}
	resolved, err := filepath.EvalSymlinks(full)
	if err != nil {
		return nil, false
	}
	if rel, err := filepath.Rel(realRoot, resolved); err != nil || rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return nil, false
	}
	f, err := os.Open(resolved)
	if err != nil {
		return nil, false
	}
	return f, true
}

// countUntracked counts an untracked file's lines, as git counts a new
// file's additions, and tells a binary one by a NUL in its first bytes.
func countUntracked(ctx context.Context, root, name string) (lines int, binary bool, ok bool) {
	f, ok := untrackedFile(root, name)
	if !ok {
		return 0, false, false
	}
	defer func() { _ = f.Close() }()
	reader := bufio.NewReaderSize(f, binarySniff)
	head, _ := reader.Peek(binarySniff)
	if bytes.IndexByte(head, 0) >= 0 {
		return 0, true, true
	}
	var last byte
	buf := make([]byte, 32*1024)
	for {
		// A file of gigabytes is counted only while the read has time.
		if ctx.Err() != nil {
			return 0, false, false
		}
		n, err := reader.Read(buf)
		chunk := buf[:n]
		lines += bytes.Count(chunk, []byte{'\n'})
		if len(chunk) > 0 {
			last = chunk[len(chunk)-1]
		}
		if err != nil {
			if !errors.Is(err, io.EOF) {
				return 0, false, false
			}
			break
		}
	}
	if last != 0 && last != '\n' {
		lines++
	}
	return lines, false, true
}

// untrackedPatch makes a new file's patch from the file, as `git diff`
// prints one: false when it is binary, unreadable or longer than limit.
func untrackedPatch(root, name string, limit int) (string, bool, error) {
	f, ok := untrackedFile(root, name)
	if !ok {
		return "", false, nil
	}
	defer func() { _ = f.Close() }()
	content, err := io.ReadAll(io.LimitReader(f, int64(limit)+1))
	if err != nil || len(content) > limit || bytes.IndexByte(content[:min(len(content), binarySniff)], 0) >= 0 {
		return "", false, nil //nolint:nilerr // an unreadable file has no patch; its row stays
	}
	var b strings.Builder
	fmt.Fprintf(&b, "diff --git a/%s b/%s\nnew file mode 100644\n--- /dev/null\n+++ b/%s\n", name, name, name)
	if len(content) > 0 {
		text := string(content)
		trailing := strings.HasSuffix(text, "\n")
		lines := strings.Split(strings.TrimSuffix(text, "\n"), "\n")
		fmt.Fprintf(&b, "@@ -0,0 +1,%d @@\n", len(lines))
		for _, line := range lines {
			b.WriteString("+" + line + "\n")
		}
		if !trailing {
			b.WriteString("\\ No newline at end of file\n")
		}
	}
	if b.Len() > limit {
		return "", false, nil
	}
	return b.String(), true, nil
}
