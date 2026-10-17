package app

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Where a session runs (24 §3). A worktree session gets a folder of the
// runner's own in the work folder, a store and a checkout cut on its own
// branch; a folder session runs in a folder already on the host, which is the
// person's and is never written, checked out, pushed or removed. Every step
// of the lifecycle that differs by place asks here, so Create, Close and gone
// read as one path with a dispatch.

// sessionFor is what the session will be, by place: its names checked and its
// paths derived. Nothing is made yet.
func (s *Service) sessionFor(id string, in CreateInput) (domain.Session, error) {
	if in.Folder != "" {
		return s.folderSession(in)
	}
	return s.worktreeSession(id, in)
}

// worktreeSession is what a worktree session will be: its names checked and
// its paths in the work folder derived. Nothing is made yet.
func (s *Service) worktreeSession(id string, in CreateInput) (domain.Session, error) {
	invalid := func(err error) (domain.Session, error) {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}
	if err := domain.ValidateRepo(in.Repo); err != nil {
		return invalid(err)
	}
	base := in.base()
	if err := domain.ValidateBranch(base); err != nil {
		return invalid(err)
	}
	branch := in.Branch
	if branch == "" {
		branch = domain.DefaultBranchName(id)
	}
	if err := domain.ValidateBranch(branch); err != nil {
		return invalid(err)
	}
	tenant := in.Tenant
	if tenant == (domain.Tenant{}) {
		tenant = domain.LocalTenant
	}
	if err := tenant.Validate(); err != nil {
		return invalid(err)
	}
	slug := in.Slug
	if slug == "" {
		slug = domain.Slug(branch, id)
	}
	if err := domain.ValidateName(slug); err != nil {
		return invalid(fmt.Errorf("session folder: %w", err))
	}
	directory := in.Directory
	if directory == "" {
		directory = domain.DirectoryOf(in.Repo)
	}
	if err := domain.ValidateName(directory); err != nil {
		return invalid(fmt.Errorf("checkout: %w", err))
	}
	dir := s.layout.Session(tenant, slug)
	return domain.Session{
		Name: nameOr(in.Name, branch), Place: domain.PlaceWorktree,
		AccountID: tenant.Account, WorkspaceID: tenant.Workspace, Dir: dir,
		Repo: in.Repo, BaseBranch: base, Branch: branch, Worktree: filepath.Join(dir, directory),
		CheckoutID: in.CheckoutID, GithubRepoID: in.GithubRepoID,
	}, nil
}

// folderSession is what a folder session will be: its folder an existing
// directory, and nothing of a repository about it.
func (s *Service) folderSession(in CreateInput) (domain.Session, error) {
	if in.Repo != "" || in.Branch != "" || in.CheckoutID != "" {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail(
			"a session runs in a folder or in a checkout, never both")
	}
	if !filepath.IsAbs(in.Folder) {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("the folder %q is not an absolute path", in.Folder)
	}
	folder := filepath.Clean(in.Folder)
	if err := s.checkFolder(folder); err != nil {
		return domain.Session{}, err
	}
	return domain.Session{
		Name: nameOr(in.Name, filepath.Base(folder)), Place: domain.PlaceFolder, Folder: folder,
	}, nil
}

// checkFolder maps what Places saw at a folder session's folder onto the
// catalog.
func (s *Service) checkFolder(folder string) error {
	err := s.places.CheckFolder(folder)
	switch {
	case err == nil:
		return nil
	case errors.Is(err, domain.ErrNoSuchFolder):
		return domain.ErrFolderMissing.WithDetail("%s does not exist on this host", folder).WithCause(err)
	case errors.Is(err, domain.ErrNotADirectory):
		return domain.ErrFolderNotDirectory.WithDetail("%s is not a directory", folder).WithCause(err)
	}
	return domain.ErrFolderMissing.WithDetail("%s cannot be used: %v", folder, err).WithCause(err)
}

// base is the branch a new session's branch is cut from.
func (in CreateInput) base() string {
	if in.BaseBranch == "" {
		return "main"
	}
	return in.BaseBranch
}

// fetchRef is the one branch a create fetches: the one its worktree is made
// from, which is the existing branch it checks out or the base it cuts from.
func (in CreateInput) fetchRef() string {
	if in.Existing {
		return in.Branch
	}
	return in.base()
}

