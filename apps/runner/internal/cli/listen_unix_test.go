//go:build darwin || linux

package cli

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func isRunnerDirectoryRefusal(err error) bool {
	var refused *problem.Error
	return errors.As(err, &refused) && refused.Code == hostdomain.ErrRunnerDirectory.Code
}

// shortTempDir keeps the socket path under the platform's sun_path limit.
func shortTempDir(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "orl")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	return dir
}

func TestListenTightensALooseRunDirectoryBeforeTheSocketExists(t *testing.T) {
	home := filepath.Join(shortTempDir(t), "home")
	app := &App{Paths: Paths{Home: home}}
	// Created looser than Ensure would, the way an older version or a restored
	// backup might have left it. MkdirAll does not tighten an existing one.
	for _, dir := range []string{home, app.Paths.Run()} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}

	listener, err := app.listen(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	for _, dir := range []string{home, app.Paths.Run()} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatal(err)
		}
		if perm := info.Mode().Perm(); perm != 0o700 {
			t.Fatalf("%s is %#o, want 0700", dir, perm)
		}
	}
	info, err := os.Stat(app.Paths.Socket())
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("socket is %#o, want 0600", perm)
	}
}

func TestListenRefusesASymlinkedRunDirectory(t *testing.T) {
	root := shortTempDir(t)
	home := filepath.Join(root, "home")
	elsewhere := filepath.Join(root, "elsewhere")
	for _, dir := range []string{home, elsewhere} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	app := &App{Paths: Paths{Home: home}}
	if err := os.Symlink(elsewhere, app.Paths.Run()); err != nil {
		t.Fatal(err)
	}

	_, err := app.listen(context.Background())

	if !isRunnerDirectoryRefusal(err) {
		t.Fatalf("want ErrRunnerDirectory, got %v", err)
	}
	if _, statErr := os.Lstat(filepath.Join(elsewhere, "runner.sock")); !os.IsNotExist(statErr) {
		t.Fatalf("a socket was created through the symlink: %v", statErr)
	}
}

// ownedBy is a directory's FileInfo as another account would see its own.
type ownedBy struct {
	os.FileInfo
	uid uint32
}

func (o ownedBy) Sys() any { return &syscall.Stat_t{Uid: o.uid} }

func TestPrivateDirectoryRefusesADirectoryAnotherAccountOwns(t *testing.T) {
	dir := shortTempDir(t)
	stranger := func(path string) (os.FileInfo, error) {
		info, err := os.Lstat(path)
		if err != nil {
			return nil, err
		}
		return ownedBy{FileInfo: info, uid: uint32(os.Getuid()) + 1}, nil
	}

	err := privateDirectoryWith(dir, stranger, os.Getuid())

	if !isRunnerDirectoryRefusal(err) {
		t.Fatalf("want ErrRunnerDirectory, got %v", err)
	}
	if !strings.Contains(err.Error(), "not owned by this account") {
		t.Fatalf("the refusal should say why: %v", err)
	}
}

func TestPrivateDirectoryLeavesAPrivateDirectoryAlone(t *testing.T) {
	dir := shortTempDir(t)
	if err := os.Chmod(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	before, _ := os.Stat(dir)
	time.Sleep(10 * time.Millisecond)

	if err := privateDirectory(dir); err != nil {
		t.Fatal(err)
	}

	after, _ := os.Stat(dir)
	if after.Mode() != before.Mode() {
		t.Fatalf("mode changed from %v to %v", before.Mode(), after.Mode())
	}
}
