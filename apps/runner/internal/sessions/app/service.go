package app

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Options configure the session service.
type Options struct {
	Terminals  Terminals
	Worktrees  Worktrees
	Classifier Classifier
	Store      Store
	Publisher  Publisher
	// Images keeps the pictures pasted into a session's prompt.
	Images Images
	// Layout is where repositories and worktrees live on this host.
	Layout domain.Layout
	// Env is added to every session's tmux environment, inherited by every
	// window: the session id and the runner's socket, so the git credential
	// helper called from that shell can ask who it is answering for.
	Env func(session domain.Session) map[string]string
	Now func() time.Time
}

// Service is the session lifecycle.
type Service struct {
	mu sync.Mutex
	// save serialises writes to the store: two goroutines that both took a
	// snapshot could otherwise write them in the opposite order and leave
	// the older one on disk.
	save     sync.Mutex
	sessions map[string]domain.Session
	// creating holds each create still running, keyed by session id. Get
	// answers from it, so the session is there — `creating`, with its
	// checkout — for the credential helper its own clone calls; and a second
	// create for the same id joins the first instead of racing it.
	creating   map[string]*creation
	terminals  Terminals
	worktrees  Worktrees
	classifier Classifier
	store      Store
	publisher  Publisher
	images     Images
	layout     domain.Layout
	env        func(domain.Session) map[string]string
	now        func() time.Time
}

// New builds the service and loads the session map from disk.
func New(opts Options) (*Service, error) {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	publisher := opts.Publisher
	if publisher == nil {
		publisher = NopPublisher{}
	}
	env := opts.Env
	if env == nil {
		env = func(domain.Session) map[string]string { return nil }
	}
	s := &Service{
		sessions: map[string]domain.Session{}, creating: map[string]*creation{},
		terminals: opts.Terminals, worktrees: opts.Worktrees,
		classifier: opts.Classifier, store: opts.Store, publisher: publisher,
		images: opts.Images, layout: opts.Layout, env: env, now: now,
	}
	if opts.Store != nil {
		loaded, err := opts.Store.Load()
		if err != nil {
			return nil, domain.ErrNotFound.WithDetail("read the session map: %v", err).WithCause(err)
		}
		for _, session := range loaded {
			s.sessions[session.ID] = session.Clone()
		}
	}
	return s, nil
}

// SetPublisher swaps the publisher after construction: the link that
// forwards state changes is built after the service, by the composition
// root, and until it exists the service publishes to nobody.
func (s *Service) SetPublisher(publisher Publisher) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if publisher == nil {
		publisher = NopPublisher{}
	}
	s.publisher = publisher
}

// CreateInput is what the console sends to open a session.
type CreateInput struct {
	// ID is the control plane's session id when the create arrives over the
	// link, so an attach that names it finds it; the CLI leaves it empty and
	// one is minted.
	ID   string
	Repo string
	// Remote is where the mirror is cloned from. The control plane supplies
	// it with a credential-helper-backed URL; nothing is written to disk.
	Remote string
	// BaseBranch is what the session's branch is cut from.
	BaseBranch string
	// Branch, when empty, means a new branch named after the session.
	Branch string
	// Existing checks out Branch instead of creating it.
	Existing bool
	Name     string
	Agent    domain.Agent
	// Launch is the model, permission, effort and first task, as argv, from
	// the catalog (02-runner §5). Zero for a CLI-created session.
	Launch domain.Launch
	// CheckoutID and GithubRepoID are the control plane's names for the
	// repository, kept for the credential helper.
	CheckoutID   string
	GithubRepoID int64
	// Progress, when set, hears each stage start and land, in order. It must
	// not block.
	Progress func(domain.StageEvent)
}