// makeRoom makes what the session's terminal starts in and answers its path.
// A worktree session's folder in the work folder is made, marker first,
// before anything else is: a folder the runner may delete later always says
// whose it is. A folder session's folder is already there.
func (s *Service) makeRoom(in CreateInput, session domain.Session) (string, error) {
	if session.Place == domain.PlaceFolder {
		return session.Folder, nil
	}
	if err := s.places.MakeSession(domain.SessionFolder{
		Dir: session.Dir, SessionID: session.ID, Created: session.Created,
		Tenant:        domain.Tenant{Account: session.AccountID, Workspace: session.WorkspaceID},
		WorkspaceSlug: in.WorkspaceSlug,
	}); err != nil {
		return "", err
	}
	return session.Dir, nil
}

// checkout runs the stages only a worktree session has: its store cloned or
// fetched, then its worktree added. A folder session has neither.
func (s *Service) checkout(ctx context.Context, in CreateInput, session domain.Session, run stageRunner) error {
	if session.Place != domain.PlaceWorktree {
		return nil
	}
	repo := session.Repository()
	// A repository this host has never held is downloaded, which is the one
	// stage that can take tens of seconds; the reader is told so.
	download := !s.worktrees.Has(repo)
	if err := run(domain.StageEvent{Stage: domain.StageClone, Download: download}, func() error {
		return s.worktrees.Ensure(ctx, repo, in.Remote, in.fetchRef())
	}); err != nil {
		return err
	}
	return run(domain.StageEvent{Stage: domain.StageWorktree}, func() error {
		return s.worktrees.Add(ctx, repo, session.Worktree, session.Branch, session.BaseBranch, !in.Existing)
	})
}

// closePlace is the rest of a Close once the terminal is gone. A folder
// session is closed and nothing else: its folder is the person's. A worktree
// session's branch is pushed if asked, and its worktree and folder removed
// unless they hold work that would be lost.
func (s *Service) closePlace(ctx context.Context, session domain.Session, in CloseInput) (domain.Session, error) {
	if session.Place == domain.PlaceFolder {
		return s.decide(session, domain.StateClosed, ""), nil
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
		session = s.decide(session, domain.StateStopped, "")
		detail := "the worktree has uncommitted changes and was kept at " + session.Worktree
		if pushErr != nil {
			detail = "the branch could not be pushed, so the worktree was kept at " + session.Worktree
		}
		return session, domain.ErrPushRejected.WithDetail("%s", detail).WithCause(pushErr)
	}
	if err := s.worktrees.Remove(ctx, session.Repository(), session.Worktree, in.Force); err != nil {
		return session, err
	}
	s.removeDir(session)
	return s.decide(session, domain.StateClosed, ""), nil
}

// removeDir deletes a closed worktree session's folder, which Places does
// only when the folder's marker names this session. What is left there is
// the runner's own (the marker) or something a person put in it; a removal
// that fails leaves it for them, and the session is closed either way.
func (s *Service) removeDir(session domain.Session) {
	if session.Dir == "" || s.places == nil {
		return
	}
	_ = s.places.RemoveSession(session.Dir, session.ID)
}

// placeGone closes a session whose place someone deleted from the host: a
// folder session's folder, or a worktree session's worktree. over is false,
// and the session handed back, when its place is still there.
func (s *Service) placeGone(ctx context.Context, session domain.Session) (_ domain.Session, over bool, err error) {
	switch {
	case session.Place == domain.PlaceFolder && s.folderGone(session.Folder):
		if err := s.terminals.Kill(ctx, session.TmuxName()); err != nil {
			return domain.Session{}, false, err
		}
		return s.decide(session, domain.StateClosed, ""), true, nil
	case session.Place == domain.PlaceWorktree && session.Worktree != "" && !s.worktrees.Exists(session.Worktree):
		if err := s.terminals.Kill(ctx, session.TmuxName()); err != nil {
			return domain.Session{}, false, err
		}
		// Only git's record of the worktree is left, and a prune that fails
		// leaves nothing a person needs: the session is over either way.
		_ = s.worktrees.Remove(ctx, session.Repository(), session.Worktree, true)
		s.removeDir(session)
		return s.decide(session, domain.StateClosed, ""), true, nil
	}
	return session, false, nil
}

// folderGone reports a folder session's folder no longer there to run in.
func (s *Service) folderGone(folder string) bool {
	err := s.places.CheckFolder(folder)
	return errors.Is(err, domain.ErrNoSuchFolder) || errors.Is(err, domain.ErrNotADirectory)
}

func nameOr(name, fallback string) string {
	if name != "" {
		return name
	}
	return fallback
}
