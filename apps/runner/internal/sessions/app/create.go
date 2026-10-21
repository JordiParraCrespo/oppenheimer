package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Opening a session: what a create takes, the stages it walks, the files of
// its first task, and how a create redelivered for the same id joins the one
// already running. What differs by where the session runs is places.go's.

// CreateInput is what opening a session takes, from the link or the CLI.
type CreateInput struct {
	// ID is the control plane's session id when the create arrives over the
	// link, so an attach that names it finds it; the CLI leaves it empty and
	// one is minted.
	ID string
	// Folder, set, makes a folder session (24 §3): the agent starts in this
	// folder, which must already be a directory on the host, and nothing is
	// cloned, cut or written. Repo, Remote, the branches, the checkout and
	// Tenant are then left empty.
	Folder string
	// Tenant is the account and workspace whose work folder levels the
	// session's folder and its store sit under; zero is domain.LocalTenant,
	// what a session the CLI makes uses.
	Tenant domain.Tenant
	// WorkspaceSlug is the workspace's slug, recorded in its folder's marker
	// for a person reading the work folder; the folder is named by the id.
	WorkspaceSlug string
	// Slug names the session's folder, `sessions/<slug>`; empty derives one
	// from the branch and the id.
	Slug string
	// Directory names the checkout inside the session's folder; empty is the
	// repository's own name.
	Directory string
	Repo      string
	// Remote is where the store is fetched from. The control plane supplies
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
	// Files are the files attached to the first task, already pulled.
	// Each is saved outside the worktree just before the agent starts, and
	// its path appended to the prompt the agent is launched with.
	Files []CreateFile
	// Progress, when set, hears each stage start and land, in order, with the
	// session as it stands at each. StageTerminal landing is what says the
	// session has a pane to attach to. It must not block.
	Progress func(domain.StageEvent)
}

// CreateFile is one file attached to a session's first task.
type CreateFile struct {
	// ID names the file on disk, so it is a plain name: the control plane's
	// file id, checked at the link.
	ID        string
	MediaType string
	Data      []byte
}

