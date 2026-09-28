package app_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

// offered is a release host that always offers the same version.
type offered struct{ version string }

func (o offered) Fetch(context.Context, string) (domain.Release, error) {
	return domain.Release{Channel: "stable", Version: o.version, Artifact: domain.Artifact{URL: "https://example.test/r.tar.gz"}}, nil
}

// memoryState is a StateStore in memory.
type memoryState struct {
	mu    sync.Mutex
	state domain.State
}

func (m *memoryState) Load() (domain.State, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state, nil
}

func (m *memoryState) Save(s domain.State) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state = s
	return nil
}

// heldStage is a binary directory whose Stage waits to be released and
// counts how many run at once. Every stage fails, so an Apply never gets as
// far as promoting anything.
type heldStage struct {
	entered chan struct{}
	release chan struct{}
	inside  atomic.Int32
	most    atomic.Int32
	stages  atomic.Int32
}

func newHeldStage() *heldStage {
	return &heldStage{entered: make(chan struct{}, 8), release: make(chan struct{})}
}

var errStageFailed = errors.New("the download broke")

func (b *heldStage) Stage(context.Context, domain.Artifact, string) (string, error) {
	now := b.inside.Add(1)
	defer b.inside.Add(-1)
	for {
		most := b.most.Load()
		if now <= most || b.most.CompareAndSwap(most, now) {
			break
		}
	}
	b.stages.Add(1)
	b.entered <- struct{}{}
	<-b.release
	return "", errStageFailed
}

func (*heldStage) SelfCheck(context.Context, string) error { return nil }
func (*heldStage) Promote(string, string) error            { return nil }
func (*heldStage) Activate(string) error                   { return nil }
func (*heldStage) Current() (string, error)                { return "1.0.0", nil }
func (*heldStage) Prune(...string) error                   { return nil }

func newLockedService(b *heldStage) *app.Service {
	return app.New(app.Options{
		Releases: offered{version: "1.1.0"}, Binaries: b, State: &memoryState{},
		Version: "1.0.0", Channel: "stable",
	})
}

// The periodic loop and the console's Update now in one process: they must
// never stage into the same files at once. The second runs after the first,
// and since the first failed, it tries again.
func TestApplyNeverRunsTwiceAtOnce(t *testing.T) {
	stage := newHeldStage()
	svc := newLockedService(stage)

	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() {
			_, err := svc.Apply(context.Background(), app.ApplyOptions{Force: true})
			errs <- err
		}()
	}
	<-stage.entered
	select {
	case <-stage.entered:
		t.Fatal("a second Apply entered Stage while the first was still in it")
	case <-time.After(50 * time.Millisecond):
	}
	stage.release <- struct{}{}
	if err := <-errs; !errors.Is(err, errStageFailed) {
		t.Fatalf("first apply: %v", err)
	}
	// The second goes in only now that the first has returned.
	<-stage.entered
	stage.release <- struct{}{}
	if err := <-errs; !errors.Is(err, errStageFailed) {
		t.Fatalf("second apply: %v", err)
	}
	if most := stage.most.Load(); most != 1 {
		t.Fatalf("%d stages ran at once, want 1", most)
	}
	if n := stage.stages.Load(); n != 2 {
		t.Fatalf("%d stages ran, want the second apply to try again after the first failed", n)
	}
}

func TestApplyWaitingForTheLockHonoursItsContext(t *testing.T) {
	stage := newHeldStage()
	svc := newLockedService(stage)
	first := make(chan error, 1)
	go func() {
		_, err := svc.Apply(context.Background(), app.ApplyOptions{Force: true})
		first <- err
	}()
	<-stage.entered

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := svc.Apply(ctx, app.ApplyOptions{Force: true}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("waiting apply: %v, want its context's error", err)
	}
	if err := svc.Rollback(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("waiting rollback: %v, want its context's error", err)
	}

	stage.release <- struct{}{}
	<-first
	if n := stage.stages.Load(); n != 1 {
		t.Fatalf("%d stages ran; the apply that gave up must not have staged", n)
	}
}
