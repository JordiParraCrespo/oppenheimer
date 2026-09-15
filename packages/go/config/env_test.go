package config

import (
	"strings"
	"testing"
	"time"
)

func lookup(m map[string]string) Lookup {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

func TestEnvCollectsEveryError(t *testing.T) {
	e := NewEnv(lookup(map[string]string{"PORT": "abc", "TTL": "soon", "FLAG": "maybe", "SECRET": "short"}))
	if e.Int("PORT", 1) != 1 || e.Duration("TTL", time.Second) != time.Second || e.Bool("FLAG", false) || e.Secret("SECRET", 32) != "short" {
		t.Fatal("defaults should be returned on failure")
	}
	err := e.Err()
	for _, want := range []string{"PORT", "TTL", "FLAG", "SECRET"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("error should mention %s: %v", want, err)
		}
	}
}

func TestEnvBlankIsAbsent(t *testing.T) {
	e := NewEnv(lookup(map[string]string{"A": "  ", "B": "x"}))
	if e.Optional("A") != "" || e.String("A", "d") != "d" || e.Optional("B") != "x" {
		t.Fatal("blank must read as unset")
	}
	if e.Err() != nil {
		t.Fatal(e.Err())
	}
}

func TestParseValue(t *testing.T) {
	cases := map[string]string{
		`plain`:           "plain",
		`plain # comment`: "plain",
		`"quoted # keep"`: "quoted # keep",
		`'single'`:        "single",
		`"line\nbreak"`:   "line\nbreak",
		`  padded  `:      "padded",
	}
	for in, want := range cases {
		if got := parseValue(in); got != want {
			t.Errorf("parseValue(%q) = %q, want %q", in, got, want)
		}
	}
}
