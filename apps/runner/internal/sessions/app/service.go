package app

import (
	"context"
	"sort"
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
	mu         sync.Mutex
	sessions   map[string]domain.Session
	terminals  Terminals
	worktrees  Worktrees
	classifier Classifier
	store      Store
	publisher  Publisher
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
		sessions: map[string]domain.Session{}, terminals: opts.Terminals, worktrees: opts.Worktrees,
		classifier: opts.Classifier, store: opts.Store, publisher: publisher,
		layout: opts.Layout, env: env, now: now,
	}
	if opts.Store != nil {
		loaded, err := opts.Store.Load()
		if err != nil {
			return nil, domain.ErrNotFound.WithDetail("read the session map: %v", err).WithCause(err)
		}
		for _, session := range loaded {
			s.sessions[session.ID] = session
		}
	}
	return s, nil
}

// CreateInput is what the console sends to open a session.
type CreateInput struct {
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

	id, err := domain.NewID()
	if err != nil {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("generate a session id: %v", err).WithCause(err)
	}
	branch := in.Branch
	if branch == "" {
		branch = domain.DefaultBranchName(id)
	}
	if err := domain.ValidateBranch(branch); err != nil {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}

	if err := s.worktrees.Ensure(ctx, in.Repo, in.Remote); err != nil {
		return domain.Session{}, err
	}
	worktree := s.layout.Worktree(in.Repo, domain.Slug(branch, id))
	if err := s.worktrees.Add(ctx, in.Repo, worktree, branch, base, !in.Existing); err != nil {
		return domain.Session{}, err
	}

	now := s.now().UTC()
	session := domain.Session{
		ID: id, Name: nameOr(in.Name, branch), Repo: in.Repo,
		BaseBranch: base, Branch: branch, Worktree: worktree, Agent: agent,
		State: domain.StateStarting, Created: now, Updated: now,
		Windows: []domain.Window{{Index: 0, Name: string(agent), Agent: true}},
	}
	if err := s.terminals.Create(ctx, session.TmuxName(), worktree, agent.Command(), s.env(session)); err != nil {
		// Leave the worktree: it is on disk, it is the user's, and a
		// half-created session they can see beats one that vanished.
		return domain.Session{}, err
	}

	s.put(session)
	return session, nil
}

// List returns every session this runner knows, newest first.
func (s *Service) List() []domain.Session {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]domain.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		out = append(out, session)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Created.After(out[j].Created) })
	return out
}

// Get returns one session.
func (s *Service) Get(id string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return domain.Session{}, domain.ErrNotFound.WithDetail("no session %q on this host", id)
	}
	return session, nil
}

// OpenWindow adds a tab: a plain shell in the same worktree.
func (s *Service) OpenWindow(ctx context.Context, id string) (domain.Window, error) {
	session, err := s.Get(id)
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
	session, err := s.Get(id)
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
	session, err := s.Get(id)
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
	session, err := s.Get(id)
	if err != nil {
		return err
	}
	if !session.State.Live() {
		return domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	return s.terminals.SendKeys(ctx, session.Target(window), keys)
}

// Refresh re-reads window 0 and updates the state and the login URL. It is
// what the poll loop calls: every second while a client is attached, every
// ten when none is.
func (s *Service) Refresh(ctx context.Context, id string) (domain.Session, error) {
	session, err := s.Get(id)
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
	session, err := s.Get(id)
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
	if err := s.terminals.Create(ctx, session.TmuxName(), session.Worktree, session.Agent.Command(), s.env(session)); err != nil {
		return domain.Session{}, err
	}
	session.Windows = []domain.Window{{Index: 0, Name: string(session.Agent), Agent: true}}
	return s.transition(session, domain.StateStarting, ""), nil
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
	session, err := s.Get(id)
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
	if changed {
		s.publisher.SessionChanged(session)
	}
	return session
}

// put stores a session and persists the map. A failed save is not worth
// failing a live session for: the map is a cache, and the control plane and
// tmux both still know the truth.
func (s *Service) put(session domain.Session) {
	s.mu.Lock()
	s.sessions[session.ID] = session
	snapshot := make([]domain.Session, 0, len(s.sessions))
	for _, item := range s.sessions {
		snapshot = append(snapshot, item)
	}
	s.mu.Unlock()
	if s.store != nil {
		_ = s.store.Save(snapshot)
	}
}

func nameOr(name, fallback string) string {
	if name != "" {
		return name
	}
	return fallback
}
