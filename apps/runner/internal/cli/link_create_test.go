package cli

import (
	"reflect"
	"sync"
	"testing"
)

// A create runs beside the read loop, so an attach sent right after it can
// arrive first. It must wait for the session, and the commands that wait
// must run in the order the control plane sent them.
func TestCommandsForASessionInCreationWaitForItInOrder(t *testing.T) {
	h := &linkHandler{creating: map[string][]func(){}}
	var mu sync.Mutex
	var ran []string
	record := func(name string) func() {
		return func() {
			mu.Lock()
			ran = append(ran, name)
			mu.Unlock()
		}
	}

	h.creating["s1"] = nil // s1's create is running
	h.afterCreate("s1", record("attach"))
	h.afterCreate("s1", record("input"))
	h.afterCreate("s2", record("other session"))
	if !reflect.DeepEqual(ran, []string{"other session"}) {
		t.Fatalf("ran %v before the create ended; only another session's command may run", ran)
	}

	h.drainCreate("s1")
	h.afterCreate("s1", record("stop"))

	if want := []string{"other session", "attach", "input", "stop"}; !reflect.DeepEqual(ran, want) {
		t.Fatalf("ran %v, want %v", ran, want)
	}
	if _, running := h.creating["s1"]; running {
		t.Fatal("the create is still recorded as running")
	}
}
