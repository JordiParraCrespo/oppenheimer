package config

import (
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/config"
)

func lookup(m map[string]string) config.Lookup {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

const key = "0123456789abcdef0123456789abcdef"

func TestParseDefaults(t *testing.T) {
	cfg, err := Parse(lookup(map[string]string{"RUNNER_BOOTSTRAP_API_KEY": key}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 3006 || cfg.Env != config.Development || cfg.LogFormat != "text" || cfg.JWT != nil {
		t.Fatalf("unexpected defaults %+v", cfg)
	}
}

func TestParseRequiresBootstrapKey(t *testing.T) {
	_, err := Parse(lookup(map[string]string{}))
	if err == nil || !strings.Contains(err.Error(), "RUNNER_BOOTSTRAP_API_KEY") {
		t.Fatalf("expected bootstrap key error, got %v", err)
	}
}

func TestParseCollectsEveryError(t *testing.T) {
	_, err := Parse(lookup(map[string]string{
		"RUNNER_BOOTSTRAP_API_KEY": key,
		"RUNNER_PORT":              "abc",
		"RUNNER_JWT_SECRET":        "short",
		"RUNNER_ENV":               "staging",
	}))
	if err == nil {
		t.Fatal("expected errors")
	}
	for _, want := range []string{"RUNNER_PORT", "RUNNER_JWT_SECRET", "RUNNER_ENV"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error should mention %s: %v", want, err)
		}
	}
}

func TestProductionDefaultsToJSONLogs(t *testing.T) {
	cfg, err := Parse(lookup(map[string]string{"RUNNER_BOOTSTRAP_API_KEY": key, "RUNNER_ENV": "production", "RUNNER_JWT_SECRET": key}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.LogFormat != "json" || cfg.JWT == nil || cfg.JWT.Issuer != "oppenheimer-runner" {
		t.Fatalf("unexpected %+v", cfg)
	}
}