// Create makes a session: mirror, worktree, tmux session, agent in window 0.
// Each step is observable on disk, so a failure half-way leaves something a
// person can look at rather than a mystery.
func (s *Service) Create(ctx context.Context, in CreateInput) (domain.Session, error) {
	if err := s.terminals.Available(ctx); err != nil {
		return domain.Session{}, err
	}
	if err := domain.ValidateRepo(in.Repo); err != nil {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}
	agent := in.Agent
	if agent == "" {
		agent = domain.AgentClaude
	}
	if !agent.Valid() {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v: %q", domain.ErrUnknownAgent, agent)
	}
	base := in.BaseBranch
	if base == "" {
		base = "main"
	}
	if err := domain.ValidateBranch(base); err != nil {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}

	id := in.ID
	if id == "" {
		minted, err := domain.NewID()
		if err != nil {
			return domain.Session{}, domain.ErrInvalidInput.WithDetail("generate a session id: %v", err).WithCause(err)
		}
		id = minted
	}
	branch := in.Branch
	if branch == "" {
		branch = domain.DefaultBranchName(id)
	}
	if err := domain.ValidateBranch(branch); err != nil {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}

	now := s.now().UTC()
	session := domain.Session{
		ID: id, Name: nameOr(in.Name, branch), Repo: in.Repo,
		BaseBranch: base, Branch: branch, Worktree: s.layout.Worktree(in.Repo, domain.Slug(branch, id)),
		Agent: agent, Launch: in.Launch,
		CheckoutID: in.CheckoutID, GithubRepoID: in.GithubRepoID,
		State: domain.StateCreating, Created: now, Updated: now,
		Windows: []domain.Window{{Index: 0, Name: string(agent), Agent: true}},
	}
	// Idempotent by session id: a create redelivered after a reconnect finds
	// the session it already made, or joins the create still making it.
	c, first, existing := s.begin(session)
	if existing != nil {
		return *existing, nil
	}
	if !first {
		return c.wait(ctx)
	}
	created, err := s.create(domain.WithSession(ctx, id), in, session)
	s.end(c, created, err)
	return created, err
}

// create walks the stages. Each is observable on disk, so a failure half-way
// leaves something a person can look at rather than a mystery — and something
// the next attempt for the same session takes over (Worktrees.Add).
func (s *Service) create(ctx context.Context, in CreateInput, session domain.Session) (domain.Session, error) {
	// Every stage runs through run, so "started, then landed or failed" is
	// the one shape a stage can have, and a new stage cannot report half of it.
	run := func(stage domain.Stage, fn func() error) error {
		started := s.now()
		if in.Progress != nil {
			in.Progress(domain.StageEvent{Stage: stage})
		}
		if err := fn(); err != nil {
			return err
		}
		if in.Progress != nil {
			in.Progress(domain.StageEvent{Stage: stage, Done: true, Took: s.now().Sub(started)})
		}
		return nil
	}

	if err := run(domain.StageClone, func() error {
		return s.worktrees.Ensure(ctx, in.Repo, in.Remote)
	}); err != nil {
		return domain.Session{}, err
	}
	if err := run(domain.StageWorktree, func() error {
		return s.worktrees.Add(ctx, in.Repo, session.Worktree, session.Branch, session.BaseBranch, !in.Existing)
	}); err != nil {
		return domain.Session{}, err
	}
	session.State = domain.StateStarting
	if err := run(domain.StageAgent, func() error {
		return s.terminals.Create(ctx, session.TmuxName(), session.Worktree, in.Launch.CommandLine(session.Agent), s.env(session))
	}); err != nil {
		// Leave the worktree: it is on disk, it is the user's, and a
		// half-created session they can see beats one that vanished.
		return domain.Session{}, err
	}
	return session, nil
}

// creation is one create in flight.
type creation struct {
	session domain.Session
	done    chan struct{}
	result  domain.Session
	err     error
}

// begin registers a create, or finds what is already there for its id: a
// recorded session (existing), or a create still running (first is false).
func (s *Service) begin(session domain.Session) (c *creation, first bool, existing *domain.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if recorded, ok := s.sessions[session.ID]; ok {
		clone := recorded.Clone()
		return nil, false, &clone
	}
	if running, ok := s.creating[session.ID]; ok {
		return running, false, nil
	}
	c = &creation{session: session, done: make(chan struct{})}
	s.creating[session.ID] = c
	return c, true, nil
}

// end records a create's outcome — the session, when it landed — and wakes
// every create that joined it. The record is written before the pending entry
// goes, so Get never finds neither.
func (s *Service) end(c *creation, session domain.Session, err error) {
	if err == nil {
		s.put(session)
	}
	s.mu.Lock()
	delete(s.creating, c.session.ID)
	c.result, c.err = session, err
	s.mu.Unlock()
	close(c.done)
}

// wait is a joined create: the first one's outcome, or ctx's end.
func (c *creation) wait(ctx context.Context) (domain.Session, error) {
	select {
	case <-c.done:
		return c.result, c.err
	case <-ctx.Done():
		return domain.Session{}, ctx.Err()
	}
}

// List returns every session this runner knows, newest first.
func (s *Service) List() []domain.Session {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]domain.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		out = append(out, session.Clone())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Created.After(out[j].Created) })
	return out
}

// Get returns one session: a recorded one, or one whose create is still
// running, as `creating`.
func (s *Service) Get(id string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		if running, creating := s.creating[id]; creating {
			return running.session.Clone(), nil
		}
		return domain.Session{}, domain.ErrNotFound.WithDetail("no session %q on this host", id)
	}
	return session.Clone(), nil
}

