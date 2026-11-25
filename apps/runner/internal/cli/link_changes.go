package cli

import (
	"context"
	"encoding/json"

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
	_ = h.client.Send(fitFrame(link.SessionChanges{
		Type: link.TypeSessionChanges, CommandID: m.CommandID, SessionID: m.SessionID,
		Scope: m.Scope, Checkouts: checkouts,
	}, link.MaxFrameBytes-changesFrameHeadroom))
}

// changesFrameHeadroom is what an answer leaves of the link's frame, so a
// count that grows a digit never tips it over.
const changesFrameHeadroom = 1 << 10

// fitFrame holds an answer to limit bytes as the link encodes it. The
// read's bounds count raw bytes, and JSON writes some of them as six (`<`,
// `>` and `&`, a control byte, a byte that is not UTF-8), as long paths
// across many checkouts can also add up: an answer over the frame is not
// sent at all, and the control plane would wait it out. Past limit, patches
// are left out from the last file back, then whole files, counted as
// omitted, until it fits.
func fitFrame(answer link.SessionChanges, limit int) link.SessionChanges {
	size := func(v any) int {
		body, _ := json.Marshal(v)
		return len(body)
	}
	total := size(answer)
	for c := len(answer.Checkouts) - 1; c >= 0 && total > limit; c-- {
		files := answer.Checkouts[c].Files
		for i := len(files) - 1; i >= 0 && total > limit; i-- {
			if files[i].Patch != "" {
				before := size(files[i])
				files[i].Patch, files[i].PatchOmitted = "", true
				total -= before - size(files[i])
			}
		}
		for len(files) > 0 && total > limit {
			// The file and the comma before it.
			total -= size(files[len(files)-1]) + 1
			files = files[:len(files)-1]
			answer.Checkouts[c].OmittedFiles++
		}
		answer.Checkouts[c].Files = files
	}
	return answer
}
