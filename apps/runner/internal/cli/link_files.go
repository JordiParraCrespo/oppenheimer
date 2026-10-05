package cli

// Files for a window's prompt. `session.image` carries no bytes (why:
// `sessionImageSchema` in packages/shared/src/protocol/messages.ts). The runner
// pulls the parked file off the goroutine that reads the link, so a slow
// download never stalls a pane, then hands it to the session service, which
// saves it and pastes its path.

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// filePullTimeout bounds one pull and paste, and all of a create's pulls
// together; it is shorter than the two minutes the control plane keeps a
// parked paste (PARKED_IMAGE_TTL_SECONDS).
const filePullTimeout = 60 * time.Second

func (h *linkHandler) file(ctx context.Context, m link.SessionImage) {
	if !link.IsCommandID(m.CommandID) {
		h.logger.Warn("session.image with a command id that is not one; dropped")
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(ctx, filePullTimeout)
		defer cancel()
		data, err := h.pullFile(ctx, m.CommandID)
		if err != nil {
			h.fail(m.CommandID, err)
			return
		}
		if _, err := h.app.Sessions.PasteFile(ctx, m.SessionID, m.Window, m.CommandID, m.MediaType, data); err != nil {
			h.fail(m.CommandID, err)
		}
	}()
}

// pullCreateFiles fetches the files a `session.create` attached to its
// first task, before anything is made, all at once under one budget: the
// create waits for the slowest pull, not the sum of them. The task that names
// them must not start without them, so one that cannot be pulled fails the
// create, with the reason.
func (h *linkHandler) pullCreateFiles(ctx context.Context, attached []link.SessionCreateImages) ([]sessionsapp.CreateFile, error) {
	if len(attached) == 0 {
		return nil, nil
	}
	if len(attached) > sessionsdomain.CreateMaxFiles {
		return nil, sessionsdomain.ErrInvalidInput.WithDetail(
			"a first task carries at most %d files; this one carried %d", sessionsdomain.CreateMaxFiles, len(attached))
	}
	for _, file := range attached {
		// The id names the file on disk and the pull's path.
		if !link.IsCommandID(file.ImageID) {
			return nil, sessionsdomain.ErrFile.WithDetail("an attached file id is not one")
		}
	}
	ctx, cancel := context.WithTimeout(ctx, filePullTimeout)
	defer cancel()
	files := make([]sessionsapp.CreateFile, len(attached))
	errs := make([]error, len(attached))
	var wg sync.WaitGroup
	for i, file := range attached {
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, err := h.pullFile(ctx, file.ImageID)
			if err != nil {
				errs[i] = err
				// The others are for a create that will fail anyway.
				cancel()
				return
			}
			files[i] = sessionsapp.CreateFile{ID: file.ImageID, MediaType: file.MediaType, Data: data}
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return nil, err
		}
	}
	return files, nil
}

// pullFile fetches the parked file. The route names no host: the assertion
// is the host, and the control plane hands over a file only to the host of
// the session it was parked for, only once.
func (h *linkHandler) pullFile(ctx context.Context, commandID string) ([]byte, error) {
	token, err := h.bootToken(ctx)
	if err != nil {
		return nil, sessionsdomain.ErrFile.WithDetail("mint the assertion: %v", err).WithCause(err)
	}
	target := h.identity.ControlPlaneURL + "/api/v1/hosts/self/images/" + url.PathEscape(commandID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "oppenheimer-runner/"+h.app.Version)
	resp, err := h.fileHTTP().Do(req)
	if err != nil {
		return nil, sessionsdomain.ErrFile.WithDetail("pull the file: %v", err).WithCause(err)
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	if resp.StatusCode != http.StatusOK {
		return nil, sessionsdomain.ErrFile.WithDetail("the control plane answered %d for the file", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, sessionsdomain.FileMaxBytes+1))
	if err != nil {
		return nil, sessionsdomain.ErrFile.WithDetail("read the file: %v", err).WithCause(err)
	}
	if len(data) > sessionsdomain.FileMaxBytes {
		return nil, sessionsdomain.ErrFile.WithDetail("the file is over %d bytes", sessionsdomain.FileMaxBytes)
	}
	return data, nil
}

func (h *linkHandler) fileHTTP() *http.Client {
	if h.httpClient != nil {
		return h.httpClient
	}
	return &http.Client{Timeout: filePullTimeout}
}
