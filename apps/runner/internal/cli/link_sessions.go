package cli

// The session verbs of the link, mapped onto the sessions service: what
// `session.create`, `stop`, `restart`, `close`, `window.open`, `window.close`,
// `host.preflight` and `host.update` do on this host. The socket, the epoch and
// the event keys are `link.go`'s; the PTYs are `link_attachments.go`'s.

import (
	"context"
	"encoding/base64"
	"slices"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
)

func (h *linkHandler) create(ctx context.Context, m link.SessionCreate) {
	in, err := createInput(m, h.account())
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	steps := newStartSteps(
		func(p link.SessionStepPayload) { h.reporter.Append(m.SessionID, link.SessionStepKind, p) },
		// The terminal exists, so the session can be attached to: the
		// checkouts' paths are known from the start, so the checkouts this
		// reports are true before they are on disk. A folder session has none.
		func(session sessionsdomain.Session) {
			checkouts := []map[string]any{}
			for _, checkout := range session.Checkouts() {
				checkouts = append(checkouts, map[string]any{
					"checkoutId": checkout.CheckoutID, "branch": session.Branch, "path": checkout.Worktree, "mode": "worktree",
				})
			}
			h.reporter.Append(session.ID, "session.started", map[string]any{"checkouts": checkouts})
		},
		time.Now,
	)
	// A create sent again for a session this host already holds (a redelivery,
	// a reconnect) makes nothing new, so it pulls nothing: its files were
	// pulled once, and a parked file is handed over only once.
	if _, notHeld := h.app.Sessions.Get(m.SessionID); notHeld != nil {
		in.Files, err = h.pullCreateFiles(ctx, m.Images)
	}
	if err != nil {
		h.fail(m.CommandID, err)
		h.reporter.Append(m.SessionID, "session.failed", failurePayload(err))
		return
	}
	in.Progress = steps.stage
	if _, err = h.app.Sessions.Create(ctx, in); err != nil {
		h.fail(m.CommandID, err)
		h.reporter.Append(m.SessionID, "session.failed", failurePayload(err))
	}
}

// createInput reads a `session.create` into what the sessions service takes:
// a folder session when it names a folder, else a worktree session on its
// checkouts, one worktree each, under the account's and workspace's levels of
// the work folder (24 §2, §3). account is the pairing's (linkHandler.account).
//
// The checkout the agent is to start in (cwdCheckoutId) is put first, since
// the first is the one a session of one runs in and the one an older state
// file knew; with several, the agent starts in the session's folder above
// them all, and the first is only the one the session is named by.
func createInput(m link.SessionCreate, account string) (sessionsapp.CreateInput, error) {
	agent, ok := sessionsdomain.AgentFromCatalogID(m.Agent)
	if !ok {
		return sessionsapp.CreateInput{}, sessionsdomain.ErrInvalidInput.WithDetail("unknown agent %q", m.Agent)
	}
	in := sessionsapp.CreateInput{
		ID:    m.SessionID,
		Name:  m.SessionSlug,
		Agent: agent,
		Launch: sessionsdomain.Launch{
			Model: m.Launch.Model, Permission: m.Launch.Permission, Effort: m.Launch.Effort, Prompt: m.Prompt,
			// The name the agent's conversation takes, so what it says can be
			// reopened after the session stops.
			Conversation: m.Launch.Conversation, Resume: m.Launch.Resume,
		},
	}
	if m.Folder != "" {
		if len(m.Checkouts) > 0 || m.Branch != "" {
			return sessionsapp.CreateInput{}, sessionsdomain.ErrInvalidInput.WithDetail(
				"a session runs in a folder or in checkouts, never both")
		}
		in.Folder = m.Folder
		return in, nil
	}
	if len(m.Checkouts) == 0 {
		return sessionsapp.CreateInput{}, sessionsdomain.ErrInvalidInput.WithDetail(
			"a session runs in a folder or in at least one checkout; the frame carried neither")
	}
	checkouts := m.Checkouts
	if m.CwdCheckoutID != nil {
		at := slices.IndexFunc(checkouts, func(c link.Checkout) bool { return c.CheckoutID == *m.CwdCheckoutID })
		if at < 0 {
			return sessionsapp.CreateInput{}, sessionsdomain.ErrInvalidInput.WithDetail(
				"the agent is to start in checkout %q, which the frame does not carry", *m.CwdCheckoutID)
		}
		// The rest keep the frame's order.
		checkouts = slices.Concat(checkouts[at:at+1], checkouts[:at], checkouts[at+1:])
	}
	first := checkouts[0]
	in.Tenant = sessionsdomain.Tenant{Account: account, Workspace: m.WorkspaceID}
	in.WorkspaceSlug = m.OrganizationSlug
	in.Slug = m.SessionSlug
	in.Directory = first.DirectoryName
	in.Repo = first.RepositoryFullName
	in.Remote = githubRemote(first.RepositoryFullName)
	in.BaseBranch = first.BaseBranch
	in.Branch = m.Branch
	in.CheckoutID, in.GithubRepoID = first.CheckoutID, first.GithubRepoID
	for _, c := range checkouts[1:] {
		in.More = append(in.More, sessionsapp.CheckoutInput{
			Directory: c.DirectoryName, Repo: c.RepositoryFullName, Remote: githubRemote(c.RepositoryFullName),
			BaseBranch: c.BaseBranch, CheckoutID: c.CheckoutID, GithubRepoID: c.GithubRepoID,
		})
	}
	return in, nil
}

