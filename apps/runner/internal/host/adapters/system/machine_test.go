package system

import (
	"testing"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		name        string
		dmi         dmi
		virt, cloud string
	}{
		{"bare metal", dmi{SysVendor: "Dell Inc.", ProductName: "PowerEdge R640"}, "none", ""},
		{"ec2", dmi{SysVendor: "Amazon EC2", ProductName: "m7i.large"}, "vm", "aws"},
		{"gce", dmi{SysVendor: "Google", ProductName: "Google Compute Engine"}, "vm", "gcp"},
		{"azure by asset tag", dmi{SysVendor: "Microsoft Corporation", ProductName: "Virtual Machine", ChassisAssetTag: "7783-7084-3265-9085-8269-3286-77"}, "vm", "azure"},
		{"hyper-v desktop is a vm, not azure", dmi{SysVendor: "Microsoft Corporation", ProductName: "Virtual Machine"}, "vm", ""},
		{"hetzner", dmi{SysVendor: "Hetzner", ProductName: "vServer"}, "vm", "hetzner"},
		{"plain kvm", dmi{SysVendor: "QEMU", ProductName: "Standard PC (Q35 + ICH9, 2009)"}, "vm", ""},
		{"hypervisor flag alone", dmi{HypervisorFlag: true}, "vm", ""},
		{"container wins over the host's vm", dmi{SysVendor: "Amazon EC2", ContainerMarkers: true}, "container", "aws"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			virt, cloud := classify(c.dmi)
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
		if got := timezoneFrom(c.tz, c.target); got != c.want {
			t.Errorf("TimezoneFrom(%q, %q) = %q, want %q", c.tz, c.target, got, c.want)
		}
	}
}
