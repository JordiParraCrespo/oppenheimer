package domain_test

import (
	"encoding/xml"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
)

func unit() domain.Unit {
	return domain.Unit{
		ExecPath:   "/home/jordi/.oppenheimer/bin/current",
		Args:       []string{"run"},
		WorkingDir: "/home/jordi",
		LogDir:     "/home/jordi/.oppenheimer/log",
		Env:        map[string]string{"RUNNER_HOME": "/home/jordi/.oppenheimer"},
		User:       "jordi",
	}
}

func TestSystemdUnitStopsOnlyTheRunner(t *testing.T) {
	out, err := unit().Render(domain.KindSystemd)
	if err != nil {
		t.Fatal(err)
	}

	// The tmux server the runner starts is in the same cgroup. Anything but
	// KillMode=process would kill every session on a restart or an update.
	if !strings.Contains(out, "KillMode=process") {
		t.Fatalf("unit must not kill the process group:\n%s", out)
	}
	for _, want := range []string{
		"ExecStart=/home/jordi/.oppenheimer/bin/current run",
		"Restart=always",
		"WantedBy=default.target",
		`Environment="RUNNER_HOME=/home/jordi/.oppenheimer"`,
		"StandardOutput=append:/home/jordi/.oppenheimer/log/runner.log",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("unit is missing %q:\n%s", want, out)
		}
	}
}

func TestSystemdUnitExecutesTheCurrentSymlinkNotAVersion(t *testing.T) {
	out, _ := unit().Render(domain.KindSystemd)

	// An update is a symlink swap plus a restart; a versioned path in the
	// unit would make it a unit rewrite plus a daemon-reload as well.
	if strings.Contains(out, "runner-1.") {
		t.Fatalf("the unit must point at `current`:\n%s", out)
	}
}

func TestLaunchdPlistIsValidXMLAndAbandonsTheProcessGroup(t *testing.T) {
	out, err := unit().Render(domain.KindLaunchd)
	if err != nil {
		t.Fatal(err)
	}
	if err := xml.Unmarshal([]byte(out), new(struct {
		XMLName xml.Name `xml:"plist"`
	})); err != nil {
		t.Fatalf("plist is not valid XML: %v\n%s", err, out)
	}
	for _, want := range []string{
		"<key>AbandonProcessGroup</key>\n  <true/>", // sessions survive a restart
		"<key>KeepAlive</key>\n  <true/>",
		"<key>RunAtLoad</key>\n  <true/>",
		"<string>dev.oppenheimer.runner</string>",
		"<string>/home/jordi/.oppenheimer/bin/current</string>",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("plist is missing %q:\n%s", want, out)
		}
	}
}

func TestLaunchdPlistEscapesValues(t *testing.T) {
	u := unit()
	u.WorkingDir = `/home/a & b/<dir>`

	out, err := u.Render(domain.KindLaunchd)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "a & b") || !strings.Contains(out, "a &amp; b") {
		t.Fatalf("plist must escape XML:\n%s", out)
	}
	if err := xml.Unmarshal([]byte(out), new(struct {
		XMLName xml.Name `xml:"plist"`
	})); err != nil {
		t.Fatalf("escaped plist is not valid XML: %v", err)
	}
}

func TestRenderRefusesARelativeExecPath(t *testing.T) {
	u := unit()
	u.ExecPath = "runner"

	if _, err := u.Render(domain.KindSystemd); err == nil {
		t.Fatal("a unit with a relative ExecPath would never start")
	}
}

func TestRenderRefusesAnUnknownInitSystem(t *testing.T) {
	if _, err := unit().Render("openrc"); err == nil {
		t.Fatal("want an error for an init system the MVP does not support")
	}
	if _, err := domain.FileName("openrc"); err == nil {
		t.Fatal("want an error for an unknown kind")
	}
}
