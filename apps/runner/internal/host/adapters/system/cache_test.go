package system

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

const toolName = "opp-probe-tool"

// probeHarness is a prober over a PATH the test owns, counting how often it
// runs a tool to ask its version.
type probeHarness struct {
	prober *Prober
	mu     sync.Mutex
	calls  int
	clock  time.Time
}

func newProbeHarness(t *testing.T, dirs ...string) *probeHarness {
	t.Helper()
	t.Setenv("PATH", filepath.Join(dirs...))
	h := &probeHarness{clock: time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)}
	h.prober = &Prober{tools: map[string]toolEntry{}}
	h.prober.version = func(context.Context, string) string {
		h.mu.Lock()
		defer h.mu.Unlock()
		h.calls++
		return "opp-probe-tool 1.0"
	}
	h.prober.now = func() time.Time {
		h.mu.Lock()
		defer h.mu.Unlock()
		return h.clock
	}
	return h
}

func (h *probeHarness) probe(t *testing.T) string {
	t.Helper()
	tool := h.prober.Tool(context.Background(), toolName)
	if tool.Version == "" {
		t.Fatalf("tool = %+v, want it found with a version", tool)
	}
	return tool.Path
}

func (h *probeHarness) versionCalls() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.calls
}

func (h *probeHarness) advance(d time.Duration) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clock = h.clock.Add(d)
}

func executable(t *testing.T, dir string) string {
	t.Helper()
	path := filepath.Join(dir, toolName)
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho opp-probe-tool 1.0\n"), 0o755); err != nil { //nolint:gosec // a test executable
		t.Fatal(err)
	}
	return path
}

func TestAnUnchangedToolIsAskedItsVersionOnce(t *testing.T) {
	dir := t.TempDir()
	executable(t, dir)
	h := newProbeHarness(t, dir)

	h.probe(t)
	h.probe(t)
	h.probe(t)

	if got := h.versionCalls(); got != 1 {
		t.Fatalf("version calls = %d, want 1", got)
	}
}

func TestAChangedExecutableIsProbedAgain(t *testing.T) {
	dir := t.TempDir()
	path := executable(t, dir)
	h := newProbeHarness(t, dir)
	h.probe(t)

	later := time.Now().Add(time.Hour)
	if err := os.Chtimes(path, later, later); err != nil {
		t.Fatal(err)
	}
	h.probe(t)

	if got := h.versionCalls(); got != 2 {
		t.Fatalf("version calls = %d, want 2 after the file changed", got)
	}
}

func TestAToolFoundAtAnotherPathIsProbedAgain(t *testing.T) {
	first, second := t.TempDir(), t.TempDir()
	executable(t, first)
	h := newProbeHarness(t, first)
	h.probe(t)

	executable(t, second)
	t.Setenv("PATH", second+string(os.PathListSeparator)+first)
	if path := h.probe(t); filepath.Dir(path) != second {
		t.Fatalf("path = %s, want the one now first on PATH", path)
	}

	if got := h.versionCalls(); got != 2 {
		t.Fatalf("version calls = %d, want 2 after the path changed", got)
	}
}

func TestACachedVersionExpires(t *testing.T) {
	dir := t.TempDir()
	executable(t, dir)
	h := newProbeHarness(t, dir)
	h.probe(t)

	h.advance(factsTTL - time.Second)
	h.probe(t)
	h.advance(2 * time.Second)
	h.probe(t)

	if got := h.versionCalls(); got != 2 {
		t.Fatalf("version calls = %d, want 2: one cached, one past the TTL", got)
	}
}

func TestInvalidateProbesAfresh(t *testing.T) {
	dir := t.TempDir()
	executable(t, dir)
	h := newProbeHarness(t, dir)
	h.probe(t)

	h.prober.Invalidate()
	h.probe(t)

	if got := h.versionCalls(); got != 2 {
		t.Fatalf("version calls = %d, want 2 after Invalidate", got)
	}
}

func TestAnUninstalledToolIsGoneAtOnce(t *testing.T) {
	dir := t.TempDir()
	path := executable(t, dir)
	h := newProbeHarness(t, dir)
	h.probe(t)

	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}

	if tool := h.prober.Tool(context.Background(), toolName); tool.Found() {
		t.Fatalf("tool = %+v, want not found once it is off PATH", tool)
	}
}
