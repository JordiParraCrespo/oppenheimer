package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Agents run agents (`product/research/lessons-from-herdr.md`): from inside
// a session, `runner sessions run|send|wait|report|children` start a child
// session, type into one, wait for children, report to the parent and list
// them. They go to the running daemon over its local socket, the one process
// that holds the sessions, so a child is the daemon's like any other.

// childRequest is `POST /v1/sessions/{id}/children`.
type childRequest struct {
	Agent         string `json:"agent"`
	Task          string `json:"task"`
	Name          string `json:"name,omitempty"`
	Repo          string `json:"repo,omitempty"`
	Base          string `json:"base,omitempty"`
	OutliveParent bool   `json:"outliveParent,omitempty"`
	Quiet         bool   `json:"quiet,omitempty"`
	Keep          bool   `json:"keep,omitempty"`
}

type keepRequest struct {
	Keep bool `json:"keep"`
}

type textRequest struct {
	Text string `json:"text"`
}

type waitRequest struct {
	Children []string `json:"children,omitempty"`
	// TimeoutSeconds bounds the wait; the children keep running past it.
	TimeoutSeconds int `json:"timeoutSeconds,omitempty"`
}

// childView is what the commands print of a session.
type childView struct {
	ID      string                        `json:"id"`
	Name    string                        `json:"name"`
	Agent   string                        `json:"agent"`
	State   string                        `json:"state"`
	Parent  string                        `json:"parent,omitempty"`
	Folder  string                        `json:"folder"`
	Program *sessionsdomain.ProgramStatus `json:"program,omitempty"`
}

func viewOf(s sessionsdomain.Session) childView {
	return childView{
		ID: s.ID, Name: s.Name, Agent: string(s.Agent), State: string(s.State),
		Parent: s.Parent, Folder: s.Cwd(), Program: s.Program,
	}
}

func viewsOf(sessions []sessionsdomain.Session) []childView {
	out := make([]childView, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, viewOf(s))
	}
	return out
}

// maxWait bounds one wait; a longer one is asked again.
const maxWait = time.Hour

// delegateRoutes mounts the commands' routes on the local socket.
func (a *App) delegateRoutes(router *httpx.Router) {
	router.HandleFunc("POST /v1/sessions/{id}/children", func(w http.ResponseWriter, r *http.Request) error {
		var in childRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		child, err := a.Sessions.Delegate(r.Context(), sessionsapp.DelegateInput{
			Parent: r.PathValue("id"), Agent: sessionsdomain.Agent(in.Agent), Task: in.Task, Name: in.Name,
			Repo: in.Repo, BaseBranch: in.Base, OutliveParent: in.OutliveParent, Quiet: in.Quiet, Keep: in.Keep,
		})
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusCreated, viewOf(child))
	})
	router.HandleFunc("POST /v1/sessions/{id}/keep", func(w http.ResponseWriter, r *http.Request) error {
		var in keepRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		session, err := a.Sessions.Keep(r.PathValue("id"), in.Keep)
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, viewOf(session))
	})
	router.HandleFunc("GET /v1/sessions/{id}/children", func(w http.ResponseWriter, r *http.Request) error {
		return httpx.WriteJSON(w, http.StatusOK, map[string]any{"children": viewsOf(a.Sessions.Children(r.PathValue("id")))})
	})
	router.HandleFunc("POST /v1/sessions/{id}/messages", func(w http.ResponseWriter, r *http.Request) error {
		var in textRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		told, err := a.Sessions.Tell(r.Context(), r.PathValue("id"), in.Text)
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, told)
	})
	router.HandleFunc("POST /v1/sessions/{id}/report", func(w http.ResponseWriter, r *http.Request) error {
		var in textRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		told, err := a.Sessions.Report(r.Context(), r.PathValue("id"), in.Text)
		if err != nil {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, told)
	})
	router.HandleFunc("POST /v1/sessions/{id}/wait", func(w http.ResponseWriter, r *http.Request) error {
		var in waitRequest
		if err := httpx.DecodeJSON(r, &in); err != nil {
			return err
		}
		timeout := time.Duration(in.TimeoutSeconds) * time.Second
		if timeout <= 0 || timeout > maxWait {
			timeout = maxWait
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		children, err := a.Sessions.Wait(ctx, r.PathValue("id"), in.Children)
		settled := err == nil
		if err != nil && !errors.Is(err, context.DeadlineExceeded) {
			return err
		}
		return httpx.WriteJSON(w, http.StatusOK, map[string]any{"settled": settled, "children": viewsOf(children)})
	})
}

// Delegation is the commands' side: a client of the daemon's socket.
type Delegation struct {
	// Socket is the daemon's local socket.
	Socket string
	// Self is the session the command runs in, from its environment; the
	// parent of what it starts and the one a report comes from.
	Self string
	Out  io.Writer
}

// NewDelegation reads where it runs from the session's environment, and
// falls back to this host's socket for a command typed outside a session.
func NewDelegation(out io.Writer) (Delegation, error) {
	socket := os.Getenv("OPPENHEIMER_SOCKET")
	if socket == "" {
		paths, err := ResolvePaths()
		if err != nil {
			return Delegation{}, err
		}
		socket = paths.Socket()
	}
	return Delegation{Socket: socket, Self: os.Getenv("OPPENHEIMER_SESSION"), Out: out}, nil
}

