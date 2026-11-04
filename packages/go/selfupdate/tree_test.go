package selfupdate_test

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

type member struct {
	name, body, link string
	dir              bool
	mode             int64
}

func treeArchive(t *testing.T, members ...member) string {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, m := range members {
		hdr := &tar.Header{Name: m.name, Mode: m.mode, Size: int64(len(m.body)), Typeflag: tar.TypeReg}
		switch {
		case m.dir:
			hdr.Typeflag, hdr.Size = tar.TypeDir, 0
		case m.link != "":
			hdr.Typeflag, hdr.Linkname, hdr.Size = tar.TypeSymlink, m.link, 0
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if hdr.Size > 0 {
			if _, err := tw.Write([]byte(m.body)); err != nil {
				t.Fatal(err)
			}
		}
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

// A macOS release carries an app bundle, which is a tree: unpacking only the
// binary would drop the Info.plist and signature that give it its identity.
func TestUnpackTreeExtractsTheBundleAndKeepsTheExecutableBit(t *testing.T) {
	archive := treeArchive(t,
		member{name: "runner_1.2.3_darwin_arm64/", dir: true, mode: 0o755},
		member{name: "runner_1.2.3_darwin_arm64/LICENSE", body: "MIT", mode: 0o644},
		member{name: "runner_1.2.3_darwin_arm64/Runner.app/", dir: true, mode: 0o755},
		member{name: "runner_1.2.3_darwin_arm64/Runner.app/Contents/Info.plist", body: "<plist/>", mode: 0o644},
		member{name: "runner_1.2.3_darwin_arm64/Runner.app/Contents/MacOS/runner", body: "#!/bin/true\n", mode: 0o755},
	)
	dest := filepath.Join(t.TempDir(), "staged.app")

	if err := selfupdate.UnpackTree(archive, "Runner.app", dest); err != nil {
		t.Fatalf("unpack: %v", err)
	}
	exe, err := os.Stat(filepath.Join(dest, "Contents", "MacOS", "runner"))
	if err != nil || exe.Mode().Perm() != 0o700 {
		t.Fatalf("executable = %v, %v; want mode 0700", exe, err)
	}
	plist, err := os.Stat(filepath.Join(dest, "Contents", "Info.plist"))
	if err != nil || plist.Mode().Perm() != 0o600 {
		t.Fatalf("Info.plist = %v, %v; want mode 0600", plist, err)
	}
	if _, err := os.Stat(filepath.Join(dest, "LICENSE")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("a file outside the bundle was unpacked into it: %v", err)
	}
}

// A link in a bundle can point anywhere on the host; the bundle is refused
// and nothing of it stays behind.
func TestUnpackTreeRefusesALinkAndLeavesNothing(t *testing.T) {
	archive := treeArchive(t,
		member{name: "Runner.app/Contents/MacOS/runner", body: "#!/bin/true\n", mode: 0o755},
		member{name: "Runner.app/Contents/Resources", link: "/etc"},
	)
	dest := filepath.Join(t.TempDir(), "staged.app")

	err := selfupdate.UnpackTree(archive, "Runner.app", dest)
	if !errors.Is(err, selfupdate.ErrTreeMember) {
		t.Fatalf("err = %v, want ErrTreeMember", err)
	}
	if _, err := os.Stat(dest); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("dest survived a refused unpack: %v", err)
	}
}

// A release from before the bundle has none; the caller falls back to Unpack.
func TestUnpackTreeReportsAnArchiveWithoutTheTree(t *testing.T) {
	archive := treeArchive(t, member{name: "runner_1.2.3_darwin_arm64/runner", body: "#!/bin/true\n", mode: 0o755})

	err := selfupdate.UnpackTree(archive, "Runner.app", filepath.Join(t.TempDir(), "staged.app"))
	if !errors.Is(err, selfupdate.ErrMemberAbsent) {
		t.Fatalf("err = %v, want ErrMemberAbsent", err)
	}
}
