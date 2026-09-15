// Package config is the environment-loading toolkit every Go service
// shares: the root .env loader that mirrors @oppenheimer/env, and typed accessors
// that collect every parse error so a misconfigured process reports all of
// them at once.
package config

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// workspaceMarker identifies the monorepo root: the file that declares the
// pnpm workspace is exactly what `@oppenheimer/env` looks for.
const workspaceMarker = "pnpm-workspace.yaml"

// FindWorkspaceRoot walks up from dir until it finds the marker.
func FindWorkspaceRoot(dir string) (string, bool) {
	for {
		if _, err := os.Stat(filepath.Join(dir, workspaceMarker)); err == nil {
			return dir, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

// LoadDotenv applies the root `.env` then `.env.local` (local wins between
// the files) without overwriting anything already in the environment — real
// variables always win, which is what makes the same binary correct in CI
// and in a container. A missing file is not an error.
func LoadDotenv(root string) error {
	for _, name := range []string{".env.local", ".env"} {
		if err := applyFile(filepath.Join(root, name)); err != nil {
			return err
		}
	}
	return nil
}

func applyFile(path string) error {
	f, err := os.Open(path) //nolint:gosec // path is <workspace root>/.env, derived from a marker file, not from input
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = parseValue(value)
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	return sc.Err()
}

// parseValue handles the dotenv quoting rules `@oppenheimer/env` accepts: bare
// values lose trailing comments and whitespace, quoted values keep
// everything inside the quotes.
func parseValue(raw string) string {
	v := strings.TrimSpace(raw)
	if len(v) >= 2 {
		switch {
		case v[0] == '"' && v[len(v)-1] == '"':
			return strings.ReplaceAll(v[1:len(v)-1], `\n`, "\n")
		case v[0] == '\'' && v[len(v)-1] == '\'':
			return v[1 : len(v)-1]
		}
	}
	if i := strings.Index(v, " #"); i >= 0 {
		v = strings.TrimSpace(v[:i])
	}
	return v
}
