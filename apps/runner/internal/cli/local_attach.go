package cli

// The desktop app's terminal: a WebSocket on the runner's local socket that
// carries one tmux attachment straight to a process on this machine, with no
// control plane in between. The socket is 0600 in a 0700 directory, so only
// this account can dial it; that is the whole of its authorization, the same
// as the credential helper's.
//
// Spike (product/versions/mvp/27-desktop-app.md): binary frames are PTY bytes
// both ways, text frames are `{"type":"resize","cols":…,"rows":…}`. Flow
// control is the socket's own: a reader that stops reading stalls the write,
// which stalls the PTY read, which leaves the backlog in tmux.

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/coder/websocket"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

type localControl struct {
	Type string `json:"type"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

func (a *App) localAttach(w http.ResponseWriter, r *http.Request) error {
	window, _ := strconv.Atoi(r.URL.Query().Get("window"))
	cols, _ := strconv.Atoi(r.URL.Query().Get("cols"))
	rows, _ := strconv.Atoi(r.URL.Query().Get("rows"))
	size := sessionsapp.Size{Cols: clampSize(cols), Rows: clampSize(rows)}
	pty, err := a.Sessions.Attach(r.Context(), r.PathValue("id"), window, size, false)
	if err != nil {
		return err
	}
	sock, err := websocket.Accept(w, r, nil)
	if err != nil {
		_ = pty.Close()
		return nil
	}
	sock.SetReadLimit(1 << 20)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer func() { _ = pty.Close() }()

	go func() {
		defer cancel()
		buf := make([]byte, ptyRead)
		for {
			n, err := pty.Read(buf)
			if n > 0 {
				if werr := sock.Write(ctx, websocket.MessageBinary, buf[:n]); werr != nil {
					return
				}
			}
			if err != nil {
				_ = sock.Close(websocket.StatusNormalClosure, "pty closed")
				return
			}
		}
	}()

	for {
		kind, data, err := sock.Read(ctx)
		if err != nil {
			return nil
		}
		if kind == websocket.MessageBinary {
			if _, err := pty.Write(data); err != nil {
				return nil
			}
			continue
		}
		var m localControl
		if json.Unmarshal(data, &m) == nil && m.Type == "resize" {
			_ = pty.Resize(sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
		}
	}
}
