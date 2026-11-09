package agenttrust

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// configFile is an agent's config or state file as the store reads it, ready
// to be written back. Every agent's file goes through it, so they share one
// policy:
//   - a symlink is followed to the file it names, even one that does not
//     exist yet, and that file is written, so a config kept in a dotfiles
//     repository stays a link into it;
//   - the file keeps its mode, and a new one is 0600;
//   - the write is a temporary file renamed over the old one, so a CLI
//     starting at the same moment reads the old file or the new one, never
//     half of either.
type configFile struct {
	path string
	mode fs.FileMode
	// raw is the file's content, nil when there is no file yet.
	raw []byte
}

func readConfig(path string) (configFile, error) {
	file := configFile{path: linkTarget(path), mode: 0o600}
	raw, err := os.ReadFile(file.path) //nolint:gosec // an agent's own config, where the runner was told it is
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return file, nil
	case err != nil:
		return file, err
	}
	if info, err := os.Stat(file.path); err == nil {
		file.mode = info.Mode().Perm()
	}
	file.raw = raw
	return file, nil
}

func (f configFile) write(data []byte) error {
	if err := os.MkdirAll(filepath.Dir(f.path), 0o700); err != nil {
		return err
	}
	return writeAtomic(f.path, data, f.mode)
}

// linkTarget is the file path names once every symlink on it is followed,
// whether or not that file exists yet.
func linkTarget(path string) string {
	for range 40 {
		target, err := os.Readlink(path)
		if err != nil {
			return path
		}
		if !filepath.IsAbs(target) {
			target = filepath.Join(filepath.Dir(path), target)
		}
		path = target
	}
	return path
}
