package cli

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// shareRequest is `runner sessions send-file`'s body: an absolute path, as
// the agent's own folder resolved it, and the agent's line about it.
type shareRequest struct {
	Path    string `json:"path"`
	Caption string `json:"caption,omitempty"`
}

// sharedView is what the command prints of a shared file.
type sharedView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	MediaType string `json:"mediaType"`
	Size      int64  `json:"size"`
	Preview   bool   `json:"preview"`
}

// shareRoutes mounts `runner sessions send-file`'s route on the local socket.
// The file is any regular file the runner's user can read: the agent runs as
// that user and could copy any of them into its checkout, so a narrower rule
// would not keep anything from the person, who is the one it is shown to.
func (a *App) shareRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/files", func(w http.ResponseWriter, r *http.Request) error {
		var in shareRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		if !filepath.IsAbs(in.Path) {
			return sessionsdomain.ErrShare.WithDetail("the path %q is not absolute", in.Path)
		}
		session, err := a.Sessions.Get(r.PathValue("id"))
		if err != nil {
			return err
		}
		shared, err := transcript.SaveShared(a.Paths.Files(), session.ID, filepath.Clean(in.Path), in.Caption, time.Now())
		if errors.Is(err, transcript.ErrSharedNotFile) || errors.Is(err, transcript.ErrSharedRead) {
			return sessionsdomain.ErrShare.WithDetail("%s: %v", in.Path, err)
		}
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusCreated, sharedView{
			ID: shared.ID, Name: shared.Name, MediaType: shared.MediaType, Size: shared.Size,
			Preview: shared.Preview != nil || shared.Text != nil,
		})
	})
}

// SendFile shows the person a file in this session's chat.
func (d Delegation) SendFile(ctx context.Context, path, caption string) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return sessionsdomain.ErrShare.WithDetail("%s: %v", path, err)
	}
	var shared sharedView
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/files",
		shareRequest{Path: absolute, Caption: caption}, &shared); err != nil {
		return err
	}
	shown := "in the chat"
	if !shared.Preview {
		shown = "in the chat, by name (too large or not an image or text to show)"
	}
	_, err = fmt.Fprintf(d.Out, "shared %s (%s, %d bytes) %s\n", shared.Name, shared.MediaType, shared.Size, shown)
	return err
}
