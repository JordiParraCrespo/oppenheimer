package argent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// ControlsOptions locate Argent's tool-server: the one the host's agents use.
type ControlsOptions struct {
	// URL is the tool-server's base URL (`argent server start` prints it).
	URL string
	// Token is its bearer token; empty for a server started with --no-auth.
	Token string
	HTTP  *http.Client
}

// Controls applies the reader's input through Argent's tool-server, with the
// session's device filled in here: the console never names a device.
type Controls struct {
	opts ControlsOptions
}

var _ app.Controls = (*Controls)(nil)

// NewControls builds the adapter.
func NewControls(opts ControlsOptions) *Controls {
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	return &Controls{opts: opts}
}

// Apply calls the tool that does what the input asks.
func (c *Controls) Apply(ctx context.Context, device domain.Device, in domain.Input) error {
	tool, args := toolFor(device, in)
	body, err := json.Marshal(args)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(c.opts.URL, "/")+"/tools/"+tool, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.opts.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.opts.Token)
	}
	res, err := c.opts.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("argent %s: %w", tool, err)
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 300))
		return fmt.Errorf("argent %s answered %s: %s", tool, res.Status, strings.TrimSpace(string(detail)))
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<20))
	return nil
}

// toolFor is the Argent tool and its arguments for one input.
func toolFor(device domain.Device, in domain.Input) (string, map[string]any) {
	args := map[string]any{"udid": device.Serial}
	switch in.Kind {
	case "tap":
		args["x"], args["y"] = in.X, in.Y
		return "gesture-tap", args
	case "swipe":
		args["fromX"], args["fromY"], args["toX"], args["toY"] = in.X, in.Y, in.ToX, in.ToY
		args["momentum"] = false
		return "gesture-swipe", args
	case "text":
		args["text"] = in.Text
		return "keyboard", args
	case "key":
		args["key"] = in.Key
		return "keyboard", args
	default:
		args["button"] = in.Button
		return "button", args
	}
}
