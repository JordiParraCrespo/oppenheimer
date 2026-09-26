package system

import (
	"errors"
	"strings"
	"testing"
)

func TestEphemeralNamesEachSignOfATemporaryMachine(t *testing.T) {
	files := map[string]string{"/proc/1/cgroup": "12:pids:/kubepods/burstable/pod1234\n"}
	exists := func(path string) bool { return path == "/.dockerenv" }
	readFile := func(path string) ([]byte, error) {
		if body, ok := files[path]; ok {
			return []byte(body), nil
		}
		return nil, errors.New("absent")
	}
	env := map[string]string{"CI": "true", "CODESPACES": "true"}

	reasons := ephemeral(exists, readFile, func(name string) string { return env[name] })

	joined := strings.Join(reasons, "\n")
	for _, want := range []string{"Docker container", "kubepods cgroup", "CI job", "GitHub Codespace"} {
		if !strings.Contains(joined, want) {
			t.Errorf("reasons do not mention %q:\n%s", want, joined)
		}
	}
}

func TestEphemeralIsQuietOnAnOrdinaryMachine(t *testing.T) {
	// A cgroup v2 host: PID 1 is in init.scope and no marker file exists. CI
	// set to "false" is the opposite of a CI job, not one.
	readFile := func(path string) ([]byte, error) {
		if path == "/proc/1/cgroup" {
			return []byte("0::/init.scope\n"), nil
		}
		return nil, errors.New("absent")
	}
	env := map[string]string{"CI": "false"}

	reasons := ephemeral(func(string) bool { return false }, readFile, func(name string) string { return env[name] })

	if len(reasons) != 0 {
		t.Fatalf("reasons = %v, want none", reasons)
	}
}
