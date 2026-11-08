package argent

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// A host that names no devices offers the booted simulators: a shut-down
// one offered would hand a session a device with no screen to stream.
func TestSimctlOffersOnlyBootedSimulators(t *testing.T) {
	out := []byte(`{"devices":{
		"com.apple.CoreSimulator.SimRuntime.iOS-26-5":[
			{"udid":"B-UDID","name":"iPhone 17","state":"Booted"},
			{"udid":"S-UDID","name":"iPhone 17 Pro","state":"Shutdown"}],
		"com.apple.CoreSimulator.SimRuntime.iOS-18-0":[
			{"udid":"A-UDID","name":"iPhone 16","state":"Booted"}]}}`)
	got, err := parseSimctl(out)
	if err != nil {
		t.Fatal(err)
	}
	want := []domain.Device{
		{Serial: "A-UDID", Name: "iPhone 16", Platform: domain.IOS},
		{Serial: "B-UDID", Name: "iPhone 17", Platform: domain.IOS},
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}

// A phone on USB is the person's own, and an emulator still booting has no
// screen yet: neither is handed to a session.
func TestADBOffersOnlyReadyEmulators(t *testing.T) {
	out := []byte("List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\nR58M123\tdevice\n\n")
	got := parseADB(out)
	if len(got) != 1 || got[0] != "emulator-5554" {
		t.Fatalf("got %v, want [emulator-5554]", got)
	}
}

// Argent restarts its tool-server on a new port and token; the reader's
// taps go to the one running now, never to a stale file's.
func TestToolServerIsTheRunningOne(t *testing.T) {
	home := t.TempDir()
	write := func(name string, pid, port int) {
		body := `{"host":"127.0.0.1","port":` + strconv.Itoa(port) + `,"token":"t` + strconv.Itoa(port) + `","pid":` + strconv.Itoa(pid) + `}`
		if err := os.WriteFile(filepath.Join(home, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := readToolServer(home); err == nil {
		t.Fatal("no tool-server file read as a running server")
	}
	write("tool-server-gone.json", 1<<22+7, 1111) // a pid no process has
	write("tool-server-live.json", os.Getpid(), 2222)
	url, token, err := readToolServer(home)
	if err != nil {
		t.Fatal(err)
	}
	if url != "http://127.0.0.1:2222" || token != "t2222" {
		t.Fatalf("got %s %s, want the live server", url, token)
	}
}
