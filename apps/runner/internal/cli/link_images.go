package cli

// Images for a window's prompt. `session.image` carries no bytes: control
// frames stay small, and one paste must not queue ahead of every pane on the
// host. The runner pulls the image the control plane parked for the command,
// once, over HTTPS with its own boot assertion — off the goroutine that reads
// the link, so a slow download never stalls a pane — then hands it to the
// session service, which saves it and pastes its path.

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// imagePullTimeout bounds one pull and paste; the control plane keeps a
// parked image for about as long.
const imagePullTimeout = 60 * time.Second

func (h *linkHandler) image(ctx context.Context, m link.SessionImage) {
	if !link.IsCommandID(m.CommandID) {
		h.logger.Warn("session.image with a command id that is not one; dropped")
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(ctx, imagePullTimeout)
		defer cancel()
		data, err := h.pullImage(ctx, m.CommandID)
		if err != nil {
			h.fail(m.CommandID, err)
			return
		}
		if _, err := h.app.Sessions.PasteImage(ctx, m.SessionID, m.Window, m.CommandID, m.MediaType, data); err != nil {
			h.fail(m.CommandID, err)
		}
	}()
}

// pullImage fetches the parked image. The route names no host: the assertion
// is the host, and the control plane hands over an image only to the host of
// the session it was parked for, only once.
func (h *linkHandler) pullImage(ctx context.Context, commandID string) ([]byte, error) {
	token, err := h.bootToken(ctx)
	if err != nil {
		return nil, sessionsdomain.ErrImage.WithDetail("mint the assertion: %v", err).WithCause(err)
	}
	target := h.identity.ControlPlaneURL + "/api/v1/hosts/self/images/" + url.PathEscape(commandID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "oppenheimer-runner/"+h.app.Version)
	resp, err := h.imageHTTP().Do(req)
	if err != nil {
		return nil, sessionsdomain.ErrImage.WithDetail("pull the image: %v", err).WithCause(err)
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	if resp.StatusCode != http.StatusOK {
		return nil, sessionsdomain.ErrImage.WithDetail("the control plane answered %d for the image", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, sessionsdomain.ImageMaxBytes+1))
	if err != nil {
		return nil, sessionsdomain.ErrImage.WithDetail("read the image: %v", err).WithCause(err)
	}
	if len(data) > sessionsdomain.ImageMaxBytes {
		return nil, sessionsdomain.ErrImage.WithDetail("the image is over %d bytes", sessionsdomain.ImageMaxBytes)
	}
	return data, nil
}

func (h *linkHandler) imageHTTP() *http.Client {
	if h.httpClient != nil {
		return h.httpClient
	}
	return &http.Client{Timeout: imagePullTimeout}
}
