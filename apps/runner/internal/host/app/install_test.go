package app_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func code(err error) string {
	var prob *problem.Error
	if errors.As(err, &prob) {
		return prob.Code
	}
	return ""
}

// OpenCode installed by its own script joins the hourly round, told the
// method so its updater does not stop to ask.
func TestUpdateAgentsTellsOpenCodeHowItWasInstalled(t *testing.T) {
	p := fake.New()
	p.Tools[domain.ToolOpenCode] = domain.Tool{
		Path: "/home/jordi/.opencode/bin/opencode", Resolved: "/home/jordi/.opencode/bin/opencode", Version: "1.18.33",
	}
	u := &fake.Updater{}
	svc := app.New(app.Options{Prober: p, Updater: u})

	svc.UpdateAgents(context.Background())

	want := []string{"/home/jordi/.opencode/bin/opencode upgrade --method curl"}
	if !slices.Equal(u.Calls, want) {
		t.Fatalf("calls = %v, want %v", u.Calls, want)
	}
}

func TestInstallRunsTheCatalogScriptAndReportsTheProbedTool(t *testing.T) {
	p := fake.New()
	i := &fake.Installer{Run: func(tool, script string) error {
		if !strings.Contains(script, "https://claude.ai/install.sh") {
			t.Errorf("script for %s is not the vendor installer:\n%s", tool, script)
		}
		p.Tools[domain.ToolClaude] = domain.Tool{Path: "/home/jordi/.local/bin/claude", Version: "2.1.284 (Claude Code)"}
		return nil
	}}
	svc := app.New(app.Options{Prober: p, Installer: i})

	result, err := svc.Install(context.Background(), domain.ToolClaude)
	if err != nil {
		t.Fatal(err)
	}
	if result.Outcome != domain.InstallInstalled || result.Kind != domain.InstallAgent || result.Version != "2.1.284 (Claude Code)" {
		t.Errorf("result = %+v", result)
	}
}

func TestInstallLeavesAPresentToolAlone(t *testing.T) {
	p := fake.New()
	p.Tools[domain.ToolGH] = domain.Tool{Path: "/usr/bin/gh", Version: "gh version 2.80.0"}
	i := &fake.Installer{}
	svc := app.New(app.Options{Prober: p, Installer: i})

	result, err := svc.Install(context.Background(), domain.ToolGH)
	if err != nil || result.Outcome != domain.InstallPresent || len(i.Calls) != 0 {
		t.Fatalf("result = %+v, err %v, installs %v", result, err, i.Calls)
	}
}

// git and tmux need root: the runner names the command and runs nothing.
func TestInstallRefusesPackageManagerToolsWithTheCommand(t *testing.T) {
	p := fake.New()
	p.PlatformName = domain.PlatformMacOS
	delete(p.Tools, domain.ToolTmux)
	i := &fake.Installer{}
	svc := app.New(app.Options{Prober: p, Installer: i})

	_, err := svc.Install(context.Background(), domain.ToolTmux)
	if code(err) != "HOST_010" || !strings.Contains(err.Error(), "brew install tmux") {
		t.Fatalf("err = %v, want HOST_010 naming brew install tmux", err)
	}
	if len(i.Calls) != 0 {
		t.Fatalf("installs = %v, want none", i.Calls)
	}
}

func TestInstallFailures(t *testing.T) {
	t.Run("the script fails", func(t *testing.T) {
		i := &fake.Installer{Run: func(string, string) error { return errors.New("npm is not on PATH; install Node.js 22 first") }}
		svc := app.New(app.Options{Prober: fake.New(), Installer: i})
		_, err := svc.Install(context.Background(), domain.ToolCodex)
		if code(err) != "HOST_011" || !strings.Contains(err.Error(), "Node.js 22") {
			t.Fatalf("err = %v, want HOST_011 with the script's reason", err)
		}
	})
	t.Run("the script succeeds and nothing is on PATH", func(t *testing.T) {
		svc := app.New(app.Options{Prober: fake.New(), Installer: &fake.Installer{}})
		_, err := svc.Install(context.Background(), domain.ToolGrok)
		if code(err) != "HOST_011" || !strings.Contains(err.Error(), "still not on PATH") {
			t.Fatalf("err = %v, want HOST_011 not on PATH", err)
		}
	})
}
