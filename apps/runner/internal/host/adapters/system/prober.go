// Package system probes the real machine: PATH lookups, `--version` calls,
// /etc/os-release, and the free space on a filesystem. It is the only place
// in this context that shells out.
package system

import (
	"bufio"
	"context"
	"os"
	"os/exec"
	"os/user"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Prober = (*Prober)(nil)

// probeTimeout bounds a `--version` call. A tool that cannot say what it is
// within a second is reported as present with an unknown version rather than
// being allowed to hang a preflight.
const probeTimeout = time.Second

// Prober is the operating system.
type Prober struct {
	mu        sync.Mutex
	machine   domain.Machine
	machineAt time.Time
}

// New builds the prober.
func New() *Prober { return &Prober{} }

// Platform identifies the host family. On Linux the answer comes from
// /etc/os-release, whose ID and ID_LIKE are what tell Ubuntu and Debian apart
// from everything else we do not support yet.
func (p *Prober) Platform(ctx context.Context) (domain.Platform, string, error) {
	switch runtime.GOOS {
	case "darwin":
		return domain.PlatformMacOS, macOSVersion(ctx), nil
	case "linux":
		f, err := os.Open("/etc/os-release")
		if err != nil {
			return domain.PlatformLinuxOther, "", nil //nolint:nilerr // an unreadable os-release is "some other Linux", not a failure
		}
		defer f.Close() //nolint:errcheck // read-only
		platform, version := ParseOSRelease(f)
		return platform, version, nil
	default:
		return domain.PlatformUnsupported, runtime.GOOS, nil
	}
}

// ParseOSRelease maps an os-release file onto a platform. It is exported and
// takes a reader so the mapping is testable without a Debian box.
func ParseOSRelease(r interface{ Read([]byte) (int, error) }) (domain.Platform, string) {
	fields := map[string]string{}
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		key, value, found := strings.Cut(strings.TrimSpace(scanner.Text()), "=")
		if !found {
			continue
		}
		fields[key] = strings.Trim(value, `"'`)
	}
	version := fields["VERSION_ID"]
	if pretty := fields["PRETTY_NAME"]; pretty != "" {
		version = pretty
	}
	switch id := fields["ID"]; id {
	case "ubuntu":
		return domain.PlatformUbuntu, version
	case "debian":
		return domain.PlatformDebian, version
	default:
		// Derivatives say what they are built on: Linux Mint and Pop!_OS
		// are ubuntu, Raspberry Pi OS is debian. Treating them as their
		// base is right for apt and for systemd alike.
		for _, like := range strings.Fields(fields["ID_LIKE"]) {
			switch like {
			case "ubuntu":
				return domain.PlatformUbuntu, version
			case "debian":
				return domain.PlatformDebian, version
			}
		}
		return domain.PlatformLinuxOther, version
	}
}

// Tool locates an executable and asks it for its version.
func (p *Prober) Tool(ctx context.Context, name string) domain.Tool {
	path, err := exec.LookPath(name)
	if err != nil {
		return domain.Tool{Name: name}
	}
	return domain.Tool{Name: name, Path: path, Version: version(ctx, path)}
}

// Identity reports who the runner runs as.
func (p *Prober) Identity() (userName, home, hostname string, root bool) {
	if u, err := user.Current(); err == nil {
		userName = u.Username
		home = u.HomeDir
	}
	if home == "" {
		home, _ = os.UserHomeDir()
	}
	hostname, _ = os.Hostname()
	return userName, home, hostname, os.Geteuid() == 0
}

// version asks a tool what it is. Most answer `--version`; tmux answers only
// `-V`, so both are tried before giving up. A tool that is installed but will
// not say its version is still installed, which is what the caller needs.
func version(ctx context.Context, path string) string {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	for _, flag := range []string{"--version", "-V"} {
		//nolint:gosec // path came from exec.LookPath of a fixed tool name; the flag is a constant
		out, err := exec.CommandContext(ctx, path, flag).Output()
		if err != nil {
			continue
		}
		line, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}

func macOSVersion(ctx context.Context) string {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "sw_vers", "-productVersion").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
