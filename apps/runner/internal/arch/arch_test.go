// Package arch enforces the dependency rules of the hexagon the same way
// apps/api's dependency-cruiser does: a test that fails when an import
// crosses a boundary it must not.
//
// The shared toolkit lives in packages/go/* and is importable from any
// layer that the table below allows; the bounded contexts live under
// internal/ and may never import each other.
//
//   - `<ctx>/domain` imports only core/problem, auth/scope and the scope catalog.
//   - `<ctx>/app` adds auth (the Principal) and core — never an adapter,
//     never another context.
//   - `<ctx>/adapters/*` import their own context's app and domain plus any
//     packages/go module — never another context, never the composition root.
//   - `<ctx>/module.go` wires only its own context.
//   - `server` and `config` (the composition root) may import anything, and
//     so may `cli`, which is the composition root of the subcommands.
package arch

import (
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	modulePrefix = "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/"
	sharedPrefix = "github.com/jordiparracrespo/oppenheimer/packages/go/"
)

var contexts = []string{"apikeys", "host", "pairing", "service", "updates"}

func TestImportBoundaries(t *testing.T) {
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	var violations []string
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		pkg := filepath.ToSlash(filepath.Dir(rel))
		f, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, imp := range f.Imports {
			target := strings.Trim(imp.Path.Value, `"`)
			var reason string
			switch {
			case strings.HasPrefix(target, modulePrefix):
				reason = violatesInternal(pkg, strings.TrimPrefix(target, modulePrefix))
			case strings.HasPrefix(target, sharedPrefix):
				reason = violatesShared(pkg, strings.TrimPrefix(target, sharedPrefix))
			}
			if reason != "" {
				violations = append(violations, rel+" imports "+target+": "+reason)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range violations {
		t.Error(v)
	}
}

// violatesShared decides which packages/go modules a layer may use.
func violatesShared(from, to string) string {
	_, layer := split(from)
	switch layer {
	case "domain":
		if to == "core/problem" || to == "auth/scope" {
			return ""
		}
		return "domain may only use core/problem and auth/scope from the shared toolkit"
	case "app":
		if to == "auth" || to == "auth/scope" || strings.HasPrefix(to, "core/") {
			return ""
		}
		return "app may only use auth and core from the shared toolkit"
	}
	return ""
}

// violatesInternal decides which internal packages a layer may use.
func violatesInternal(from, to string) string {
	fromCtx, fromLayer := split(from)
	toCtx, _ := split(to)

	switch {
	case fromLayer == "domain":
		if to == "scopes" {
			return ""
		}
		return "domain must stay free of infrastructure"

	case fromLayer == "app":
		if toCtx == fromCtx && strings.HasSuffix(to, "/domain") {
			return ""
		}
		if to == "scopes" {
			return ""
		}
		return "app may only import its domain and the scope catalog"

	case strings.HasPrefix(fromLayer, "adapters/"):
		if toCtx == fromCtx && !strings.Contains(strings.TrimPrefix(to, fromCtx+"/"), "adapters/") {
			return ""
		}
		if toCtx == fromCtx && strings.HasPrefix(to, fromCtx+"/adapters/ws") && strings.HasPrefix(from, fromCtx+"/adapters/http") {
			// The REST adapter reuses the wire struct so both surfaces match.
			return ""
		}
		if to == "scopes" {
			return ""
		}
		return "adapters may only import their own context and the shared toolkit"

	case fromLayer == "" && fromCtx != "":
		// module.go: the context's own wiring.
		if toCtx == fromCtx || to == "scopes" {
			return ""
		}
		return "a module wires only its own context"
	}
	return ""
}

// split turns `apikeys/adapters/http` into ("apikeys", "adapters/http") and a
// non-context package into ("", "").
func split(pkg string) (ctx, layer string) {
	parts := strings.SplitN(pkg, "/", 2)
	if !isContext(parts[0]) {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], parts[1]
}

func isContext(name string) bool {
	for _, c := range contexts {
		if c == name {
			return true
		}
	}
	return false
}
