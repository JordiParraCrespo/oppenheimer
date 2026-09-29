package app_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

func TestUpdateAgentsRunsEachInstalledAgentsOwnUpdater(t *testing.T) {
	p := fake.New()
	p.Tools[domain.ToolClaude] = domain.Tool{Path: "/home/jordi/.local/bin/claude", Version: "2.1.274 (Claude Code)"}
	p.Tools[domain.ToolOpenCode] = domain.Tool{Path: "/usr/local/bin/opencode", Version: "1.18.33"}
	p.Tools[domain.ToolCodex] = domain.Tool{Path: "/usr/local/bin/codex", Version: "codex-cli 0.155.1"}
	u := &fake.Updater{Run: func(path string, _ []string) (string, error) {
		switch path {
		case "/home/jordi/.local/bin/claude":
			// The screenshot's case: a model that needs a newer CLI.
			p.Tools[domain.ToolClaude] = domain.Tool{Path: path, Version: "2.1.284 (Claude Code)"}
			return "Successfully updated from 2.1.274 to 2.1.284", nil
		case "/usr/local/bin/codex":
			return "npm error code EACCES\nnpm error EACCES: permission denied", errors.New("exit status 243")
		}
		return "opencode is up to date", nil
	}}
	svc := app.New(app.Options{Prober: p, Updater: u, Version: "1.2.3"})

	results := svc.UpdateAgents(context.Background())

	want := []string{
		"/home/jordi/.local/bin/claude update",
		"/usr/local/bin/codex update",
		"/usr/local/bin/opencode upgrade",
	}
	if !slices.Equal(u.Calls, want) {
		t.Fatalf("calls = %v, want %v (git and tmux, and agents not installed, are left alone)", u.Calls, want)
	}
	byTool := map[string]domain.AgentUpdate{}
	for _, r := range results {
		byTool[r.Tool] = r
	}
	if r := byTool[domain.ToolClaude]; r.Outcome != domain.AgentUpdated || r.From != "2.1.274 (Claude Code)" || r.To != "2.1.284 (Claude Code)" {
		t.Errorf("claude = %+v", r)
	}
	if r := byTool[domain.ToolCodex]; r.Outcome != domain.AgentUpdateFailed || r.Detail != "npm error EACCES: permission denied" {
		t.Errorf("codex = %+v, want failed with the updater's last line", r)
	}
	if r := byTool[domain.ToolOpenCode]; r.Outcome != domain.AgentCurrent {
		t.Errorf("opencode = %+v", r)
	}
	if !slices.Contains(p.Calls, "invalidate") {
		t.Error("the versions were not read afresh after updating")
	}
}

func TestUpdateAgentsWithoutAnUpdaterDoesNothing(t *testing.T) {
	p := fake.New()
	p.Tools[domain.ToolClaude] = domain.Tool{Path: "/usr/bin/claude", Version: "2.1.274"}
	if results := app.New(app.Options{Prober: p}).UpdateAgents(context.Background()); results != nil {
		t.Fatalf("results = %v", results)
	}
}

func TestUpdateAgentsStopsQuietlyOnShutdown(t *testing.T) {
	p := fake.New()
	p.Tools[domain.ToolClaude] = domain.Tool{Path: "/usr/bin/claude", Version: "2.1.274"}
	p.Tools[domain.ToolCodex] = domain.Tool{Path: "/usr/bin/codex", Version: "0.155.1"}
	ctx, cancel := context.WithCancel(context.Background())
	u := &fake.Updater{Run: func(string, []string) (string, error) {
		cancel()
		return "", context.Canceled
	}}

	results := app.New(app.Options{Prober: p, Updater: u}).UpdateAgents(ctx)

	if len(results) != 0 || len(u.Calls) != 1 {
		t.Fatalf("results = %v, calls = %v; want nothing reported and nothing more run", results, u.Calls)
	}
}
