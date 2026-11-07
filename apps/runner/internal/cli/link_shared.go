package cli

import (
	"errors"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// laneSharedPreview reads shared files' previews off the read loop, one at a
// time: each is a directory listing and one small file.
const laneSharedPreview = "shared:preview"

var _ sessionsapp.FileSharer = (*linkHandler)(nil)

// FileShared is the session service's file sharer: `file.shared` with what a
// file an agent shared is, never its path nor its bytes, so a bot can name it
// (`product/next-steps/agent-tools.md` §7).
func (h *linkHandler) FileShared(sessionID string, file sessionsdomain.SharedFile) {
	if h.reporter == nil {
		return
	}
	h.reporter.Append(sessionID, sessionsdomain.FileSharedKind, file)
}

// sharedPreview answers `shared.preview.get` with the JPEG preview the runner
// kept when the file was shared, only for a session this host holds and a
// file it shared; anything else is command.failed.
func (h *linkHandler) sharedPreview(m link.SharedPreviewGet) {
	session, err := h.app.Sessions.Get(m.SessionID)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	shared, err := transcript.ReadShared(h.app.Paths.Files(), session.ID, m.FileID)
	if errors.Is(err, transcript.ErrSharedMissing) {
		h.fail(m.CommandID, sessionsdomain.ErrSharedFileNotFound.WithDetail("no shared file %q in session %q", m.FileID, session.ID))
		return
	}
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	if shared.Preview == nil || shared.Preview.MediaType != "image/jpeg" || shared.Preview.Data == "" {
		h.fail(m.CommandID, sessionsdomain.ErrSharedFileNoPreview.WithDetail("%s (%s) has no preview", shared.Name, shared.MediaType))
		return
	}
	_ = h.client.Send(link.SharedPreview{
		Type: link.TypeSharedPreview, CommandID: m.CommandID,
		MediaType: shared.Preview.MediaType, Data: shared.Preview.Data,
	})
}