// recorded is a session every operation but Get may act on: one whose create
// has landed. A session still being created has no tmux session and maybe no
// worktree to act on yet.
func (s *Service) recorded(id string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if session, ok := s.sessions[id]; ok {
		return session.Clone(), nil
	}
	if _, creating := s.creating[id]; creating {
		return domain.Session{}, domain.ErrNotRunning.WithDetail("session %q is still being created", id)
	}
	return domain.Session{}, domain.ErrNotFound.WithDetail("no session %q on this host", id)
}

// OpenWindow adds a tab: a plain shell in the same worktree.
func (s *Service) OpenWindow(ctx context.Context, id string) (domain.Window, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Window{}, err
	}
	if !session.State.Live() {
		return domain.Window{}, domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	index, err := s.terminals.NewWindow(ctx, session.TmuxName(), session.Worktree)
	if err != nil {
		return domain.Window{}, err
	}
	window := domain.Window{Index: index, Name: "shell"}
	session.Windows = append(session.Windows, window)
	session.Updated = s.now().UTC()
	s.put(session)
	return window, nil
}

// CloseWindow closes a tab. Window 0 is the agent and is closed by closing
// the session, not by closing a tab.
func (s *Service) CloseWindow(ctx context.Context, id string, index int) error {
	session, err := s.recorded(id)
	if err != nil {
		return err
	}
	if index == 0 {
		return domain.ErrInvalidInput.WithDetail("window 0 is the agent; close the session instead")
	}
	if _, ok := session.Window(index); !ok {
		return domain.ErrNotFound.WithDetail("%v: %d", domain.ErrNoSuchWindow, index)
	}
	if err := s.terminals.KillWindow(ctx, session.Target(index)); err != nil {
		return err
	}
	kept := session.Windows[:0]
	for _, w := range session.Windows {
		if w.Index != index {
			kept = append(kept, w)
		}
	}
	session.Windows = kept
	session.Updated = s.now().UTC()
	s.put(session)
	return nil
}

// Attach opens a PTY onto one window. Several devices may attach to the same
// window; tmux sizes it to the smallest attached client.
func (s *Service) Attach(ctx context.Context, id string, window int, size Size) (Attachment, error) {
	session, err := s.recorded(id)
	if err != nil {
		return nil, err
	}
	if !session.State.Live() {
		return nil, domain.ErrNotRunning.WithDetail(
			"session %s is %s; restart it to attach", id, session.State)
	}
	if _, ok := session.Window(window); !ok {
		return nil, domain.ErrNotFound.WithDetail("%v: %d", domain.ErrNoSuchWindow, window)
	}
	return s.terminals.Attach(ctx, session.Target(window), size)
}

// Send types into a window, which is how the browser's keystrokes arrive
// while nothing is attached.
func (s *Service) Send(ctx context.Context, id string, window int, keys string) error {
	session, err := s.recorded(id)
	if err != nil {
		return err
	}
	if !session.State.Live() {
		return domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	return s.terminals.SendKeys(ctx, session.Target(window), keys)
}

// PasteImage gives a window's program an image: it is written to the host
// and its path pasted into the window, as a drag-and-drop does in a local
// terminal — the agent reads its host's clipboard, never the browser's. The
// bytes must be the type they claim to be, the file is named by the command
// id (checked at the link, and refused by the store if it is not a plain
// name), and a paste that does not land takes its file with it.
func (s *Service) PasteImage(ctx context.Context, id string, window int, commandID, mediaType string, data []byte) (string, error) {
	session, err := s.recorded(id)
	if err != nil {
		return "", err
	}
	if !session.State.Live() {
		return "", domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	if _, ok := session.Window(window); !ok {
		return "", domain.ErrNotFound.WithDetail("%v: %d", domain.ErrNoSuchWindow, window)
	}
	if s.images == nil {
		return "", domain.ErrImage.WithDetail("this runner keeps no images")
	}
	ext, ok := domain.ImageExtension(mediaType)
	if !ok {
		return "", domain.ErrImage.WithDetail("%q is not an image type a session takes", mediaType)
	}
	if sniffed := domain.SniffImage(data); sniffed != mediaType {
		return "", domain.ErrImage.WithDetail("the bytes are not a %s image", mediaType)
	}
	name := commandID + ext
	path, err := s.images.Save(session.ID, name, data)
	if err != nil {
		return "", domain.ErrImage.WithDetail("write the image: %v", err).WithCause(err)
	}
	if err := s.terminals.Paste(ctx, session.Target(window), commandID, path); err != nil {
		_ = s.images.Delete(session.ID, name)
		return "", err
	}
	return path, nil
}

// Refresh re-reads window 0 and updates the state and the login URL. It is
// what the poll loop calls: every second while a client is attached, every
// ten when none is.
func (s *Service) Refresh(ctx context.Context, id string) (domain.Session, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Session{}, err
	}
	if !session.State.Live() {
		return session, nil
	}
	alive, err := s.terminals.Has(ctx, session.TmuxName())
	if err != nil {
		return session, err
	}
	if !alive {
		// The tmux session is gone — a host reboot, or someone killed it.
		// The worktree is intact, so this is `stopped`, not `closed`.
		return s.transition(session, domain.StateStopped, ""), nil
	}
	screen, err := s.terminals.Capture(ctx, session.Target(0))
	if err != nil {
		return session, err
	}
	state, loginURL := s.classifier.Classify(screen, session.Agent)
	return s.transition(session, state, loginURL), nil
}

// Restart recreates window 0 in the same worktree. It is the Restart button
// on a session that stopped when the host rebooted.
func (s *Service) Restart(ctx context.Context, id string) (domain.Session, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Session{}, err
	}
	if session.State == domain.StateClosed {
		return domain.Session{}, domain.ErrNotRunning.WithDetail(
			"session %s is closed; its worktree has been removed", id)
	}
	if alive, err := s.terminals.Has(ctx, session.TmuxName()); err != nil {
		return domain.Session{}, err
	} else if alive {
		return session, nil
	}
	if err := s.terminals.Create(ctx, session.TmuxName(), session.Worktree, session.Launch.CommandLine(session.Agent), s.env(session)); err != nil {
		return domain.Session{}, err
	}
	session.Windows = []domain.Window{{Index: 0, Name: string(session.Agent), Agent: true}}
	return s.transition(session, domain.StateStarting, ""), nil
}

