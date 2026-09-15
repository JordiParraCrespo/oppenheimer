package memory

import (
	"context"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
)

// A verification that loaded the key before a revocation must not be able
// to write the revocation away when it records the use.
func TestTouchDoesNotReviveRevokedKey(t *testing.T) {
	ctx := context.Background()
	repo := New()
	now := time.Now()
	key, _, err := domain.Generate("k", []scope.Scope{scopes.JobsRead}, "b", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Save(ctx, key); err != nil {
		t.Fatal(err)
	}

	revoked := key
	if err := revoked.Revoke(now); err != nil {
		t.Fatal(err)
	}
	if err := repo.Save(ctx, revoked); err != nil {
		t.Fatal(err)
	}
	if err := repo.Touch(ctx, key.ID, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}

	stored, err := repo.FindByID(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.RevokedAt == nil || stored.LastUsedAt == nil {
		t.Fatalf("touch must keep the revocation and record the use: %+v", stored)
	}
	if err := repo.Touch(ctx, "missing", now); err != nil {
		t.Fatalf("touching an unknown id is not an error: %v", err)
	}
}
