package app

import (
	"context"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// changesReadTime is how long one read of a session's changes may take,
// patches included, inside the control plane's wait for the answer: a store
// fetched without its blobs fetches them as the diff reads them, and a
// patch not read by then is left out with its counts kept.
const changesReadTime = 12 * time.Second

// ReadChanges reads what a session's checkouts changed, the first checkout
// first: since each branch left its base, or with uncommitted only the
// edits not committed yet. A folder session has no checkouts and answers
// none.
//
// The session is held only while its record is read, not for the git that
// follows: a read on a large tree must not keep the session's other
// commands waiting.
//
// Each checkout names at most bounds.Files files and counts the rest. Patches
// are read in order until the read's patch bytes or its time run out; a file
// whose patch is longer than one file's bound, or past either, keeps its
// counts and says its patch was left out.
func (s *Service) ReadChanges(ctx context.Context, id string, uncommitted bool, bounds domain.ChangesBounds) ([]domain.CheckoutChanges, error) {
	session, err := func() (domain.Session, error) {
		defer s.hold(id)()
		return s.recorded(id)
	}()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(domain.WithSession(ctx, id), changesReadTime)
	defer cancel()

	checkouts := session.Checkouts()
	read := make([]domain.CheckoutChanges, 0, len(checkouts))
	budget := bounds.Patches
	for _, checkout := range checkouts {
		changes, err := s.worktrees.Changes(ctx, checkout.Worktree, checkout.BaseBranch, uncommitted)
		if err != nil {
			return nil, err
		}
		changes.Checkout = checkout
		if len(changes.Files) > bounds.Files {
			changes.OmittedFiles = len(changes.Files) - bounds.Files
			changes.Files = changes.Files[:bounds.Files]
		}
		for i := range changes.Files {
			file := &changes.Files[i]
			if file.Binary {
				continue
			}
			limit := min(bounds.FilePatch, budget)
			if limit <= 0 || ctx.Err() != nil {
				file.PatchOmitted = true
				continue
			}
			patch, ok, err := s.worktrees.Patch(ctx, checkout.Worktree, changes.Base, *file, limit)
			if err != nil || !ok {
				// A patch that cannot be read (its blob still on the way when
				// the time ran out) is left out like a long one: the counts
				// stand, and the file is still listed.
				file.PatchOmitted = true
				continue
			}
			file.Patch = patch
			budget -= len(patch)
		}
		read = append(read, changes)
	}
	return read, nil
}
