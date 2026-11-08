package argent

import (
	"cmp"
	"encoding/json"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"syscall"
)

// SimulatorServer finds Argent's simulator-server through the `argent` on
// PATH: the npm package it belongs to ships the binary at
// bin/<os>/simulator-server. Empty when Argent is not installed.
func SimulatorServer() string {
	cli, err := exec.LookPath("argent")
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(cli); err == nil {
		cli = resolved
	}
	for dir := filepath.Dir(cli); ; dir = filepath.Dir(dir) {
		candidate := filepath.Join(dir, "bin", runtime.GOOS, "simulator-server")
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
		if parent := filepath.Dir(dir); parent == dir {
			return ""
		}
	}
}

// toolServerFile is what Argent writes for each tool-server it starts
// (~/.argent/tool-server-<id>.json), the one its agents' MCP reaches.
type toolServerFile struct {
	Host  string `json:"host"`
	Port  int    `json:"port"`
	Token string `json:"token"`
	PID   int    `json:"pid"`
}

// errNoToolServer is a host whose Argent has no tool-server up: it starts
// with the first agent that uses Argent, and stops when idle.
var errNoToolServer = errors.New("argent's tool-server is not running: it starts when an agent first uses Argent")

// readToolServer finds a running tool-server in Argent's home, the one
// started most recently. A file whose process is gone is a server that
// stopped without cleaning up.
func readToolServer(home string) (url, token string, err error) {
	paths, _ := filepath.Glob(filepath.Join(home, "tool-server-*.json"))
	type found struct {
		file toolServerFile
		mod  int64
	}
	var servers []found
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		//nolint:gosec // a file Argent wrote in its own home, matched by name
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var file toolServerFile
		if json.Unmarshal(raw, &file) != nil || file.Port == 0 || !alive(file.PID) {
			continue
		}
		servers = append(servers, found{file, info.ModTime().UnixNano()})
	}
	if len(servers) == 0 {
		return "", "", errNoToolServer
	}
	newest := slices.MaxFunc(servers, func(a, b found) int { return cmp.Compare(a.mod, b.mod) })
	host := newest.file.Host
	if host == "" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, strconv.Itoa(newest.file.Port)), newest.file.Token, nil
}

// alive reports whether a process with this pid exists. Zero is unknown,
// taken as alive.
func alive(pid int) bool {
	if pid <= 0 {
		return true
	}
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return process.Signal(syscall.Signal(0)) == nil
}
