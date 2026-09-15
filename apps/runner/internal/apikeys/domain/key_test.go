package domain

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
)

func TestGenerateAndMatch(t *testing.T) {
	now := time.Now()
	key, token, err := Generate("ci", []scope.Scope{scopes.KeysWrite}, "bootstrap", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	if !IsToken(token) || !strings.HasPrefix(token, key.Prefix) {
		t.Fatalf("token %q prefix %q", token, key.Prefix)
	}
	id, ok := ParseToken(token)
	if !ok || id != key.ID {
		t.Fatalf("parse: %q %v", id, ok)
	}
	if !key.Matches(token) || key.Matches(token+"x") {
		t.Fatal("match")
	}
	if strings.Contains(key.Hash, token) {
		t.Fatal("secret stored")
	}
	if !key.Active(now) {
		t.Fatal("fresh key inactive")
	}
	if err := key.Revoke(now); err != nil {
		t.Fatal(err)
	}
	if key.Active(now) || !errors.Is(key.Revoke(now), ErrAlreadyRevoked) {
		t.Fatal("revoke")
	}
}

func TestGenerateValidation(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Hour)
	if _, _, err := Generate(" ", []scope.Scope{scopes.EventsRead}, "x", nil, now); !errors.Is(err, ErrNameRequired) {
		t.Fatal(err)
	}
	if _, _, err := Generate("n", nil, "x", nil, now); !errors.Is(err, ErrScopesRequired) {
		t.Fatal(err)
	}
	if _, _, err := Generate("n", []scope.Scope{scopes.EventsRead}, "x", &past, now); !errors.Is(err, ErrExpiryInPast) {
		t.Fatal(err)
	}
	future := now.Add(time.Hour)
	key, _, _ := Generate("n", []scope.Scope{scopes.EventsRead}, "x", &future, now)
	if key.Active(future) {
		t.Fatal("expired key active")
	}
}
