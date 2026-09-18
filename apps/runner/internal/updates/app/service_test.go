package app_test

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/binaries"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/release"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

// restarter records the restart an update asks for.
type restarter struct {
	calls int
	err   error
}

func (r *restarter) Restart(context.Context) error { r.calls++; return r.err }

// releaseServer is a signed release host: it serves `<channel>.json`, its
// detached signature, and the artifact itself.
type releaseServer struct {
	*httptest.Server
	keys    string
	target  string
	version string
	// selfCheckExit is the exit code of the shipped binary's `selfcheck`.
	selfCheckExit int
	// corrupt serves an artifact that does not match the signed digest.
	corrupt bool
	// signWith replaces the signing key, to fake a forged manifest.
	signWith ed25519.PrivateKey
}

func newReleaseServer(t *testing.T, version string) *releaseServer {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	rs := &releaseServer{
		keys:     base64.StdEncoding.EncodeToString(pub),
		target:   "linux/amd64",
		version:  version,
		signWith: priv,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		archive := rs.archive(t)
		sum := sha256.Sum256(archive)
		switch {
		case strings.HasSuffix(r.URL.Path, ".tar.gz"):
			if rs.corrupt {
				_, _ = w.Write([]byte("this is not the binary that was signed"))
				return
			}
			_, _ = w.Write(archive)
		case strings.HasSuffix(r.URL.Path, ".json.sig"):
			raw := rs.manifest(t, hex.EncodeToString(sum[:]), int64(len(archive)))
			_, _ = w.Write([]byte(base64.StdEncoding.EncodeToString(ed25519.Sign(rs.signWith, raw))))
		case strings.HasSuffix(r.URL.Path, ".json"):
			_, _ = w.Write(rs.manifest(t, hex.EncodeToString(sum[:]), int64(len(archive))))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
	rs.Server = httptest.NewServer(mux)
	t.Cleanup(rs.Close)
	return rs
}

func (rs *releaseServer) manifest(t *testing.T, digest string, size int64) []byte {
	t.Helper()
	raw, err := json.Marshal(selfupdate.Manifest{
		Schema:  selfupdate.Schema,
		Channel: "stable",
		Version: rs.version,
		Artifacts: map[string]selfupdate.Artifact{
			rs.target: {URL: rs.URL + "/runner.tar.gz", SHA256: digest, Size: size},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// archive is a tarball holding a `runner` that answers `selfcheck`.
func (rs *releaseServer) archive(t *testing.T) []byte {
	t.Helper()
	script := "#!/bin/sh\nexit " + string(rune('0'+rs.selfCheckExit)) + "\n"
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{Name: "runner", Mode: 0o755, Size: int64(len(script)), Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write([]byte(script)); err != nil {
		t.Fatal(err)
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

type harness struct {
	svc      *app.Service
	store    *binaries.Store
	state    *state.Store
	restarts *restarter
	home     string
}

func newHarness(t *testing.T, rs *releaseServer, running string) *harness {
	t.Helper()
	home := t.TempDir()
	store, err := binaries.New(binaries.Options{Dir: filepath.Join(home, "bin"), Name: "runner", HTTP: rs.Client()})
	if err != nil {
		t.Fatal(err)
	}
	// The version that is running has to exist on disk to roll back to.
	seed := filepath.Join(home, "seed")
	if err := os.WriteFile(seed, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := store.Promote(seed, running); err != nil {
		t.Fatal(err)
	}
	if err := store.Activate(running); err != nil {
		t.Fatal(err)
	}

	stateStore := state.New(filepath.Join(home, "state"))
	restarts := &restarter{}
	svc := app.New(app.Options{
		Releases: release.New(release.Options{
			BaseURL: rs.URL, Target: rs.target, HTTP: rs.Client(), Keys: rs.keys,
		}),
		Binaries: store, Restarter: restarts, State: stateStore,
		Version: running, Channel: "stable",
	})
	return &harness{svc: svc, store: store, state: stateStore, restarts: restarts, home: home}
}

func TestApplyInstallsActivatesAndRestarts(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")

	plan, err := h.svc.Apply(context.Background(), app.ApplyOptions{})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if plan.Action != domain.ActionUpdateNow || plan.To != "1.1.0" {
		t.Fatalf("plan = %+v", plan)
	}
	if got, _ := h.store.Current(); got != "1.1.0" {
		t.Fatalf("current = %q, want 1.1.0", got)
	}
	if h.restarts.calls != 1 {
		t.Fatalf("restarts = %d, want exactly one", h.restarts.calls)
	}
	// The record is what the next process reads to finish the job.
	recorded, err := h.state.Load()
	if err != nil {
		t.Fatal(err)
	}
	if recorded.Phase != domain.PhasePending || recorded.From != "1.0.0" || recorded.To != "1.1.0" {
		t.Fatalf("state = %+v", recorded)
	}
}

func TestApplyRefusesAManifestSignedByAnotherKey(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	_, forged, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	rs.signWith = forged // the server signs with a key the runner does not trust
	h := newHarness(t, rs, "1.0.0")

	_, err = h.svc.Apply(context.Background(), app.ApplyOptions{})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_001" {
		t.Fatalf("err = %v, want UPD_001", err)
	}
	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q; a forged manifest must change nothing", got)
	}
	if h.restarts.calls != 0 {
		t.Fatal("nothing may be restarted when the manifest does not verify")
	}
}

func TestApplyRefusesAnArtifactThatDoesNotMatchTheSignedDigest(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	rs.corrupt = true
	h := newHarness(t, rs, "1.0.0")

	_, err := h.svc.Apply(context.Background(), app.ApplyOptions{})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_002" {
		t.Fatalf("err = %v, want UPD_002", err)
	}
	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q; a swapped artifact must change nothing", got)
	}
}

func TestApplyStopsWhenTheNewBinaryFailsItsSelfCheck(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	rs.selfCheckExit = 1
	h := newHarness(t, rs, "1.0.0")

	_, err := h.svc.Apply(context.Background(), app.ApplyOptions{})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_005" {
		t.Fatalf("err = %v, want UPD_005", err)
	}
	// The old binary is still the service: this is the whole point of
	// running the check before the swap.
	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q, want the old version still linked", got)
	}
	if h.restarts.calls != 0 {
		t.Fatal("a binary that failed its self-check must not cause a restart")
	}
}

func TestApplyDoesNothingWhenTheHostIsCurrent(t *testing.T) {
	rs := newReleaseServer(t, "2.0.0")
	h := newHarness(t, rs, "2.0.0")

	plan, err := h.svc.Apply(context.Background(), app.ApplyOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Action != domain.ActionNone || h.restarts.calls != 0 {
		t.Fatalf("plan = %+v, restarts = %d", plan, h.restarts.calls)
	}
}

func TestNoteBootRollsBackAfterTheAttemptsAreSpent(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	if _, err := h.svc.Apply(context.Background(), app.ApplyOptions{}); err != nil {
		t.Fatal(err)
	}

	// The new version is running now, and it never reaches the health gate.
	restarts := &restarter{}
	booted := app.New(app.Options{
		Binaries: h.store, Restarter: restarts, State: h.state, Version: "1.1.0",
	})
	for i := 0; i < domain.MaxAttempts; i++ {
		if _, err := booted.NoteBoot(context.Background()); err != nil {
			t.Fatalf("boot %d: %v", i+1, err)
		}
	}

	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q, want the rollback to 1.0.0", got)
	}
	if restarts.calls != 1 {
		t.Fatalf("restarts = %d, want one restart into the old version", restarts.calls)
	}
	recorded, _ := h.state.Load()
	if recorded.Phase != domain.PhaseRolled {
		t.Fatalf("state = %+v, want it recorded as rolled back", recorded)
	}
}

func TestMarkHealthyClosesTheUpdateAndKeepsTheRollbackTarget(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	if _, err := h.svc.Apply(context.Background(), app.ApplyOptions{}); err != nil {
		t.Fatal(err)
	}

	booted := app.New(app.Options{Binaries: h.store, State: h.state, Version: "1.1.0"})
	if _, err := booted.NoteBoot(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := booted.MarkHealthy(); err != nil {
		t.Fatalf("mark healthy: %v", err)
	}

	recorded, _ := h.state.Load()
	if recorded.Phase != domain.PhaseHealthy {
		t.Fatalf("state = %+v", recorded)
	}
	// A later boot of the same version must not be counted against an
	// update that already succeeded.
	if _, err := booted.NoteBoot(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got, _ := h.store.Current(); got != "1.1.0" {
		t.Fatalf("current = %q; a healthy version is never rolled back", got)
	}
}

func TestApplyWaitsForAQuietMomentUnlessForced(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	busy := app.New(app.Options{
		Releases: release.New(release.Options{BaseURL: rs.URL, Target: rs.target, HTTP: rs.Client(), Keys: rs.keys}),
		Binaries: h.store, Restarter: h.restarts, State: h.state, Version: "1.0.0", Channel: "stable",
		Activities: busyHost{},
	})

	plan, err := busy.Apply(context.Background(), app.ApplyOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Action != domain.ActionUpdate || h.restarts.calls != 0 {
		t.Fatalf("plan = %+v, restarts = %d, want it to wait", plan, h.restarts.calls)
	}

	// Force is the console's Update now button: it skips the window, never
	// a signature.
	if _, err := busy.Apply(context.Background(), app.ApplyOptions{Force: true}); err != nil {
		t.Fatalf("forced apply: %v", err)
	}
	if got, _ := h.store.Current(); got != "1.1.0" {
		t.Fatalf("current = %q, want the forced update applied", got)
	}
}

type busyHost struct{}

func (busyHost) Snapshot() domain.Activity {
	return domain.Activity{WorkingSessions: 2, AttachedClients: 1}
}

func TestCheckOnABuildWithNoReleaseKeyRefusesToUpdate(t *testing.T) {
	svc := app.New(app.Options{
		Releases: release.New(release.Options{BaseURL: "https://get.oppenheimer.dev", Keys: ""}),
		Version:  "1.0.0",
	})

	_, err := svc.Check(context.Background())

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_008" {
		t.Fatalf("err = %v, want UPD_008: no key means no updates, never unsigned ones", err)
	}
}

func TestApplyRefusesAPinnedHostAndForceOverridesIt(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	pinned := app.New(app.Options{
		Releases: release.New(release.Options{BaseURL: rs.URL, Target: rs.target, HTTP: rs.Client(), Keys: rs.keys}),
		Binaries: h.store, Restarter: h.restarts, State: h.state,
		Version: "1.0.0", Channel: "stable", Pinned: "1.0.0",
	})

	_, err := pinned.Apply(context.Background(), app.ApplyOptions{})
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_004" {
		t.Fatalf("err = %v, want UPD_004", err)
	}

	if _, err := pinned.Apply(context.Background(), app.ApplyOptions{Force: true}); err != nil {
		t.Fatalf("forced apply on a pinned host: %v", err)
	}
	if got, _ := h.store.Current(); got != "1.1.0" {
		t.Fatalf("current = %q", got)
	}
}
