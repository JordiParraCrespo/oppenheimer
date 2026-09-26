package arch

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The error catalog is this service's public contract: a code is a stable
// identifier a client branches on and a row on the docs site. Nothing stops a
// second context from reusing `SESS_001` by copy-paste, and nothing stops a
// new code from never reaching the reference page — so these two tests do,
// the same way TestImportBoundaries holds the hexagon.
//
// cosmos-sdk keeps a registry of (codespace, code) and complains when one is
// registered twice; we have no registry to hook into because the catalog is
// package-level values, so the source is what gets walked. Same guarantee,
// same place it fails: before the code is pushed.

var catalogEntry = regexp.MustCompile(`problem\.New\("([A-Z][A-Z0-9_]*)"`)

// docsPage is the reference every `type` URI resolves to.
const docsPage = "../../../docs/docs/errors.md"

func catalogCodes(t *testing.T) map[string]string {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	codes := map[string]string{}
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}
		source, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		rel, _ := filepath.Rel(root, path)
		for _, match := range catalogEntry.FindAllStringSubmatch(string(source), -1) {
			code := match[1]
			if previous, taken := codes[code]; taken {
				t.Errorf("error code %s is registered twice: %s and %s", code, previous, rel)
				continue
			}
			codes[code] = rel
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return codes
}

func TestErrorCodesAreUnique(t *testing.T) {
	if codes := catalogCodes(t); len(codes) == 0 {
		t.Fatal("no catalog entries found; the walk is broken, not the catalog")
	}
}

func TestEveryErrorCodeIsDocumented(t *testing.T) {
	page, err := os.ReadFile(docsPage)
	if err != nil {
		t.Skipf("the docs site is not in this checkout: %v", err)
	}
	reference := string(page)

	for code, file := range catalogCodes(t) {
		if !strings.Contains(reference, "`"+code+"`") {
			t.Errorf("error code %s (%s) has no row in docs/docs/errors.md; a `type` URI that resolves to nothing is worse than none", code, file)
		}
	}
}
