package system

import (
	"bufio"
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// readMachine reads /proc, /sys and /etc: files, never commands.
func readMachine(context.Context) domain.Machine {
	m := domain.Machine{
		OSName:        osReleaseField("PRETTY_NAME"),
		KernelVersion: readTrimmed("/proc/sys/kernel/osrelease"),
		Timezone:      timezone(),
	}
	cpuModel, hypervisor := cpuInfo()
	m.CPUModel = cpuModel
	m.MemoryTotalBytes = meminfoBytes(readTrimmed("/proc/meminfo"), "MemTotal")
	if booted, ok := bootTime(readTrimmed("/proc/stat")); ok {
		m.BootedAt = &booted
	}
	m.Virtualization, m.CloudProvider = classify(dmi{
		SysVendor:        readTrimmed("/sys/class/dmi/id/sys_vendor"),
		ProductName:      readTrimmed("/sys/class/dmi/id/product_name"),
		BIOSVendor:       readTrimmed("/sys/class/dmi/id/bios_vendor"),
		ChassisAssetTag:  readTrimmed("/sys/class/dmi/id/chassis_asset_tag"),
		HypervisorFlag:   hypervisor,
		ContainerMarkers: inContainer(),
	})
	return m
}

func osReleaseField(key string) string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return ""
	}
	defer f.Close() //nolint:errcheck // read-only
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		k, v, found := strings.Cut(strings.TrimSpace(scanner.Text()), "=")
		if found && k == key {
			return strings.Trim(v, `"'`)
		}
	}
	return ""
}

// cpuInfo returns the first model name /proc/cpuinfo gives, and whether the
// CPU flags say it runs under a hypervisor.
func cpuInfo() (model string, hypervisor bool) {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return "", false
	}
	defer f.Close() //nolint:errcheck // read-only
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		key, value, found := strings.Cut(scanner.Text(), ":")
		if !found {
			continue
		}
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		switch key {
		case "model name", "Model", "Hardware":
			if model == "" {
				model = value
			}
		case "flags":
			if strings.Contains(" "+value+" ", " hypervisor ") {
				hypervisor = true
			}
		}
	}
	return model, hypervisor
}

// meminfoBytes reads one kB field of /proc/meminfo as bytes.
func meminfoBytes(meminfo, field string) uint64 {
	for _, line := range strings.Split(meminfo, "\n") {
		key, value, found := strings.Cut(line, ":")
		if !found || strings.TrimSpace(key) != field {
			continue
		}
		parts := strings.Fields(value)
		if len(parts) == 0 {
			return 0
		}
		kb, err := strconv.ParseUint(parts[0], 10, 64)
		if err != nil {
			return 0
		}
		return kb * 1024
	}
	return 0
}

// bootTime reads the btime line of /proc/stat.
func bootTime(stat string) (time.Time, bool) {
	for _, line := range strings.Split(stat, "\n") {
		if rest, found := strings.CutPrefix(line, "btime "); found {
			seconds, err := strconv.ParseInt(strings.TrimSpace(rest), 10, 64)
			if err != nil || seconds <= 0 {
				return time.Time{}, false
			}
			return time.Unix(seconds, 0).UTC(), true
		}
	}
	return time.Time{}, false
}

func inContainer() bool {
	for _, marker := range []string{"/.dockerenv", "/run/.containerenv"} {
		if _, err := os.Stat(marker); err == nil {
			return true
		}
	}
	cgroup := readTrimmed("/proc/1/cgroup")
	return containsAny(cgroup, "docker", "kubepods", "containerd", "lxc", "libpod")
}

// AvailableMemory is MemAvailable: what a new process could have without
// swapping, which is the number "is this host full" means.
func AvailableMemory() uint64 {
	return meminfoBytes(readTrimmed("/proc/meminfo"), "MemAvailable")
}

// readTrimmed reads one /proc, /sys or /etc file; only Linux reads the
// machine from files, so it lives in this file.
func readTrimmed(path string) string {
	raw, err := os.ReadFile(path) //nolint:gosec // fixed system paths
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(raw))
}