// Stop ends the agent and the tmux session and leaves every checkout on disk,
// which is what Restart needs afterwards. It is not Close: nothing is pushed
// and nothing is removed (02-runner §5, "Stop is not close").
func (s *Service) Stop(ctx context.Context, id string) (domain.Session, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Session{}, err
	}
	if !session.State.Live() {
		return session, nil
	}
	if err := s.terminals.Kill(ctx, session.TmuxName()); err != nil {
		return domain.Session{}, err
	}
	return s.transition(session, domain.StateStopped, ""), nil
}

// CloseInput tunes what closing does.
type CloseInput struct {
	// Push publishes the branch before the worktree goes. The console's
	// Close does; a forced local cleanup may not.
	Push bool
	// Force removes a worktree with uncommitted changes.
	Force bool
}

// Close ends a session: kill the tmux session, push the branch if asked, and
// remove the worktree. A dirty worktree is not a reason to refuse — it is
// reported, and the worktree is kept unless Force says otherwise.
func (s *Service) Close(ctx context.Context, id string, in CloseInput) (domain.Session, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Session{}, err
	}
	if err := s.terminals.Kill(ctx, session.TmuxName()); err != nil {
		return domain.Session{}, err
	}

	dirty, dirtyErr := s.worktrees.Dirty(ctx, session.Worktree)
	if dirtyErr == nil {
		session.Dirty = dirty
	}
	var pushErr error
	if in.Push {
		if _, pushErr = s.worktrees.Push(ctx, session.Worktree, session.Branch); pushErr != nil {
			// Report and keep going: the session is over either way, and
			// the branch is still in the worktree we are about to name.
			session.Dirty = true
		}
	}
	if session.Dirty && !in.Force {
		session = s.transition(session, domain.StateStopped, "")
		detail := "the worktree has uncommitted changes and was kept at " + session.Worktree
		if pushErr != nil {
			detail = "the branch could not be pushed, so the worktree was kept at " + session.Worktree
		}
		return session, domain.ErrPushRejected.WithDetail("%s", detail).WithCause(pushErr)
	}
	if err := s.worktrees.Remove(ctx, session.Repo, session.Worktree, in.Force); err != nil {
		return session, err
	}
	return s.transition(session, domain.StateClosed, ""), nil
}