// ChildOptions are `runner sessions run`'s flags.
type ChildOptions struct {
	Parent        string
	Agent         string
	Name          string
	Repo          string
	Base          string
	OutliveParent bool
	Quiet         bool
	Keep          bool
}

// Keep sets whether a session comes back on its own after a reboot.
func (d Delegation) Keep(ctx context.Context, id string, keep bool) error {
	id, err := d.self(id)
	if err != nil {
		return err
	}
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+id+"/keep", keepRequest{Keep: keep}, nil); err != nil {
		return err
	}
	word := "kept: it comes back on its own after a reboot"
	if !keep {
		word = "not kept: after a reboot it waits for Restart"
	}
	_, err = fmt.Fprintf(d.Out, "%s %s\n", id, word)
	return err
}

// Run starts a child session and prints its id.
func (d Delegation) Run(ctx context.Context, opts ChildOptions, task string) error {
	parent, err := d.self(opts.Parent)
	if err != nil {
		return err
	}
	var child childView
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+parent+"/children", childRequest{
		Agent: opts.Agent, Task: task, Name: opts.Name, Repo: opts.Repo, Base: opts.Base,
		OutliveParent: opts.OutliveParent, Quiet: opts.Quiet, Keep: opts.Keep,
	}, &child); err != nil {
		return err
	}
	_, err = fmt.Fprintf(d.Out, "%s\n", child.ID)
	return err
}

// Send types a message into a session's agent.
func (d Delegation) Send(ctx context.Context, id, text string) error {
	var told sessionsapp.Told
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+id+"/messages", textRequest{Text: text}, &told); err != nil {
		return err
	}
	return d.printTold(told)
}

// Report sends this session's parent a message from it.
func (d Delegation) Report(ctx context.Context, text string) error {
	self, err := d.self("")
	if err != nil {
		return err
	}
	var told sessionsapp.Told
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+self+"/report", textRequest{Text: text}, &told); err != nil {
		return err
	}
	return d.printTold(told)
}

// Wait waits for children to settle and prints where each one is.
func (d Delegation) Wait(ctx context.Context, parent string, children []string, timeout time.Duration) error {
	parent, err := d.self(parent)
	if err != nil {
		return err
	}
	var out struct {
		Settled  bool        `json:"settled"`
		Children []childView `json:"children"`
	}
	if err := d.call(ctx, http.MethodPost, "/v1/sessions/"+parent+"/wait",
		waitRequest{Children: children, TimeoutSeconds: int(timeout.Seconds())}, &out); err != nil {
		return err
	}
	if err := d.table(out.Children); err != nil {
		return err
	}
	if !out.Settled {
		return sessionsdomain.ErrNotReady.WithDetail("not every child settled within %s; they keep running", timeout)
	}
	return nil
}

// Children lists a session's children.
func (d Delegation) Children(ctx context.Context, parent string) error {
	parent, err := d.self(parent)
	if err != nil {
		return err
	}
	var out struct {
		Children []childView `json:"children"`
	}
	if err := d.call(ctx, http.MethodGet, "/v1/sessions/"+parent+"/children", nil, &out); err != nil {
		return err
	}
	return d.table(out.Children)
}

func (d Delegation) self(given string) (string, error) {
	if given != "" {
		return given, nil
	}
	if d.Self == "" {
		return "", sessionsdomain.ErrInvalidInput.WithDetail(
			"not inside a session: OPPENHEIMER_SESSION is unset; name the session with --parent")
	}
	return d.Self, nil
}

func (d Delegation) printTold(told sessionsapp.Told) error {
	var line string
	switch {
	case told.Started == nil:
		line = "sent"
	case *told.Started:
		line = "sent; the agent started working"
	default:
		line = "sent; the agent has not started working on it yet"
	}
	_, err := fmt.Fprintln(d.Out, line)
	return err
}

func (d Delegation) table(children []childView) error {
	if len(children) == 0 {
		_, err := fmt.Fprintln(d.Out, "no children")
		return err
	}
	tw := tabwriter.NewWriter(d.Out, 0, 0, 2, ' ', 0)
	p := newPrinter(tw)
	p.printf("ID\tSTATE\tAGENT\tSAYS\n")
	for _, c := range children {
		says := ""
		if c.Program != nil {
			says = strings.Join(nonEmptyWords(c.Program.Kind, c.Program.Message), ": ")
		}
		p.printf("%s\t%s\t%s\t%s\n", c.ID, c.State, c.Agent, says)
	}
	if p.err != nil {
		return p.err
	}
	return tw.Flush()
}

func nonEmptyWords(words ...string) []string {
	var out []string
	for _, w := range words {
		if w != "" {
			out = append(out, w)
		}
	}
	return out
}

// call is one request to the daemon; a problem it answers comes back as the
// same problem, so the exit code is what the daemon decided.
func (d Delegation) call(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	client := &http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", d.Socket)
		},
	}}
	req, err := http.NewRequestWithContext(ctx, method, "http://runner"+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return hostdomain.ErrRunnerDown.WithDetail("start it with `runner run` (or its service): %v", err).WithCause(err)
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		var doc struct {
			Code   string `json:"code"`
			Title  string `json:"title"`
			Detail string `json:"detail"`
		}
		_ = json.Unmarshal(raw, &doc)
		if doc.Title == "" {
			doc.Title = resp.Status
		}
		return problem.New(doc.Code, resp.StatusCode, doc.Title).WithDetail("%s", doc.Detail)
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(raw, out)
}
