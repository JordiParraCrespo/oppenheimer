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
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Prober = (*Prober)(nil)

// probeTimeout bounds a `--version` call. A tool that cannot say what it is
// within a second is reported as present with an unknown version rather than
// being allowed to hang a preflight.
const probeTimeout = time.Second

// factsTTL bounds how long a probed version is believed. The executable's
// path, mtime and size are checked on every call, so an upgrade shows at
// once; the TTL is the backstop for one that changes none of them.
const factsTTL = 10 * time.Minute

// Prober is the operating system.
//
// Tool versions and the macOS version are cached, like Machine: the heartbeat
// collects the facts every few seconds, and starting a Node CLI to print the
// version it printed last time costs a noticeable slice of CPU on a laptop.
// PATH is still looked up on every call, so an uninstall shows at once, and
// Invalidate drops everything for a preflight.
type Prober struct {
	// version runs a tool to print its version; now stamps the cache. New
	// wires the real ones.
	version func(ctx context.Context, path string) string
	now     func() time.Time

	mu        sync.Mutex
	machine   domain.Machine
	machineAt time.Time
	tools     map[string]toolEntry
	osVersion string
	osAt      time.Time
}

// toolEntry is one cached Tool answer and the file it was read from.
type toolEntry struct {
	tool domain.Tool
	mod  time.Time
	size int64
	at   time.Time
}

// New builds the prober.
func New() *Prober { return &Prober{version: version, now: time.Now, tools: map[string]toolEntry{}} }

// Invalidate implements app.Prober: it forgets every cached fact, so the
// next Collect asks the machine again.
func (p *Prober) Invalidate() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.tools = map[string]toolEntry{}
	p.osVersion, p.osAt = "", time.Time{}
	p.machineAt = time.Time{}
}

// Platform identifies the host family. On Linux the answer comes from
// /etc/os-release, whose ID and ID_LIKE are what tell Ubuntu and Debian apart
// from everything else we do not support yet.
func (p *Prober) Platform(ctx context.Context) (domain.Platform, string, error) {
	switch runtime.GOOS {
	case "darwin":
		return domain.PlatformMacOS, p.cachedMacOSVersion(ctx), nil
	case "linux":
		f, err := os.Open("/etc/os-release")
		if err != nil {
			return domain.PlatformLinuxOther, "", nil //nolint:nilerr // an unreadable os-release is "some other Linux", not a failure
		}
		defer f.Close() //nolint:errcheck // read-only
		platform, version := parseOSRelease(f)
		return platform, version, nil
	default:
		return domain.PlatformUnsupported, runtime.GOOS, nil
	}
}

// parseOSRelease maps an os-release file onto a platform. It takes a reader
// so the mapping is testable without a Debian box.
func parseOSRelease(r interface{ Read([]byte) (int, error) }) (domain.Platform, string) {
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

// Tool locates an executable and asks it for its version, unless it asked
// the same file recently. The file is the resolved path plus the mtime and
// size of what it points at: a `brew upgrade` repoints a symlink and an
// in-place install rewrites the file, and either changes one of them.
func (p *Prober) Tool(ctx context.Context, name string) domain.Tool {
	path, err := exec.LookPath(name)
	if err != nil {
		p.mu.Lock()
		delete(p.tools, name)
		p.mu.Unlock()
		return domain.Tool{Name: name}
	}
	info, statErr := os.Stat(path)
	now := p.now()
	p.mu.Lock()
	cached, ok := p.tools[name]
	p.mu.Unlock()
	if ok && statErr == nil && cached.tool.Path == path && cached.mod.Equal(info.ModTime()) &&
		cached.size == info.Size() && now.Sub(cached.at) < factsTTL {
		return cached.tool
	}

	// Not under the lock: a version call may take up to probeTimeout.
	tool := domain.Tool{Name: name, Path: path, Version: p.version(ctx, path)}
	// An answer cut short by the caller going away is not worth keeping.
	if statErr == nil && ctx.Err() == nil {
		p.mu.Lock()
		p.tools[name] = toolEntry{tool: tool, mod: info.ModTime(), size: info.Size(), at: now}
		p.mu.Unlock()
	}
	return tool
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
		// One budget for both flags, so the timeout is ctx's rather than each
		// call's own. path came from exec.LookPath of a fixed tool name.
		res, err := execx.Run(ctx, execx.Spec{Name: path, Args: []string{flag}, Output: execx.Stdout})
		if err != nil {
			continue
		}
		line, _, _ := strings.Cut(strings.TrimSpace(res.Out), "\n")
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}

// cachedMacOSVersion is macOSVersion, cached like a tool's version: the OS
// changes under a running runner only across a reboot, which restarts it.
func (p *Prober) cachedMacOSVersion(ctx context.Context) string {
	now := p.now()
	p.mu.Lock()
	cached, at := p.osVersion, p.osAt
	p.mu.Unlock()
	if cached != "" && now.Sub(at) < factsTTL {
		return cached
	}
	version := macOSVersion(ctx)
	p.mu.Lock()
	p.osVersion, p.osAt = version, now
	p.mu.Unlock()
	return version
}

func macOSVersion(ctx context.Context) string {
	res, err := execx.Run(ctx, execx.Spec{
		Name: "sw_vers", Args: []string{"-productVersion"}, Timeout: probeTimeout, Output: execx.Stdout,
	})
	if err != nil {
		return ""
	}
	return strings.TrimSpace(res.Out)
}
