package cli

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"

	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

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
