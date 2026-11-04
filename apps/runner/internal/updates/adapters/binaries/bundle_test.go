package binaries_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/binaries"
)

const bundle = "OppenheimerRunner.app"

func bundleStore(t *testing.T) (*binaries.Store, string) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "bin")
	store, err := binaries.New(binaries.Options{Dir: dir, Name: "runner", Bundle: bundle})
	if err != nil {
		t.Fatal(err)
	}
	return store, dir
}

// stageBundle writes a bundle for version where an unpack would leave it.
func stageBundle(t *testing.T, version string) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "staged.app")
	plist := "<plist><dict><key>CFBundleVersion</key>\n  <string>" + version + "</string></dict></plist>"
	for name, body := range map[string]string{
		"Contents/Info.plist":   plist,
		"Contents/MacOS/runner": "#!/bin/sh\necho " + version + "\n",
	} {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(body), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func install(t *testing.T, store *binaries.Store, version string) {
	t.Helper()
	if err := store.Promote(stageBundle(t, version), version); err != nil {
		t.Fatalf("promote %s: %v", version, err)
	}
	if err := store.Activate(version); err != nil {
		t.Fatalf("activate %s: %v", version, err)
	}
}

// What `current` runs, resolved the way the kernel resolves it.
func running(t *testing.T, dir string) (path, body string) {
	t.Helper()
	path, err := filepath.EvalSymlinks(filepath.Join(dir, "current"))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return path, string(raw)
}

// macOS keeps a permission for the program at the path it ran from. If an
// update or a rollback moved the executable, every grant on the host would
// be asked for again — the regression this layout exists to end.
func TestUpdatesAndRollbacksRunFromTheSameBundlePath(t *testing.T) {
	store, dir := bundleStore(t)
	install(t, store, "1.0.0")
	firstPath, _ := running(t, dir)

	install(t, store, "1.1.0")
	path, body := running(t, dir)
	if path != firstPath || !strings.Contains(body, "1.1.0") {
		t.Fatalf("after the update current runs %s (%q), want 1.1.0 at %s", path, body, firstPath)
	}
	if got, err := store.Current(); err != nil || got != "1.1.0" {
		t.Fatalf("Current() = %q, %v; want 1.1.0", got, err)
	}

	if err := store.Activate("1.0.0"); err != nil {
		t.Fatalf("roll back: %v", err)
	}
	path, body = running(t, dir)
	if path != firstPath || !strings.Contains(body, "1.0.0") {
		t.Fatalf("after the rollback current runs %s (%q), want 1.0.0 at %s", path, body, firstPath)
	}
	if want := filepath.Join(dir, bundle, "Contents", "MacOS", "runner"); path != want {
		t.Fatalf("current runs %s, want the live bundle %s", path, want)
	}
}

// A host a runner from before the bundle updated runs a bare binary. It
// must ask to be installed again, and stop asking once it runs the bundle.
func TestABareBinaryOnMacOSAsksToBeReinstalledAsTheBundle(t *testing.T) {
	store, dir := bundleStore(t)
	bare := filepath.Join(t.TempDir(), "runner")
	if err := os.WriteFile(bare, []byte("#!/bin/sh\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := store.Promote(bare, "1.0.0"); err != nil {
		t.Fatal(err)
	}
	if err := store.Activate("1.0.0"); err != nil {
		t.Fatal(err)
	}
	if !store.NeedsReinstall() {
		t.Fatal("a bare binary on the bundle layout does not ask to be reinstalled")
	}

	install(t, store, "1.0.0")
	if store.NeedsReinstall() {
		t.Fatal("still asks to be reinstalled after running the bundle")
	}
	if got, err := store.Current(); err != nil || got != "1.0.0" {
		t.Fatalf("Current() = %q, %v; want 1.0.0", got, err)
	}

	install(t, store, "1.1.0")
	if err := store.Prune("1.1.0"); err != nil {
		t.Fatal(err)
	}
	for _, gone := range []string{"runner-1.0.0", "runner-1.0.0.app"} {
		if _, err := os.Stat(filepath.Join(dir, gone)); !os.IsNotExist(err) {
			t.Fatalf("%s survived the prune: %v", gone, err)
		}
	}
	if _, body := running(t, dir); !strings.Contains(body, "1.1.0") {
		t.Fatalf("the prune touched the live bundle: %q", body)
	}
}

// The version is read from the plist as a plist, not as text: rcodesign or a
// hand edit may reflow it, and a misread version would make the rollback
// target the wrong copy.
func TestTheLiveVersionIsReadFromTheTopLevelDictionary(t *testing.T) {
	store, dir := bundleStore(t)
	install(t, store, "1.0.0")
	plist := `<?xml version="1.0"?>
<plist version="1.0"><dict>
  <key>Nested</key><dict><key>CFBundleVersion</key><string>9.9.9</string></dict>
  <key>LSUIElement</key><true/>
  <key>CFBundleVersion</key>
      <string>
        2.0.0
      </string>
</dict></plist>`
	if err := os.WriteFile(filepath.Join(dir, bundle, "Contents", "Info.plist"), []byte(plist), 0o600); err != nil {
		t.Fatal(err)
	}
	if got, err := store.Current(); err != nil || got != "2.0.0" {
		t.Fatalf("Current() = %q, %v; want 2.0.0", got, err)
	}
}
