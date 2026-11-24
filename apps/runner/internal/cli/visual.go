package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// visualRequest is `runner sessions show`'s body: the spec as the agent wrote it.
type visualRequest struct {
	Visual json.RawMessage `json:"visual"`
}

// visualView is what the command prints of a visual it showed.
type visualView struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Blocks int    `json:"blocks"`
}

// visualRoutes mounts `runner sessions show`'s route on the local socket.
// A spec the runner finds wrong is refused with each fault by its path
// (`transcript.CheckVisual`); one it takes goes in the chat beside the
// session's shared files.
func (a *App) visualRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/visuals", func(w http.ResponseWriter, r *http.Request) error {
		var in visualRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		if problems := transcript.CheckVisual(in.Visual); len(problems) > 0 {
			return sessionsdomain.ErrVisual.WithDetail("%s", strings.Join(problems, "\n"))
		}
		session, err := a.Sessions.Get(r.PathValue("id"))
		if err != nil {
			return err
		}
		entry, err := transcript.SaveVisual(a.Paths.Files(), session.ID, in.Visual, time.Now())
		if err != nil {
			return sessionsdomain.ErrVisual.WithDetail("%v", err)
		}
		var spec struct {
			Title  string            `json:"title"`
			Blocks []json.RawMessage `json:"blocks"`
		}
		_ = json.Unmarshal(in.Visual, &spec)
		return httpx.WriteJSON(w, http.StatusCreated, visualView{ID: entry.ID, Title: spec.Title, Blocks: len(spec.Blocks)})
	})
}

// ShowVisual shows the person a visual in this session's chat, from a spec
// in a file, or on standard input when the path is "-".
func (d Delegation) ShowVisual(ctx context.Context, path string) error {
	var spec []byte
	var err error
	if path == "-" {
		spec, err = io.ReadAll(io.LimitReader(os.Stdin, transcript.VisualSpecMax+1))
	} else {
		spec, err = os.ReadFile(path) //nolint:gosec // a file the agent named, read as the user it runs as
	}
	if err != nil {
		return sessionsdomain.ErrVisual.WithDetail("%s: %v", path, err)
	}
	return d.showVisual(ctx, spec)
}

func (d Delegation) showVisual(ctx context.Context, spec []byte) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	if !json.Valid(spec) {
		return sessionsdomain.ErrVisual.WithDetail("the spec is not JSON")
	}
	var shown visualView
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/visuals",
		visualRequest{Visual: spec}, &shown); err != nil {
		return err
	}
	_, err = fmt.Fprintf(d.Out, "shown in the chat: %q, %d blocks; do not repeat its numbers, say what they mean\n",
		shown.Title, shown.Blocks)
	return err
}
