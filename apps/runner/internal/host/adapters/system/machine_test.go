package system_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		name        string
		dmi         system.DMI
		virt, cloud string
	}{
		{"bare metal", system.DMI{SysVendor: "Dell Inc.", ProductName: "PowerEdge R640"}, "none", ""},
		{"ec2", system.DMI{SysVendor: "Amazon EC2", ProductName: "m7i.large"}, "vm", "aws"},
		{"gce", system.DMI{SysVendor: "Google", ProductName: "Google Compute Engine"}, "vm", "gcp"},
		{"azure by asset tag", system.DMI{SysVendor: "Microsoft Corporation", ProductName: "Virtual Machine", ChassisAssetTag: "7783-7084-3265-9085-8269-3286-77"}, "vm", "azure"},
		{"hyper-v desktop is a vm, not azure", system.DMI{SysVendor: "Microsoft Corporation", ProductName: "Virtual Machine"}, "vm", ""},
		{"hetzner", system.DMI{SysVendor: "Hetzner", ProductName: "vServer"}, "vm", "hetzner"},
		{"plain kvm", system.DMI{SysVendor: "QEMU", ProductName: "Standard PC (Q35 + ICH9, 2009)"}, "vm", ""},
		{"hypervisor flag alone", system.DMI{HypervisorFlag: true}, "vm", ""},
		{"container wins over the host's vm", system.DMI{SysVendor: "Amazon EC2", ContainerMarkers: true}, "container", "aws"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			virt, cloud := system.Classify(c.dmi)
			if virt != c.virt || cloud != c.cloud {
				t.Fatalf("Classify = (%q, %q), want (%q, %q)", virt, cloud, c.virt, c.cloud)
			}
		})
	}
}

func TestTimezoneFrom(t *testing.T) {
	cases := []struct{ tz, target, want string }{
		{"Europe/Madrid", "", "Europe/Madrid"},
		{":America/New_York", "", "America/New_York"},
		{"", "/usr/share/zoneinfo/Europe/Madrid", "Europe/Madrid"},
		{"", "/var/db/timezone/zoneinfo/Asia/Tokyo", "Asia/Tokyo"},
		{"/etc/localtime", "/usr/share/zoneinfo/UTC", "UTC"},
		{"", "", ""},
	}
	for _, c := range cases {
		if got := system.TimezoneFrom(c.tz, c.target); got != c.want {
			t.Errorf("TimezoneFrom(%q, %q) = %q, want %q", c.tz, c.target, got, c.want)
		}
	}
}
