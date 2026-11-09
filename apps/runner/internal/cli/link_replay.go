package cli

import "sync"

// replaysRemembered is how many answers a runner gives again by command id.
const replaysRemembered = 256

// replays is the answers to the latest commands that act (a run, a drive),
// by command id. The control plane sends the same id again when it retries
// one approved call (a worker that crashed after the host acted), and that
// id is answered from here instead of acting a second time. A retry that
// arrives while the first is still going waits behind it on the same lane,
// then finds it here. The zero value is ready to use.
type replays[T any] struct {
	mu      sync.Mutex
	answers map[string]T
	order   []string
}

func (r *replays[T]) get(commandID string) (T, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	answer, ok := r.answers[commandID]
	return answer, ok
}

func (r *replays[T]) put(commandID string, answer T) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.answers == nil {
		r.answers = map[string]T{}
	}
	if _, ok := r.answers[commandID]; ok {
		return
	}
	r.answers[commandID] = answer
	r.order = append(r.order, commandID)
	if len(r.order) > replaysRemembered {
		delete(r.answers, r.order[0])
		r.order = r.order[1:]
	}
}
