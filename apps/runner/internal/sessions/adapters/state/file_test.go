package state_test

import (
	"fmt"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func byID(t *testing.T, s *state.Store) map[string]domain.Session {
	t.Helper()
	sessions, err := s.Load()
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]domain.Session{}
	for _, session := range sessions {
		out[session.ID] = session
	}
	return out
}

// Two runner processes over one state directory (`runner sessions create`
// run twice at once, with no daemon to go through) each write the sessions
// they made, and neither loses the other's. Regresses if a save writes the
// process's whole map over the file: the last one to save wins and the
// other's session is no longer on this host.
func TestTwoProcessesEachKeepTheSessionsTheyMade(t *testing.T) {
	dir := t.TempDir()
	first, second := state.New(dir), state.New(dir)
	_, _ = first.Load()
	_, _ = second.Load()

	if err := first.Save([]domain.Session{{ID: "a", State: domain.StateWorking}}); err != nil {
		t.Fatal(err)
	}
	if err := second.Save([]domain.Session{{ID: "b", State: domain.StateWorking}}); err != nil {
		t.Fatal(err)
	}

	if got := byID(t, state.New(dir)); len(got) != 2 {
		t.Fatalf("sessions on disk = %v, want a and b", got)
	}
}

// A session one process closed stays closed when another process, which
// still holds the copy it loaded before, saves its own change. Regresses if
// that stale copy is written back and the closed session reappears.
func TestASessionClosedByOneProcessIsNotReopenedByAnother(t *testing.T) {
	dir := t.TempDir()
	seed := state.New(dir)
	if err := seed.Save([]domain.Session{{ID: "a", State: domain.StateWorking}, {ID: "b", State: domain.StateWorking}}); err != nil {
		t.Fatal(err)
	}
	first, second := state.New(dir), state.New(dir)
	loaded, _ := first.Load()
	stale, _ := second.Load()

	for i := range loaded {
		if loaded[i].ID == "a" {
			loaded[i].State = domain.StateClosed
		}
	}
	if err := first.Save(loaded); err != nil {
		t.Fatal(err)
	}
	for i := range stale {
		if stale[i].ID == "b" {
			stale[i].State = domain.StateClosed
		}
	}
	if err := second.Save(stale); err != nil {
		t.Fatal(err)
	}

	got := byID(t, state.New(dir))
	if got["a"].State != domain.StateClosed || got["b"].State != domain.StateClosed {
		t.Fatalf("a = %s, b = %s; want both closed", got["a"].State, got["b"].State)
	}
}

// Many processes saving at once, each its own session, leave every one on
// disk. Regresses without a lock across the read and the write.
func TestConcurrentSavesFromManyProcessesLoseNothing(t *testing.T) {
	dir := t.TempDir()
	const n = 20
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			s := state.New(dir)
			_, _ = s.Load()
			if err := s.Save([]domain.Session{{ID: fmt.Sprintf("s-%d", i), State: domain.StateWorking}}); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()

	if got := byID(t, state.New(dir)); len(got) != n {
		t.Fatalf("%d of %d sessions on disk", len(got), n)
	}
}

// One process's own sessions are written as it holds them, its later
// changes included, and the file it reads back is what it wrote.
func TestAProcessSeesItsOwnChanges(t *testing.T) {
	dir := t.TempDir()
	s := state.New(dir)
	if err := s.Save([]domain.Session{{ID: "a", State: domain.StateCreating}}); err != nil {
		t.Fatal(err)
	}
	if err := s.Save([]domain.Session{{ID: "a", State: domain.StateWorking}}); err != nil {
		t.Fatal(err)
	}
	if got := byID(t, s); got["a"].State != domain.StateWorking {
		t.Fatalf("a = %s, want working", got["a"].State)
	}
}