// githubRemote is where a repository's store is fetched from: GitHub over
// HTTPS, which the credential helper answers for.
func githubRemote(repo string) string {
	return "https://github.com/" + repo + ".git"
}

// account is the work folder's top level for everything the link sends: the
// account this host was paired with (24 §2), which no frame repeats. An
// identity paired before registration answered one names its folder by the
// host's own id, which is as stable.
func (h *linkHandler) account() string {
	if h.identity.AccountID != "" {
		return h.identity.AccountID
	}
	return h.identity.HostID
}

// lifecycleCommand is what lifecycle reads of stop, restart, close,
// window.open and window.close: each is its own message on the wire, and
// this is the union of the fields the handler acts on.
type lifecycleCommand struct {
	Type               string
	CommandID          string
	SessionID          string
	Window             int
	AcceptUnpushedWork bool
}

// decodeLifecycle decodes a lifecycle message into its own generated struct
// and keeps what lifecycle reads. ok is false for a body that does not decode.
func decodeLifecycle(msg link.Message) (lifecycleCommand, bool) {
	m := lifecycleCommand{Type: msg.Type}
	var err error
	switch msg.Type {
	case link.TypeSessionStop:
		var body link.SessionStop
		err = msg.Decode(&body)
		m.CommandID, m.SessionID = body.CommandID, body.SessionID
	case link.TypeSessionRestart:
		var body link.SessionRestart
		err = msg.Decode(&body)
		m.CommandID, m.SessionID = body.CommandID, body.SessionID
	case link.TypeSessionClose:
		var body link.SessionClose
		err = msg.Decode(&body)
		m.CommandID, m.SessionID, m.AcceptUnpushedWork = body.CommandID, body.SessionID, body.AcceptUnpushedWork
	case link.TypeSessionWindowOpen:
		var body link.SessionWindowOpen
		err = msg.Decode(&body)
		m.CommandID, m.SessionID = body.CommandID, body.SessionID
	case link.TypeSessionWindowClose:
		var body link.SessionWindowClose
		err = msg.Decode(&body)
		m.CommandID, m.SessionID, m.Window = body.CommandID, body.SessionID, body.Window
	default:
		return lifecycleCommand{}, false
	}
	return m, err == nil
}

