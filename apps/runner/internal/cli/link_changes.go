package cli

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// laneChangesRead reads sessions' changes off the read loop, one at a time:
// each runs git over a checkout and may fetch blobs as it reads.
const laneChangesRead = "changes:read"

// The bounds of one `session.changes`, the protocol's
// SESSION_CHANGES_MAX_FILES, SESSION_CHANGES_FILE_PATCH_MAX_BYTES and
// SESSION_CHANGES_PATCH_MAX_BYTES
// (`packages/shared/src/protocol/session-changes.ts`).
var sessionChangesBounds = domain.ChangesBounds{Files: 500, FilePatch: 64 << 10, Patches: 256 << 10}

// changesRead answers `session.changes.read` with what the session's
// checkouts changed: since each branch left its base, or with `uncommitted`
// the edits not committed yet. A session this host does not hold is
// SESS_001, as command.failed.
func (h *linkHandler) changesRead(ctx context.Context, m link.SessionChangesRead) {
	read, err := h.app.Sessions.ReadChanges(ctx, m.SessionID, m.Scope == "uncommitted", sessionChangesBounds)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	// The control plane refuses `checkouts: null` and `files: null`.
	checkouts := make([]link.CheckoutChanges, 0, len(read))
	for _, c := range read {
		files := make([]link.ChangedFile, 0, len(c.Files))
		for _, f := range c.Files {
			files = append(files, link.ChangedFile{
				Path: f.Path, OldPath: f.OldPath, Status: string(f.Status),
				Additions: f.Additions, Deletions: f.Deletions, Binary: f.Binary,
				Patch: f.Patch, PatchOmitted: f.PatchOmitted,
			})
		}
		checkouts = append(checkouts, link.CheckoutChanges{
			Repo: c.Checkout.Repo, CheckoutID: c.Checkout.CheckoutID, BaseBranch: c.Checkout.BaseBranch,
			Base: c.Base, Approximate: c.Approximate, Files: files, OmittedFiles: c.OmittedFiles,
		})
	}
	_ = h.client.Send(link.SessionChanges{
		Type: link.TypeSessionChanges, CommandID: m.CommandID, SessionID: m.SessionID,
		Scope: m.Scope, Checkouts: checkouts,
	})
}
