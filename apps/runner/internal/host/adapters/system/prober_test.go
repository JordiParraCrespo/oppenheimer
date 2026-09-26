package system_test

import (
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

func TestParseOSRelease(t *testing.T) {
	for _, tc := range []struct {
		name     string
		content  string
		platform domain.Platform
	}{
		{"ubuntu", "ID=ubuntu\nVERSION_ID=\"24.04\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n", domain.PlatformUbuntu},
		{"debian", "ID=debian\nVERSION_ID=\"12\"\nPRETTY_NAME=\"Debian GNU/Linux 12 (bookworm)\"\n", domain.PlatformDebian},
		{"mint is ubuntu", "ID=linuxmint\nID_LIKE=ubuntu\nVERSION_ID=\"22\"\n", domain.PlatformUbuntu},
		{"raspbian is debian", "ID=raspbian\nID_LIKE=debian\n", domain.PlatformDebian},
		{"fedora is neither", "ID=fedora\nVERSION_ID=41\n", domain.PlatformLinuxOther},
		{"empty", "", domain.PlatformLinuxOther},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, _ := system.ParseOSRelease(strings.NewReader(tc.content))
			if got != tc.platform {
				t.Fatalf("platform = %q, want %q", got, tc.platform)
			}
		})
	}
}

func TestParseOSReleasePrefersThePrettyName(t *testing.T) {
	_, version := system.ParseOSRelease(strings.NewReader("ID=debian\nVERSION_ID=\"12\"\nPRETTY_NAME=\"Debian GNU/Linux 12 (bookworm)\"\n"))
	if version != "Debian GNU/Linux 12 (bookworm)" {
		t.Fatalf("version = %q", version)
	}
}

func TestSupportedPlatformsAreTheOnesWithAServiceManager(t *testing.T) {
	for _, p := range []domain.Platform{domain.PlatformMacOS, domain.PlatformDebian, domain.PlatformUbuntu} {
		if !p.Supported() || p.ServiceKind() == "" || p.PackageManager() == "" {
			t.Fatalf("%q must be supported with a service manager and a package manager", p)
		}
	}
	if domain.PlatformLinuxOther.Supported() {
		t.Fatal("an unrecognised Linux is not supported in the MVP")
	}
}
