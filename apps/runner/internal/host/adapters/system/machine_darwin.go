package system

import (
	"context"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// readMachine asks sysctl and sw_vers. It runs once per machineTTL, so the
// handful of short commands is paid hourly, not per heartbeat.
func readMachine(ctx context.Context) domain.Machine {
	m := domain.Machine{
		KernelVersion: sysctl(ctx, "kern.osrelease"),
		CPUModel:      sysctl(ctx, "machdep.cpu.brand_string"),
		Timezone:      timezone(),
		// macOS on a hypervisor says so; Apple hardware has no cloud to name.
		Virtualization: "none",
	}
	if name, version := swVers(ctx, "-productName"), swVers(ctx, "-productVersion"); name != "" {
		m.OSName = strings.TrimSpace(name + " " + version)
	}
	if bytes, err := strconv.ParseUint(sysctl(ctx, "hw.memsize"), 10, 64); err == nil {
		m.MemoryTotalBytes = bytes
	}
	if booted, ok := DarwinBootTime(sysctl(ctx, "kern.boottime")); ok {
		m.BootedAt = &booted
	}
	if sysctl(ctx, "kern.hv_vmm_present") == "1" {
		m.Virtualization = "vm"
	}
	return m
}

var bootSeconds = regexp.MustCompile(`sec = (\d+)`)

// DarwinBootTime parses `{ sec = 1727000000, usec = 0 } …`.
func DarwinBootTime(raw string) (time.Time, bool) {
	match := bootSeconds.FindStringSubmatch(raw)
	if match == nil {
		return time.Time{}, false
	}
	seconds, err := strconv.ParseInt(match[1], 10, 64)
	if err != nil || seconds <= 0 {
		return time.Time{}, false
	}
	return time.Unix(seconds, 0).UTC(), true
}

func sysctl(ctx context.Context, name string) string {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "sysctl", "-n", name).Output() //nolint:gosec // fixed names
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func swVers(ctx context.Context, flag string) string {
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "sw_vers", flag).Output() //nolint:gosec // fixed flags
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// AvailableMemory is not read on macOS: vm_stat's page counts do not add up
// to a number that means what MemAvailable means on Linux, and a wrong
// "memory is full" is worse than none.
func AvailableMemory() uint64 { return 0 }
