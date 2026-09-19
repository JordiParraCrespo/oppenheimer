package app_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func service(p *fake.Prober) *app.Service {
	return app.New(app.Options{Prober: p, WorkspaceRoot: "/home/jordi/oppenheimer-ai/workspaces", Version: "1.2.3"})
}

func TestCollectReportsTheInventory(t *testing.T) {
	facts, err := service(fake.New()).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if facts.Platform != domain.PlatformUbuntu || facts.RunnerVersion != "1.2.3" {
		t.Fatalf("facts = %+v", facts)
	}
	git, ok := facts.Tool(domain.ToolGit)
	if !ok || !git.Found() || !git.Required {
		t.Fatalf("git = %+v", git)
	}
}

func TestCollectReportsAMissingAgentWithoutFailing(t *testing.T) {
	// `claude` is not installed: a fact for the UI, never a refusal.
	facts, err := service(fake.New()).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	claude, ok := facts.Tool(domain.ToolClaude)
	if !ok || claude.Found() || claude.Required {
		t.Fatalf("claude = %+v, want present in the inventory, not found, not required", claude)
	}
	if err := facts.Validate(); err != nil {
		t.Fatalf("a host without the agent is still usable: %v", err)
	}
}

func TestPreflightRefusesRootFirst(t *testing.T) {
	p := fake.New()
	p.Root = true
	p.PlatformName = domain.PlatformLinuxOther // also unsupported; root still wins

	_, err := service(p).Preflight(context.Background())

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "HOST_002" {
		t.Fatalf("err = %v, want HOST_002", err)
	}
}

func TestPreflightRefusesAnUnsupportedPlatformByName(t *testing.T) {
	p := fake.New()
	p.PlatformName = domain.PlatformLinuxOther

	_, err := service(p).Preflight(context.Background())

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "HOST_001" {
		t.Fatalf("err = %v, want HOST_001", err)
	}
	if !strings.Contains(prob.Detail, domain.SupportedPlatforms()) {
		t.Fatalf("detail = %q, want the list of supported platforms", prob.Detail)
	}
}

func TestPreflightNamesTheCommandThatInstallsAMissingTool(t *testing.T) {
	for _, tc := range []struct {
		platform domain.Platform
		want     string
	}{
		{domain.PlatformUbuntu, "sudo apt-get install -y tmux"},
		{domain.PlatformDebian, "sudo apt-get install -y tmux"},
		{domain.PlatformMacOS, "brew install tmux"},
	} {
		t.Run(string(tc.platform), func(t *testing.T) {
			p := fake.New()
			p.PlatformName = tc.platform
			delete(p.Tools, domain.ToolTmux)

			_, err := service(p).Preflight(context.Background())

			var prob *problem.Error
			if !errors.As(err, &prob) || prob.Code != "HOST_003" {
				t.Fatalf("err = %v, want HOST_003", err)
			}
			if !strings.Contains(prob.Detail, tc.want) {
				t.Fatalf("detail = %q, want it to name %q", prob.Detail, tc.want)
			}
		})
	}
}

func TestPreflightReportsDiskPressureBeforeASessionFails(t *testing.T) {
	p := fake.New()
	p.Free = domain.DiskFloor - 1

	_, err := service(p).Preflight(context.Background())

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "HOST_004" {
		t.Fatalf("err = %v, want HOST_004", err)
	}
}

func TestPreflightPassesOnAHealthyHost(t *testing.T) {
	if _, err := service(fake.New()).Preflight(context.Background()); err != nil {
		t.Fatalf("preflight: %v", err)
	}
}