func (h *linkHandler) lifecycle(ctx context.Context, m lifecycleCommand) {
	var err error
	switch m.Type {
	case "session.stop":
		h.mu.Lock()
		h.decided[m.SessionID] = true
		h.mu.Unlock()
		if _, err = h.app.Sessions.Stop(ctx, m.SessionID); err != nil {
			h.mu.Lock()
			delete(h.decided, m.SessionID)
			h.mu.Unlock()
		}
	case "session.restart":
		var session sessionsdomain.Session
		if session, err = h.app.Sessions.Restart(ctx, m.SessionID); err == nil {
			h.reporter.Append(session.ID, "session.restarted", map[string]any{})
		}
	case "session.close":
		_, err = h.app.Sessions.Close(ctx, m.SessionID, sessionsapp.CloseInput{Push: true, Force: m.AcceptUnpushedWork})
		if err == nil && h.devices != nil {
			// A closed session is resolved: its device goes back to the host.
			h.devices.Release(m.SessionID)
		}
		h.credentials.Forget(m.SessionID)
	case "session.window.open":
		_, err = h.app.Sessions.OpenWindow(ctx, m.SessionID)
	case "session.window.close":
		err = h.app.Sessions.CloseWindow(ctx, m.SessionID, m.Window)
	}
	if err != nil {
		h.fail(m.CommandID, err)
	}
}

// preflight re-collects the host facts and reports them at once, as a
// heartbeat, which is the shape the control plane already reads them in. The
// facts are collected once: a failed check still reports what it found.
func (h *linkHandler) preflight(ctx context.Context, commandID string) {
	facts, err := h.app.Host.Preflight(ctx)
	if err != nil {
		h.fail(commandID, err)
		if facts.Platform == "" {
			return // the collection itself failed: there is nothing to report
		}
	}
	beat := h.heartbeatFrom(facts)
	beat.Type = "heartbeat"
	_ = h.client.Send(beat)
}

// prepareRepository gets a repository ready for the create a person is about
// to send: its store in the workspace's `repos/` made or fetched and a spare
// worktree checked out (02 §5, 24 §2). Its git runs as `prepare:<command id>`, an identity the broker
// holds this command's own token for: there is no session to ask one for.
func (h *linkHandler) prepareRepository(ctx context.Context, m link.RepositoryPrepare) {
	sealed, err := base64.StdEncoding.DecodeString(m.Sealed)
	if err != nil {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("the prepare's token is not base64"))
		return
	}
	token, err := h.app.Pairing.Unseal(sealed)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	repo := sessionsdomain.Repository{
		Tenant:   sessionsdomain.Tenant{Account: h.account(), Workspace: m.WorkspaceID},
		FullName: m.RepositoryFullName, GithubID: m.GithubRepoID,
	}
	if err := repo.Validate(); err != nil {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("%v", err).WithCause(err))
		return
	}
	if h.app.WorkFolder != nil {
		if err := h.app.WorkFolder.MakeWorkspace(repo.Tenant, ""); err != nil {
			h.fail(m.CommandID, err)
			return
		}
	}
	id := preparePrefix + m.CommandID
	h.credentials.Hold(id, string(token), m.ExpiresAt)
	defer h.credentials.Forget(id)

	ctx = sessionsdomain.WithSession(ctx, id)
	remote := githubRemote(m.RepositoryFullName)
	if err := h.app.Worktrees.PrepareRepository(ctx, repo, remote, m.BaseBranch); err != nil {
		h.fail(m.CommandID, err)
	}
}

// update applies a version the control plane asks for: the pin and the safe
// window are the control plane's to override here, the signature and the
// digest never are (09 §5). With no version it asks for the newest now, which
// skips the safe window but not a pin: a pinned host refuses with UPD_004.
func (h *linkHandler) update(ctx context.Context, m link.HostUpdate) {
	if h.app.Updates == nil {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("this host is not paired"))
		return
	}
	if m.Version != "" {
		if _, err := h.app.Pairing.SetPin(m.Version); err != nil {
			h.fail(m.CommandID, err)
			return
		}
	}
	if _, err := h.app.Updates.Apply(ctx, updapp.ApplyOptions{Force: true, KeepPin: m.Version == ""}); err != nil {
		h.fail(m.CommandID, err)
	}
}
