package selfupdate_test

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
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

func signedManifest(t *testing.T, m selfupdate.Manifest) ([]byte, string, ed25519.PublicKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return raw, base64.StdEncoding.EncodeToString(ed25519.Sign(priv, raw)), pub
}

func manifest() selfupdate.Manifest {
	return selfupdate.Manifest{
		Schema:       selfupdate.Schema,
		Channel:      "stable",
		Version:      "1.2.3",
		MinSupported: "1.0.0",
		Artifacts: map[string]selfupdate.Artifact{
			"linux/amd64": {URL: "https://example.test/a.tar.gz", SHA256: "ab", Size: 1},
		},
	}
}

func TestParseManifestAcceptsASignedDocument(t *testing.T) {
	raw, sig, pub := signedManifest(t, manifest())

	m, err := selfupdate.ParseManifest(raw, sig, []ed25519.PublicKey{pub})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if m.Version != "1.2.3" {
		t.Fatalf("version = %q", m.Version)
	}
}

func TestParseManifestRejectsATamperedDocument(t *testing.T) {
	raw, sig, pub := signedManifest(t, manifest())
	tampered := bytes.Replace(raw, []byte(`"1.2.3"`), []byte(`"9.9.9"`), 1)

	_, err := selfupdate.ParseManifest(tampered, sig, []ed25519.PublicKey{pub})
	if !errors.Is(err, selfupdate.ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

func TestParseManifestRejectsAnotherKeysSignature(t *testing.T) {
	raw, sig, _ := signedManifest(t, manifest())
	other, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := selfupdate.ParseManifest(raw, sig, []ed25519.PublicKey{other}); !errors.Is(err, selfupdate.ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

func TestParseManifestAcceptsAnyKeyInTheList(t *testing.T) {
	raw, sig, pub := signedManifest(t, manifest())
	retired, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}

	// A key roll ships the retired key alongside the current one.
	if _, err := selfupdate.ParseManifest(raw, sig, []ed25519.PublicKey{retired, pub}); err != nil {
		t.Fatalf("verify with two keys: %v", err)
	}
}

func TestParseManifestRejectsAnUnknownSchema(t *testing.T) {
	m := manifest()
	m.Schema = "oppenheimer.release/v2"
	raw, sig, pub := signedManifest(t, m)

	if _, err := selfupdate.ParseManifest(raw, sig, []ed25519.PublicKey{pub}); !errors.Is(err, selfupdate.ErrSchema) {
		t.Fatalf("err = %v, want ErrSchema", err)
	}
}

func TestParseManifestWithoutKeysIsAnError(t *testing.T) {
	raw, sig, _ := signedManifest(t, manifest())

	if _, err := selfupdate.ParseManifest(raw, sig, nil); !errors.Is(err, selfupdate.ErrNoKeys) {
		t.Fatalf("err = %v, want ErrNoKeys", err)
	}
}

func TestParsePublicKeysSkipsCommentsAndBlanks(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	block := "# current\n" + base64.StdEncoding.EncodeToString(pub) + "\n\n"

	keys, err := selfupdate.ParsePublicKeys(block)
	if err != nil {
		t.Fatal(err)
	}
	if len(keys) != 1 || !keys[0].Equal(pub) {
		t.Fatalf("keys = %v", keys)
	}
}

func TestParsePublicKeysRejectsAShortKey(t *testing.T) {
	if _, err := selfupdate.ParsePublicKeys(base64.StdEncoding.EncodeToString([]byte("short"))); err == nil {
		t.Fatal("want an error for a key that is not 32 bytes")
	}
}

func serveBytes(t *testing.T, body []byte) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchWritesAnArtifactWhoseDigestMatches(t *testing.T) {
	body := []byte("a runner binary")
	sum := sha256.Sum256(body)
	srv := serveBytes(t, body)
	dest := filepath.Join(t.TempDir(), "staged")

	err := selfupdate.Fetch(context.Background(), srv.Client(), selfupdate.Artifact{
		URL: srv.URL, SHA256: hex.EncodeToString(sum[:]), Size: int64(len(body)),
	}, dest)
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	got, err := os.ReadFile(dest)
	if err != nil || !bytes.Equal(got, body) {
		t.Fatalf("file = %q, err = %v", got, err)
	}
}

func TestFetchLeavesNothingBehindOnADigestMismatch(t *testing.T) {
	srv := serveBytes(t, []byte("not the binary you signed"))
	sum := sha256.Sum256([]byte("the binary you signed"))
	dest := filepath.Join(t.TempDir(), "staged")

	err := selfupdate.Fetch(context.Background(), srv.Client(), selfupdate.Artifact{
		URL: srv.URL, SHA256: hex.EncodeToString(sum[:]),
	}, dest)
	if !errors.Is(err, selfupdate.ErrDigest) {
		t.Fatalf("err = %v, want ErrDigest", err)
	}
	if _, err := os.Stat(dest); !os.IsNotExist(err) {
		t.Fatal("a file that failed verification must not survive on disk")
	}
}

func TestFetchRejectsABodyLongerThanTheManifestSays(t *testing.T) {
	body := bytes.Repeat([]byte("x"), 100)
	sum := sha256.Sum256(body)
	srv := serveBytes(t, body)
	dest := filepath.Join(t.TempDir(), "staged")

	err := selfupdate.Fetch(context.Background(), srv.Client(), selfupdate.Artifact{
		URL: srv.URL, SHA256: hex.EncodeToString(sum[:]), Size: 10,
	}, dest)
	if !errors.Is(err, selfupdate.ErrSize) {
		t.Fatalf("err = %v, want ErrSize", err)
	}
}

func tarGz(t *testing.T, name string, content []byte) string {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(content)), Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write(content); err != nil {
		t.Fatal(err)
	}
	for _, c := range []interface{ Close() error }{tw, gz} {
		if err := c.Close(); err != nil {
			t.Fatal(err)
		}
	}
	path := filepath.Join(t.TempDir(), "a.tar.gz")
	if err := os.WriteFile(path, buf.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestUnpackExtractsTheBinaryExecutable(t *testing.T) {
	archive := tarGz(t, "runner_1.2.3_linux_amd64/runner", []byte("#!/bin/true\n"))
	dest := filepath.Join(t.TempDir(), "runner")

	if err := selfupdate.Unpack(archive, "runner", dest); err != nil {
		t.Fatalf("unpack: %v", err)
	}
	info, err := os.Stat(dest)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o700 {
		t.Fatalf("mode = %v, want 0700", info.Mode().Perm())
	}
}

func TestUnpackFailsWhenTheArchiveHasNoSuchMember(t *testing.T) {
	archive := tarGz(t, "README.md", []byte("hello"))

	err := selfupdate.Unpack(archive, "runner", filepath.Join(t.TempDir(), "runner"))
	if !errors.Is(err, selfupdate.ErrMemberAbsent) {
		t.Fatalf("err = %v, want ErrMemberAbsent", err)
	}
}

func layoutWithVersion(t *testing.T, version string) selfupdate.Layout {
	t.Helper()
	l, err := selfupdate.NewLayout(t.TempDir(), "runner")
	if err != nil {
		t.Fatal(err)
	}
	staged := filepath.Join(l.StagingDir(), "staged")
	if err := os.WriteFile(staged, []byte(version), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := l.Promote(staged, version); err != nil {
		t.Fatal(err)
	}
	return l
}

func TestActivatePointsCurrentAtAVersion(t *testing.T) {
	l := layoutWithVersion(t, "1.0.0")

	if err := l.Activate("1.0.0"); err != nil {
		t.Fatalf("activate: %v", err)
	}
	got, err := l.Current()
	if err != nil || got != "1.0.0" {
		t.Fatalf("current = %q, err = %v", got, err)
	}
	body, err := os.ReadFile(l.CurrentPath())
	if err != nil || string(body) != "1.0.0" {
		t.Fatalf("current resolves to %q, err = %v", body, err)
	}
}

func TestActivateReplacesAnExistingCurrent(t *testing.T) {
	l := layoutWithVersion(t, "1.0.0")
	if err := l.Activate("1.0.0"); err != nil {
		t.Fatal(err)
	}
	staged := filepath.Join(l.StagingDir(), "next")
	if err := os.WriteFile(staged, []byte("2.0.0"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := l.Promote(staged, "2.0.0"); err != nil {
		t.Fatal(err)
	}

	if err := l.Activate("2.0.0"); err != nil {
		t.Fatalf("activate: %v", err)
	}
	got, _ := l.Current()
	if got != "2.0.0" {
		t.Fatalf("current = %q, want 2.0.0", got)
	}

	// Rolling back is the same operation the other way, and the old binary
	// is still on disk for it.
	if err := l.Activate("1.0.0"); err != nil {
		t.Fatalf("rollback: %v", err)
	}
	if got, _ := l.Current(); got != "1.0.0" {
		t.Fatalf("after rollback current = %q", got)
	}
}

func TestActivateRefusesAVersionThatIsNotInstalled(t *testing.T) {
	l := layoutWithVersion(t, "1.0.0")

	if err := l.Activate("3.0.0"); !errors.Is(err, selfupdate.ErrVersionMissing) {
		t.Fatalf("err = %v, want ErrVersionMissing", err)
	}
}

func TestVersionPathRefusesAPathTraversal(t *testing.T) {
	l := layoutWithVersion(t, "2.5.0")

	if _, err := l.VersionPath("../../etc/cron.d/evil"); !errors.Is(err, selfupdate.ErrVersionName) {
		t.Fatalf("err = %v, want ErrVersionName", err)
	}
}

func TestPruneKeepsOnlyTheVersionsNamed(t *testing.T) {
	l := layoutWithVersion(t, "1.0.0")
	for _, v := range []string{"1.1.0", "1.2.0", "1.3.0"} {
		staged := filepath.Join(l.StagingDir(), v)
		if err := os.WriteFile(staged, []byte(v), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := l.Promote(staged, v); err != nil {
			t.Fatal(err)
		}
	}
	if err := l.Activate("1.3.0"); err != nil {
		t.Fatal(err)
	}

	// The running version and the one a rollback returns to.
	if err := l.Prune("1.3.0", "1.2.0"); err != nil {
		t.Fatalf("prune: %v", err)
	}

	versions, err := l.Versions()
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, v := range versions {
		got[v] = true
	}
	if !got["1.3.0"] || !got["1.2.0"] || len(versions) != 2 {
		t.Fatalf("versions = %v, want exactly the two named", versions)
	}
	if _, err := l.Current(); err != nil {
		t.Fatalf("current must still resolve after a prune: %v", err)
	}
}
