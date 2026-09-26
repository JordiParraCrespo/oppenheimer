package system

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// machineTTL is how long a Machine reading is reused. Facts are collected
// on every heartbeat, and nothing in Machine changes between two of them;
// an hour still catches a timezone change or an upgrade the same day.
const machineTTL = time.Hour

// Machine implements app.Prober. It reads the operating system at most once
// per machineTTL and never fails: a field it cannot read is left empty.
func (p *Prober) Machine(ctx context.Context) domain.Machine {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.machineAt.IsZero() && time.Since(p.machineAt) < machineTTL {
		return p.machine
	}
	p.machine = readMachine(ctx)
	p.machineAt = time.Now()
	return p.machine
}

// DMI is the handful of firmware strings Linux exposes under
// /sys/class/dmi/id, which is where a hypervisor and a cloud name
// themselves without a network call.
type DMI struct {
	SysVendor        string
	ProductName      string
	BIOSVendor       string
	ChassisAssetTag  string
	HypervisorFlag   bool // "hypervisor" among the CPU flags
	ContainerMarkers bool // /.dockerenv, /run/.containerenv, or a container cgroup
}

// azureAssetTag is the chassis asset tag every Azure VM carries; its vendor
// string is the same "Microsoft Corporation" a Hyper-V desktop VM reports.
const azureAssetTag = "7783-7084-3265-9085-8269-3286-77"

// Classify turns DMI strings into the virtualization kind and the cloud
// vendor. It is exported and pure so the table is testable without the
// machines it describes.
func Classify(d DMI) (virtualization, cloud string) {
	joined := strings.ToLower(strings.Join([]string{d.SysVendor, d.ProductName, d.BIOSVendor}, " "))
	switch {
	case strings.Contains(joined, "amazon ec2"):
		cloud = "aws"
	case strings.Contains(joined, "google"):
		cloud = "gcp"
	case d.ChassisAssetTag == azureAssetTag:
		cloud = "azure"
	case strings.Contains(joined, "digitalocean"):
		cloud = "digitalocean"
	case strings.Contains(joined, "hetzner"):
		cloud = "hetzner"
	case strings.Contains(joined, "scaleway"):
		cloud = "scaleway"
	case strings.Contains(joined, "ovh"):
		cloud = "ovh"
	case strings.Contains(joined, "linode"), strings.Contains(joined, "akamai"):
		cloud = "linode"
	case strings.Contains(joined, "vultr"):
		cloud = "vultr"
	case strings.Contains(joined, "oraclecloud"), strings.Contains(joined, "oracle corporation"):
		cloud = "oracle"
	}
	switch {
	case d.ContainerMarkers:
		virtualization = "container"
	case cloud != "", d.HypervisorFlag:
		virtualization = "vm"
	case containsAny(joined, "kvm", "qemu", "vmware", "virtualbox", "xen", "bochs", "parallels", "virtual machine"):
		virtualization = "vm"
	default:
		virtualization = "none"
	}
	return virtualization, cloud
}

func containsAny(s string, words ...string) bool {
	for _, word := range words {
		if strings.Contains(s, word) {
			return true
		}
	}
	return false
}

// TimezoneFrom names the IANA zone from TZ, or from where /etc/localtime
// points. Both Linux and macOS keep the zone name in that link's target.
func TimezoneFrom(tz, localtimeTarget string) string {
	if tz = strings.TrimPrefix(tz, ":"); tz != "" && !strings.HasPrefix(tz, "/") {
		return tz
	}
	if _, zone, found := strings.Cut(localtimeTarget, "zoneinfo/"); found {
		return zone
	}
	return ""
}

func timezone() string {
	target, _ := os.Readlink("/etc/localtime")
	if zone := TimezoneFrom(os.Getenv("TZ"), filepath.ToSlash(target)); zone != "" {
		return zone
	}
	raw, err := os.ReadFile("/etc/timezone")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(raw))
}

func readTrimmed(path string) string {
	raw, err := os.ReadFile(path) //nolint:gosec // fixed system paths
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(raw))
}