// Adopt reconciles with the tmux server after a restart: sessions whose tmux
// session is still there are taken back over, the rest are marked stopped.
// Nothing is killed here — an orphan is only ever a session this runner
// created, and deciding to kill one is the control plane's call, not a
// side effect of booting.
func (s *Service) Adopt(ctx context.Context) ([]domain.Session, error) {
	if err := s.terminals.Available(ctx); err != nil {
		return nil, err
	}
	live, err := s.terminals.List(ctx)
	if err != nil {
		return nil, err
	}
	running := map[string]bool{}
	for _, name := range live {
		running[name] = true
	}

	var adopted []domain.Session
	for _, session := range s.List() {
		if session.State == domain.StateClosed {
			continue
		}
		if !running[session.TmuxName()] {
			s.transition(session, domain.StateStopped, "")
			continue
		}
		if windows, err := s.terminals.Windows(ctx, session.TmuxName()); err == nil && len(windows) > 0 {
			session.Windows = windows
		}
		adopted = append(adopted, s.transition(session, domain.StateUnknown, session.LoginURL))
	}
	return adopted, nil
}

// Orphans are tmux sessions with our prefix that no session record claims —
// what a crash between `tmux new-session` and the first save leaves behind.
func (s *Service) Orphans(ctx context.Context) ([]string, error) {
	live, err := s.terminals.List(ctx)
	if err != nil {
		return nil, err
	}
	known := map[string]bool{}
	for _, session := range s.List() {
		known[session.TmuxName()] = true
	}
	var orphans []string
	for _, name := range live {
		if len(name) > len(domain.Prefix) && name[:len(domain.Prefix)] == domain.Prefix && !known[name] {
			orphans = append(orphans, name)
		}
	}
	return orphans, nil
}

// Running names every tmux session this runner owns that is up right now —
// recorded sessions and orphans alike — without changing a single record. It
// is what `uninstall` must not leave behind unattended: an agent in one of
// these keeps working after the runner is gone, with no control plane and no
// console to see it. A host with no tmux has nothing running.
func (s *Service) Running(ctx context.Context) ([]string, error) {
	if err := s.terminals.Available(ctx); err != nil {
		return nil, nil //nolint:nilerr // no tmux means no sessions, which is the answer
	}
	live, err := s.terminals.List(ctx)
	if err != nil {
		return nil, err
	}
	var running []string
	for _, name := range live {
		if strings.HasPrefix(name, domain.Prefix) && len(name) > len(domain.Prefix) {
			running = append(running, name)
		}
	}
	sort.Strings(running)
	return running, nil
}

// EndAll kills every tmux session Running names and records the sessions it
// knows as stopped. Checkouts stay on disk: ending the agents is what
// `uninstall --force` asks for, deleting someone's work is not.
func (s *Service) EndAll(ctx context.Context) ([]string, error) {
	running, err := s.Running(ctx)
	if err != nil {
		return nil, err
	}
	byTmux := map[string]domain.Session{}
	for _, session := range s.List() {
		byTmux[session.TmuxName()] = session
	}
	var ended []string
	var errs []error
	for _, name := range running {
		if err := s.terminals.Kill(ctx, name); err != nil {
			errs = append(errs, err)
			continue
		}
		ended = append(ended, name)
		if session, ok := byTmux[name]; ok && session.State != domain.StateClosed {
			s.transition(session, domain.StateStopped, "")
		}
	}
	return ended, errors.Join(errs...)
}

func (s *Service) transition(session domain.Session, state domain.State, loginURL string) domain.Session {
	changed := session.State != state || session.LoginURL != loginURL
	session.State = state
	if loginURL != "" {
		session.LoginURL = loginURL
	}
	if changed {
		session.Updated = s.now().UTC()
	}
	s.put(session)
	// Pasted images were for the agent in the tmux session; once it is gone
	// — stopped, closed, lost to a reboot — nothing will read them. Every way
	// a session stops comes through here, so this is the one place they go.
	if !state.Live() && s.images != nil {
		_ = s.images.Discard(session.ID)
	}
	if changed {
		s.mu.Lock()
		publisher := s.publisher
		s.mu.Unlock()
		publisher.SessionChanged(session)
	}
	return session
}

// put stores a session and persists the map. A failed save is not worth
// failing a live session for: the map is a cache, and the control plane and
// tmux both still know the truth.
func (s *Service) put(session domain.Session) {
	if s.store == nil {
		s.mu.Lock()
		s.sessions[session.ID] = session.Clone()
		s.mu.Unlock()
		return
	}
	// The save lock is taken first and held across both the snapshot and the
	// write, so snapshots reach the disk in the order they were taken.
	s.save.Lock()
	defer s.save.Unlock()

	s.mu.Lock()
	s.sessions[session.ID] = session.Clone()
	snapshot := make([]domain.Session, 0, len(s.sessions))
	for _, item := range s.sessions {
		snapshot = append(snapshot, item.Clone())
	}
	s.mu.Unlock()

	_ = s.store.Save(snapshot)
}

func nameOr(name, fallback string) string {
	if name != "" {
		return name
	}
	return fallback
}
