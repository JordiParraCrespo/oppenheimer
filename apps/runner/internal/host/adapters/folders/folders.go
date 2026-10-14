// Package folders is app.Directories on the local file system: what the
// folder picker reads of a host (24 §4). It names directories and reads the
// one file git keeps a checkout's branch in; it never names a file and never
// runs git, so a listing of a directory full of repositories costs one small
// read each.
package folders

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Directories = Disk{}

// headLimit bounds what is read of a HEAD, or of a worktree's `.git` file:
// either is one short line.
const headLimit = 1024

// maxBranch is the longest branch the protocol carries.
const maxBranch = 255

// Disk reads the local file system.
type Disk struct{}

// Subdirectories implements app.Directories.
func (Disk) Subdirectories(dir string) ([]string, error) {
	info, err := os.Stat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s: %w", dir, domain.ErrNotADirectory)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		switch {
		case entry.IsDir():
		case entry.Type()&os.ModeSymlink != 0:
			// A link to a directory is a directory to pick; a broken one,
			// or one to a file, is not.
			target, err := os.Stat(filepath.Join(dir, entry.Name()))
			if err != nil || !target.IsDir() {
				continue
			}
		default:
			continue
		}
		names = append(names, entry.Name())
	}
	return names, nil
}

// Branch implements app.Directories. A checkout's `.git` is a directory
// holding HEAD, or, in a worktree or a submodule, a file whose `gitdir:` line
// names the directory that does.
func (Disk) Branch(dir string) string {
	gitPath := filepath.Join(dir, ".git")
	info, err := os.Stat(gitPath)
	if err != nil {
		return ""
	}
	gitDir := gitPath
	if !info.IsDir() {
		line, err := readLine(gitPath)
		if err != nil {
			return ""
		}
		target, found := strings.CutPrefix(line, "gitdir:")
		if !found {
			return ""
		}
		gitDir = strings.TrimSpace(target)
		if !filepath.IsAbs(gitDir) {
			gitDir = filepath.Join(dir, gitDir)
		}
	}
	head, err := readLine(filepath.Join(gitDir, "HEAD"))
	if err != nil {
		return ""
	}
	return BranchOf(head)
}

// BranchOf reads a HEAD's content: `ref: refs/heads/<branch>` is the branch,
// a commit id (detached) is its first seven characters, and anything else is
// no branch at all.
func BranchOf(head string) string {
	head = strings.TrimSpace(head)
	if ref, found := strings.CutPrefix(head, "ref:"); found {
		ref = strings.TrimSpace(ref)
		branch, isBranch := strings.CutPrefix(ref, "refs/heads/")
		if !isBranch || branch == "" {
			return ""
		}
		return clip(branch)
	}
	if (len(head) == 40 || len(head) == 64) && isHex(head) {
		return head[:7]
	}
	return ""
}

func readLine(path string) (string, error) {
	file, err := os.Open(path) // #nosec G304 -- a fixed name under a directory the picker is listing
	if err != nil {
		return "", err
	}
	data, err := io.ReadAll(io.LimitReader(file, headLimit))
	_ = file.Close()
	if err != nil {
		return "", err
	}
	line, _, _ := strings.Cut(string(data), "\n")
	if line == "" {
		return "", errors.New("empty")
	}
	return line, nil
}

func isHex(s string) bool {
	for _, r := range s {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') {
			return false
		}
	}
	return true
}

func clip(branch string) string {
	if len(branch) > maxBranch {
		return branch[:maxBranch]
	}
	return branch
}
