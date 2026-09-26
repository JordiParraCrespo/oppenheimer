package system

import (
	"os"
	"strings"
)

// Ephemeral names the signs that this machine is somewhere whose filesystem
// disappears when a job ends: a container, a CI runner, a devcontainer, a
// cloud coding sandbox. Registration refuses one unless told otherwise,
// because pairing it spends a single-use token on a host that will be gone —
// and the console keeps showing it long after.
//
// It is evidence, not proof: a long-lived container someone runs on purpose
// is a legitimate host, which is what `register --allow-container` is for.
// An empty answer means nothing looked temporary. The environment is read
// through getenv, which the composition root passes, so this adapter reads
// no globals of its own.
func Ephemeral(getenv func(string) string) []string {
	return ephemeral(fileExists, os.ReadFile, getenv)
}

// ephemeralEnv are variables a CI system, a devcontainer or a cloud workspace
// sets for everything it runs, with the reason each is reported under.
var ephemeralEnv = []struct{ name, reason string }{
	{"CI", "CI is set, so this looks like a CI job"},
	{"GITHUB_ACTIONS", "GITHUB_ACTIONS is set, so this is a GitHub Actions runner"},
	{"CODESPACES", "CODESPACES is set, so this is a GitHub Codespace"},
	{"REMOTE_CONTAINERS", "REMOTE_CONTAINERS is set, so this is a devcontainer"},
	{"DEVCONTAINER", "DEVCONTAINER is set, so this is a devcontainer"},
	{"GITPOD_WORKSPACE_ID", "GITPOD_WORKSPACE_ID is set, so this is a Gitpod workspace"},
	{"KUBERNETES_SERVICE_HOST", "KUBERNETES_SERVICE_HOST is set, so this is a Kubernetes pod"},
}

// cgroupMarkers are what PID 1's cgroup path contains inside a container on a
// cgroup v1 host. On cgroup v2 the path is `/` inside and out, which is why the
// marker files are checked as well.
var cgroupMarkers = []string{"docker", "kubepods", "containerd", "libpod", "lxc"}

func ephemeral(exists func(string) bool, readFile func(string) ([]byte, error), getenv func(string) string) []string {
	var reasons []string
	if exists("/.dockerenv") {
		reasons = append(reasons, "/.dockerenv exists, so this is a Docker container")
	}
	if exists("/run/.containerenv") {
		reasons = append(reasons, "/run/.containerenv exists, so this is a Podman container")
	}
	if cgroup, err := readFile("/proc/1/cgroup"); err == nil {
		for _, marker := range cgroupMarkers {
			if strings.Contains(string(cgroup), marker) {
				reasons = append(reasons, "PID 1 runs in a "+marker+" cgroup, so this is a container")
				break
			}
		}
	}
	for _, env := range ephemeralEnv {
		if value := strings.TrimSpace(getenv(env.name)); value != "" && value != "0" && !strings.EqualFold(value, "false") {
			reasons = append(reasons, env.reason)
		}
	}
	return reasons
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
