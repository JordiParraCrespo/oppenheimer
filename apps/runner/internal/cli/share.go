package cli

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
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

// notifyRoutes mounts `runner sessions notify`'s route on the local socket.
func (a *App) notifyRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/notify", func(w http.ResponseWriter, r *http.Request) error {
		var in textRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		notice, err := a.Sessions.Notify(r.PathValue("id"), in.Text)
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusCreated, notice)
	})
}

// watchPullRequest is `runner sessions watch-pr`'s body.
type watchPullRequest struct {
	Repo   string `json:"repo,omitempty"`
	Number int    `json:"number"`
	Watch  bool   `json:"watch"`
}

// watchRoutes mounts `runner sessions watch-pr`'s route on the local socket.
func (a *App) watchRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/pulls", func(w http.ResponseWriter, r *http.Request) error {
		var in watchPullRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		watch, err := a.Sessions.WatchPull(r.PathValue("id"), in.Repo, in.Number, in.Watch)
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, watch)
	})
}

// WatchPull asks to be woken by a pull request's events, or to stop.
func (d Delegation) WatchPull(ctx context.Context, repo string, number int, watch bool) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	var out sessionsdomain.PullWatch
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/pulls",
		watchPullRequest{Repo: repo, Number: number, Watch: watch}, &out); err != nil {
		return err
	}
	line := fmt.Sprintf("watching pull request #%d: you will be told when its checks finish, someone reviews or comments, or it merges", number)
	if !watch {
		line = fmt.Sprintf("no longer watching pull request #%d", number)
	}
	_, err = fmt.Fprintln(d.Out, line)
	return err
}

// wakeRequest is `runner sessions wake-in`'s body.
type wakeRequest struct {
	DelaySeconds int64  `json:"delaySeconds"`
	Text         string `json:"text"`
}

// wakeRoutes mounts `runner sessions wake-in`'s route on the local socket.
func (a *App) wakeRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/wakes", func(w http.ResponseWriter, r *http.Request) error {
		var in wakeRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		wake, err := a.Sessions.WakeLater(r.PathValue("id"), time.Duration(in.DelaySeconds)*time.Second, in.Text, time.Now())
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusCreated, wake)
	})
}

// WakeIn asks to be woken in delay with text.
func (d Delegation) WakeIn(ctx context.Context, delay time.Duration, text string) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	var wake sessionsdomain.WakeRequest
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/wakes",
		wakeRequest{DelaySeconds: int64(delay / time.Second), Text: text}, &wake); err != nil {
		return err
	}
	_, err = fmt.Fprintf(d.Out, "you will be woken at %s (once you are at your prompt then); end your turn now\n", wake.At)
	return err
}

// ParseWakeDelay reads a wake's delay: Go's durations (`90s`, `30m`,
// `1h30m`) and whole days (`2d`).
func ParseWakeDelay(value string) (time.Duration, error) {
	if days, ok := strings.CutSuffix(value, "d"); ok {
		n, err := strconv.Atoi(days)
		if err != nil || n < 0 {
			return 0, sessionsdomain.ErrInvalidInput.WithDetail("%q is not a number of days", value)
		}
		return time.Duration(n) * 24 * time.Hour, nil
	}
	delay, err := time.ParseDuration(value)
	if err != nil {
		return 0, sessionsdomain.ErrInvalidInput.WithDetail("%q is not a duration such as 30m, 2h or 1d", value)
	}
	return delay, nil
}

// Notify tells the person a line in the console's Inbox.
func (d Delegation) Notify(ctx context.Context, text string) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	var notice sessionsdomain.Notice
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/notify", textRequest{Text: text}, &notice); err != nil {
		return err
	}
	_, err = fmt.Fprintln(d.Out, "sent to the person's Inbox")
	return err
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
