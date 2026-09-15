package domain

import (
	"errors"
	"testing"
	"time"
)

func TestLifecycle(t *testing.T) {
	now := time.Now()
	j, err := New("1", "sleep", nil, "k", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := j.Succeed(now); err == nil {
		t.Fatal("queued job cannot succeed")
	}
	if err := j.Start(now); err != nil {
		t.Fatal(err)
	}
	if err := j.Start(now); err == nil {
		t.Fatal("double start")
	}
	if err := j.Fail("boom", now); err != nil {
		t.Fatal(err)
	}
	err = j.Cancel(now)
	var te *TransitionError
	if !errors.As(err, &te) || te.From != StatusFailed {
		t.Fatalf("expected transition error, got %v", err)
	}
	if _, err := New("1", " ", nil, "k", now); !errors.Is(err, ErrKindRequired) {
		t.Fatal(err)
	}
}
