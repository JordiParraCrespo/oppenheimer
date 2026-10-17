package git

// Spare worktrees: each store keeps one worktree checked out ahead of the
// next create, so a create moves it into the session's folder and checks out
// only what changed since, instead of writing the whole tree while a person
// waits (02-runner §5).
//
//	<workspace>/repos/.spares/<owner>--<repo>   detached at the base it was made from
//
// A spare is made after a create lands, outside that create's time, and is
// replaced after every create that takes it. It lives beside the stores, not
// among the sessions, so it is never a session's folder.

import (
	"context"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

type spare struct {
	path string
	// ready is set once the checkout has finished; a spare still being
	// made is waited for (awaitSpare), not added beside.
	ready bool
	// done closes when the making ends, ready or not. A spare found on disk
	// rather than made here has none.
	done chan struct{}
}

// awaitSpare waits, before a create takes the store's lock, for a spare that
// is being made: it is already writing the files a plain add would write
// again beside it, and making it takes that lock for a moment. A context that
// ends first leaves the create to what is there.
func (c *Client) awaitSpare(ctx context.Context, store string) {
	c.mu.Lock()
	s := c.spares[store]
	c.mu.Unlock()
	if s == nil || s.done == nil {
		return
	}
	select {
	case <-s.done:
	case <-ctx.Done():
	}
}

func (c *Client) sparePath(store string) string {
	return c.layout.Spare(store)
}

// claim moves store's spare to path and checks out branch there, cut from
// base. It reports false, having left nothing at path, when there is no
// spare ready or taking it failed: the caller then adds a worktree the
// ordinary way. The store's lock is held.
func (c *Client) claim(ctx context.Context, store, path, branch, base string) bool {
	c.mu.Lock()
	s := c.spares[store]
	switch {
	case s == nil:
		// None made by this process; one an earlier runner finished is on
		// disk, and as good.
		s = &spare{path: c.sparePath(store)}
		if !c.finished(ctx, store, s.path) {
			c.mu.Unlock()
			return false
		}
	case !s.ready:
		c.mu.Unlock()
		return false
	default:
		delete(c.spares, store)
	}
	c.mu.Unlock()

	quick := command{timeout: quickTimeout, dir: store}
	if _, err := c.run(ctx, quick, "worktree", "move", s.path, path); err != nil {
		c.discard(ctx, store, s.path)
		return false
	}
	if err := c.checkoutSession(ctx, store, path, branch, base); err != nil {
		c.discard(ctx, store, path)
		return false
	}
	return true
}

// checkoutSession puts a worktree that is detached somewhere — a spare just
// moved into place, or one a claim cut short left there — on the session's
// new branch, cut from base. Only the files that differ are written.
func (c *Client) checkoutSession(ctx context.Context, store, path, branch, base string) error {
	flag := "-b"
	if c.leftoverBranch(ctx, store, branch, startPoint(base)) {
		flag = "-B"
	}
	// --no-track for the reason Add gives.
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: path}, "checkout", "--quiet", "--no-track", flag, branch, startPoint(base))
	return err
}

// discard removes a worktree the runner made and no session holds.
func (c *Client) discard(ctx context.Context, store, path string) {
	_, _ = c.run(ctx, command{timeout: quickTimeout, dir: store}, "worktree", "remove", "--force", "--force", path)
}

// warm makes store a new spare at base, in the background, unless it has one
// or spares are off, and returns the spare being made or already held (nil
// when spares are off). ctx's values ride along (the session a lazy blob
// fetch asks a token for); its end does not, since the create is already over.
func (c *Client) warm(ctx context.Context, store, base string) *spare {
	if !c.prewarm {
		return nil
	}
	c.mu.Lock()
	if s, ok := c.spares[store]; ok {
		c.mu.Unlock()
		return s
	}
	s := &spare{path: c.sparePath(store), done: make(chan struct{})}
	c.spares[store] = s
	c.mu.Unlock()

	c.warming.Add(1)
	go func() {
		defer c.warming.Done()
		defer close(s.done)
		err := c.prepare(context.WithoutCancel(ctx), store, base, s.path)
		c.mu.Lock()
		defer c.mu.Unlock()
		if err != nil {
			if c.spares[store] == s {
				delete(c.spares, store)
			}
			return
		}
		s.ready = true
	}()
	return s
}

// prepare leaves a clean worktree at path, detached at base. A clean one an
// earlier runner left there is kept as it is; anything else the store has
// registered there is removed first; something the store does not know is
// left alone, and no spare is made.
func (c *Client) prepare(ctx context.Context, store, base, path string) error {
	release := c.lock(store)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		release()
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(path), err).WithCause(err)
	}
	if _, err := os.Stat(path); err == nil {
		if c.finished(ctx, store, path) {
			release()
			return nil
		}
		// Only what the store has registered there is the runner's.
		if record, err := c.recordAt(ctx, store, path); err != nil || record == nil {
			release()
			return domain.ErrWorktree.WithDetail("%s is in the way of the spare worktree", path)
		}
		c.discard(ctx, store, path)
	}
	_, err := c.run(ctx, command{timeout: quickTimeout, dir: store},
		"worktree", "add", "--detach", "--no-checkout", path, startPoint(base))
	release()
	if err != nil {
		return err
	}
	// The checkout runs without the store's lock: it writes only the
	// spare's own index and files, and a create for another session must not
	// wait behind it.
	if _, err := c.run(ctx, command{timeout: fetchTimeout, dir: path}, "reset", "--hard", "--quiet"); err != nil {
		c.discard(ctx, store, path)
		return err
	}
	return nil
}

// finished reports a spare at path whose making completed: registered with
// the store, detached, and clean. One whose checkout was cut short is not.
func (c *Client) finished(ctx context.Context, store, path string) bool {
	if _, err := os.Stat(path); err != nil {
		return false
	}
	record, err := c.recordAt(ctx, store, path)
	if err != nil || record == nil || record.branch != "" {
		return false
	}
	// A checkout cut short shows as tracked files missing; what else was
	// written there is carried along, as it would be by any checkout.
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: path}, "status", "--porcelain", "--untracked-files=no")
	return err == nil && out == ""
}

// Wait returns once no spare is being made and no shallow store is being
// deepened, for a process about to exit (a one-shot `runner sessions create`)
// or a test about to remove the directories they write into.
func (c *Client) Wait() { c.warming.Wait() }
