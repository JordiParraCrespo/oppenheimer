package app_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

type fullPolicy struct{}

func (fullPolicy) Load() (domain.ExecPolicy, error) {
	return domain.ExecPolicy{Mode: domain.ExecFull}, nil
}
func (fullPolicy) Save(domain.ExecPolicy) error { return nil }

// heldExecutor runs nothing until released, counting what started.
type heldExecutor struct {
	started chan struct{}
	release chan struct{}
}

func (h heldExecutor) Run(ctx context.Context, _ domain.ExecRequest) (domain.ExecResult, error) {
	h.started <- struct{}{}
	<-h.release
	code := 0
	return domain.ExecResult{ExitCode: &code}, nil
}

// A command past the host's limit is refused at once, never queued: a
// queued one would outlive the control plane's wait and run after the bot
// was told nothing answered.
func TestACommandPastTheLimitIsRefusedNotQueued(t *testing.T) {
	held := heldExecutor{started: make(chan struct{}, domain.MaxConcurrentExecs), release: make(chan struct{})}
	svc := app.New(app.Options{Prober: fake.New(), WorkspaceRoot: t.TempDir(), ExecPolicies: fullPolicy{}, Executor: held})
	req := domain.ExecRequest{Argv: []string{"true"}, Home: "juno"}

	done := make(chan error, domain.MaxConcurrentExecs)
	for range domain.MaxConcurrentExecs {
		go func() {
			_, err := svc.Exec(context.Background(), req)
			done <- err
		}()
		<-held.started
	}
	_, err := svc.Exec(context.Background(), req)
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != domain.ErrExecStart.Code {
		t.Fatalf("err = %v, want %s", err, domain.ErrExecStart.Code)
	}

	close(held.release)
	for range domain.MaxConcurrentExecs {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	if _, err := svc.Exec(context.Background(), req); err != nil {
		t.Fatalf("a slot was not given back: %v", err)
	}
}