// Create makes a session. A worktree session gets its folder, its store, its
// worktree, a tmux session and the agent in window 0; a folder session only
// the tmux session and the agent, in a folder that is already there. Each
// step is observable on disk, so a failure half-way leaves something a person
// can look at rather than a mystery.
func (s *Service) Create(ctx context.Context, in CreateInput) (domain.Session, error) {
	// Whatever effort arrives now is a level of the CLI's own; say so on the
	// launch that is saved, so a restart can tell it from an older stop.
	in.Launch.EffortIsLevel = true
	if err := s.terminals.Available(ctx); err != nil {
		return domain.Session{}, err
	}
	agent := in.Agent
	if agent == "" {
		agent = domain.AgentClaude
	}
	if !agent.Valid() {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v: %q", domain.ErrUnknownAgent, agent)
	}
	if err := s.checkFiles(in.Files, in.Launch.Prompt); err != nil {
		return domain.Session{}, err
	}
	id := in.ID
	if id == "" {
		minted, err := domain.NewID()
		if err != nil {
			return domain.Session{}, domain.ErrInvalidInput.WithDetail("generate a session id: %v", err).WithCause(err)
		}
		id = minted
	}

	session, err := s.sessionFor(id, in)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now().UTC()
	session.ID, session.Agent, session.Launch = id, agent, in.Launch
	session.State, session.Created, session.Updated = domain.StateCreating, now, now
	session.Windows = []domain.Window{{Index: 0, Name: string(agent), Agent: true}}
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

// stageRunner runs one stage of a create, reporting it started, then landed
// or failed: the one shape a stage can have.
type stageRunner func(start domain.StageEvent, fn func() error) error

// create walks the stages. What a failed stage leaves on disk is taken over
// by the next attempt for the same session (Places.MakeSession,
// Worktrees.Add). A folder session has no clone and no worktree stage.
func (s *Service) create(ctx context.Context, in CreateInput, session domain.Session) (domain.Session, error) {
	// Every stage runs through run, so "started, then landed or failed" is
	// the one shape a stage can have, and a new stage cannot report half of it.
	run := stageRunner(func(start domain.StageEvent, fn func() error) error {
		stage, started := start.Stage, s.now()
		if in.Progress != nil {
			start.Session = session.Clone()
			in.Progress(start)
		}
		if err := fn(); err != nil {
			return err
		}
		if in.Progress != nil {
			in.Progress(domain.StageEvent{
				Stage: stage, Done: true, Took: s.now().Sub(started), Session: session.Clone(),
			})
		}
		return nil
	})

	// The terminal comes first, before the repository exists. A create spends
	// its seconds on the clone and the worktree, and every one of them used to
	// be a spinner: the pane was made last, so there was nothing to look at
	// until everything was done. Made first, the reader is in the session at
	// once and watches it being built, which is the whole difference between
	// waiting and working.
	//
	// It starts in the session's folder, which holds the checkout once it is
	// made — the checkout itself is not there yet. Once it is, the pane's
	// shell is replaced by the agent started in the checkout
	// (Terminals.Launch), so nothing typed to start it is ever on the screen.
	if err := run(domain.StageEvent{Stage: domain.StageTerminal}, func() error {
		dir, err := s.makeRoom(in, session)
		if err != nil {
			return err
		}
		return s.terminals.Create(ctx, session.TmuxName(), dir, "", s.env(session))
	}); err != nil {
		return domain.Session{}, err
	}
	// A stage that fails from here leaves no pane behind: the session never
	// became one, and a terminal nothing is running in is not a session.
	abandon := func(err error) (domain.Session, error) {
		_ = s.terminals.Kill(context.WithoutCancel(ctx), session.TmuxName())
		return domain.Session{}, err
	}
	// The pane exists, so an attach waiting on it may go. Nothing else changes:
	// the create holds its lane to the end, so a stop, a list or an unpair
	// still see the session only once it has landed.
	s.paneReady(session)

	if err := s.checkout(ctx, in, session, run); err != nil {
		return abandon(err)
	}
	session.State = domain.StateStarting
	if err := run(domain.StageEvent{Stage: domain.StageAgent}, func() error {
		launch, err := s.saveFiles(session.ID, in)
		if err != nil {
			return err
		}
		s.trustFolder(session.Agent, session.Cwd())
		defer s.holdLaunch(ctx, session.Agent)()
		if err := s.terminals.Launch(ctx, session.Target(0), session.Cwd(), launch.CommandLine(session.Agent)); err != nil {
			s.discardFiles(session.ID)
			return err
		}
		return nil
	}); err != nil {
		// Leave the worktree and its folder: they are on disk, the work in
		// them is the user's, and a half-created session they can see beats
		// one that vanished.
		return abandon(err)
	}
	return session, nil
}

// checkFiles refuses a first task's files before anything is made: too
// many, a type a session does not take, or bytes that are not the type they
// claim (domain.FileIs: magic bytes, or text that is only text). A create
// that would launch the task without its files is refused rather than
// started, since the task talks about them.
func (s *Service) checkFiles(files []CreateFile, prompt string) error {
	if len(files) == 0 {
		return nil
	}
	if s.files == nil {
		return domain.ErrFile.WithDetail("this runner keeps no files")
	}
	if prompt == "" {
		return domain.ErrInvalidInput.WithDetail("attached files ride a first task, and this create has none")
	}
	if len(files) > domain.CreateMaxFiles {
		return domain.ErrInvalidInput.WithDetail("a first task carries at most %d files; this one carried %d", domain.CreateMaxFiles, len(files))
	}
	for _, file := range files {
		if _, ok := domain.FileExtension(file.MediaType); !ok {
			return domain.ErrFile.WithDetail("%q is not a type a session takes", file.MediaType)
		}
		if !domain.FileIs(file.Data, file.MediaType) {
			return domain.ErrFile.WithDetail("the bytes are not %s", file.MediaType)
		}
	}
	return nil
}

// saveFiles writes the first task's files where pasted ones go and returns
// the launch that names them. Only the command line gets the paths:
// session.Launch keeps the task as typed, so a restart, by which time the
// files have been discarded with the tmux session, names no file that is gone.
func (s *Service) saveFiles(id string, in CreateInput) (domain.Launch, error) {
	launch := in.Launch
	if len(in.Files) == 0 {
		return launch, nil
	}
	paths := make([]string, 0, len(in.Files))
	for _, file := range in.Files {
		ext, _ := domain.FileExtension(file.MediaType)
		path, err := s.files.Save(id, file.ID+ext, file.Data)
		if err != nil {
			s.discardFiles(id)
			return launch, domain.ErrFile.WithDetail("write the file: %v", err).WithCause(err)
		}
		paths = append(paths, path)
	}
	launch.Prompt = domain.PromptWithFiles(launch.Prompt, paths)
	return launch, nil
}

type creation struct {
	session domain.Session
	done    chan struct{}
	result  domain.Session
	err     error
	// pane is closed once the session's tmux session exists, which is well
	// before the create lands: the terminal is made before the clone runs. An
	// attach waits on it; nothing else does.
	pane chan struct{}
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
	c = &creation{session: session, done: make(chan struct{}), pane: make(chan struct{})}
	s.creating[session.ID] = c
	return c, true, nil
}

// paneReady releases the attaches waiting on this session's terminal: its tmux
// session exists, whatever the clone behind it is still doing. It also
// refreshes the copy the creation holds, so what an attach reads is the
// session as it is.
func (s *Service) paneReady(session domain.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, creating := s.creating[session.ID]
	if !creating {
		return
	}
	c.session = session
	select {
	case <-c.pane:
	default:
		close(c.pane)
	}
}

// awaitAttachable is the session an attach may use, waiting if the host is
// still making its terminal.
//
// This is the one command a session being created can serve, and waiting is
// what makes that true without a second notion of "recorded". The terminal is
// built before the clone, so an attach sent the moment the console hears about
// the session arrives while the create is still running: refusing it would
// send the browser into its reconnect ladder to wait out a clone its terminal
// never depended on, and queueing it behind the create would do the same thing
// more quietly.
//
// Only an attach waits here. Stop, List and the rest still ask for a recorded
// session, so a create that has not landed is still not a session to act on.
func (s *Service) awaitAttachable(ctx context.Context, id string) (domain.Session, error) {
	s.mu.Lock()
	if recorded, ok := s.sessions[id]; ok {
		session := recorded.Clone()
		s.mu.Unlock()
		if !session.State.Live() {
			return domain.Session{}, domain.ErrNotRunning.WithDetail(
				"session %s is %s; restart it to attach", id, session.State)
		}
		return session, nil
	}
	c, creating := s.creating[id]
	s.mu.Unlock()
	if !creating {
		return domain.Session{}, domain.ErrNotFound.WithDetail("no session %q on this host", id)
	}

	select {
	case <-c.pane:
	case <-c.done:
	case <-ctx.Done():
		return domain.Session{}, domain.ErrNotRunning.WithDetail(
			"session %q was still being created when the attach gave up", id)
	}

	// The create may have landed while waiting, so the record is asked first:
	// it is the session as it finally stands. A create that ended without ever
	// making a pane leaves neither, and that is a refusal.
	s.mu.Lock()
	defer s.mu.Unlock()
	if recorded, ok := s.sessions[id]; ok {
		session := recorded.Clone()
		if !session.State.Live() {
			return domain.Session{}, domain.ErrNotRunning.WithDetail(
				"session %s is %s; restart it to attach", id, session.State)
		}
		return session, nil
	}
	select {
	case <-c.pane:
		return c.session.Clone(), nil
	default:
		return domain.Session{}, domain.ErrNotRunning.WithDetail(
			"session %q never got a terminal", id)
	}
}

// end records a create's outcome — the session, when it landed — and wakes
// every create that joined it. The record is written before the pending entry
// goes, so Get never finds neither.
func (s *Service) end(c *creation, session domain.Session, err error) {
	if err == nil {
		s.record(session)
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
