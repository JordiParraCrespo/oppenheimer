package app

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

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
// its paths in the work folder derived. Nothing is made yet. Each checkout
// is a worktree in the session's folder on the session's one branch, so two
// that would share a directory, or check out one repository twice, are
// refused: the second would land on the first, or on its branch.
func (s *Service) worktreeSession(id string, in CreateInput) (domain.Session, error) {
	invalid := func(err error) (domain.Session, error) {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
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
	dir := s.layout.Session(tenant, slug)
	checkouts := make([]domain.Checkout, 0, 1+len(in.More))
	directories, repos := map[string]string{}, map[string]bool{}
	for _, c := range in.checkouts() {
		if err := domain.ValidateRepo(c.Repo); err != nil {
			return invalid(err)
		}
		base := c.base()
		if err := domain.ValidateBranch(base); err != nil {
			return invalid(err)
		}
		directory := c.Directory
		if directory == "" {
			directory = domain.DirectoryOf(c.Repo)
		}
		if err := domain.ValidateName(directory); err != nil {
			return invalid(fmt.Errorf("checkout: %w", err))
		}
		// Folded, because a Mac's disk does not tell `api` from `API`, and
		// GitHub does not tell `Acme/api` from `acme/api`.
		if other, taken := directories[strings.ToLower(directory)]; taken {
			return domain.Session{}, domain.ErrInvalidInput.WithDetail(
				"%s and %s would both be checked out at %q", other, c.Repo, directory)
		}
		if repos[strings.ToLower(c.Repo)] {
			return domain.Session{}, domain.ErrInvalidInput.WithDetail(
				"%s is checked out twice; a session holds each repository once", c.Repo)
		}
		directories[strings.ToLower(directory)], repos[strings.ToLower(c.Repo)] = c.Repo, true
		checkouts = append(checkouts, domain.Checkout{
			Repo: c.Repo, BaseBranch: base, Worktree: filepath.Join(dir, directory),
			CheckoutID: c.CheckoutID, GithubRepoID: c.GithubRepoID,
		})
	}
	first := checkouts[0]
	session := domain.Session{
		Name: nameOr(in.Name, branch), Place: domain.PlaceWorktree,
		AccountID: tenant.Account, WorkspaceID: tenant.Workspace, Dir: dir,
		Repo: first.Repo, BaseBranch: first.BaseBranch, Branch: branch, Worktree: first.Worktree,
		CheckoutID: first.CheckoutID, GithubRepoID: first.GithubRepoID,
	}
	if len(checkouts) > 1 {
		session.More = checkouts[1:]
	}
	return session, nil
}

// folderSession is what a folder session will be: its folder an existing
// directory, and nothing of a repository about it.
func (s *Service) folderSession(in CreateInput) (domain.Session, error) {
	if in.Repo != "" || in.Branch != "" || in.CheckoutID != "" || len(in.More) > 0 {
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

// base is the branch a new session's branch is cut from in this checkout.
func (c CheckoutInput) base() string {
	if c.BaseBranch == "" {
		return "main"
	}
	return c.BaseBranch
}

// fetchRef is the one branch a create fetches for a checkout: the one its
// worktree is made from, which is the existing branch it checks out or the
// base it cuts from.
func (in CreateInput) fetchRef(c CheckoutInput) string {
	if in.Existing {
		return in.Branch
	}
	return c.base()
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

// checkout runs the stages only a worktree session has: its stores cloned
// or fetched, then its worktrees added. A folder session has neither. A
// session over several repositories still walks each stage once, every
// repository in turn inside it, so the console's stepper reads the same
// `clone, worktree` whatever the count.
func (s *Service) checkout(ctx context.Context, in CreateInput, session domain.Session, run stageRunner) error {
	if session.Place != domain.PlaceWorktree {
		return nil
	}
	inputs, checkouts := in.checkouts(), session.Checkouts()
	// A repository this host has never held is downloaded, which is the one
	// stage that can take tens of seconds; the reader is told so.
	download := false
	for _, checkout := range checkouts {
		download = download || !s.worktrees.Has(session.RepositoryOf(checkout))
	}
	if err := run(domain.StageEvent{Stage: domain.StageClone, Download: download}, func() error {
		for i, checkout := range checkouts {
			if err := s.worktrees.Ensure(ctx, session.RepositoryOf(checkout), inputs[i].Remote, in.fetchRef(inputs[i])); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	return run(domain.StageEvent{Stage: domain.StageWorktree}, func() error {
		for _, checkout := range checkouts {
			if err := s.worktrees.Add(ctx, session.RepositoryOf(checkout), checkout.Worktree,
				session.Branch, checkout.BaseBranch, !in.Existing); err != nil {
				return err
			}
		}
		return nil
	})
}

// closePlace is the rest of a Close once the terminal is gone. A folder
// session is closed and nothing else: its folder is the person's. A worktree
// session's branch is pushed from every checkout if asked, and its worktrees
// and folder removed unless one of them holds work that would be lost — and
// then all of them are kept, because the session is one piece of work and
// half of it removed is not something a person can pick back up.
func (s *Service) closePlace(ctx context.Context, session domain.Session, in CloseInput) (domain.Session, error) {
	if session.Place == domain.PlaceFolder {
		return s.decide(session, domain.StateClosed, ""), nil
	}
	checkouts := session.Checkouts()
	var (
		reasons []string
		kept    []string
		pushErr error
	)
	// What the worktrees say now replaces what was recorded, unless one of
	// them could not be asked: then what was recorded stands.
	dirty, asked := false, true
	for _, checkout := range checkouts {
		kept = append(kept, checkout.Worktree)
		changed, err := s.worktrees.Dirty(ctx, checkout.Worktree)
		asked = asked && err == nil
		if err == nil && changed {
			dirty = true
			reasons = append(reasons, checkout.Worktree+" has uncommitted changes")
		}
	}
	session.Dirty = dirty || (!asked && session.Dirty)
	for _, checkout := range checkouts {
		if in.Push {
			if _, err := s.worktrees.Push(ctx, checkout.Worktree, session.Branch); err != nil {
				// Report and keep going: the session is over either way, and
				// the branch is still in the worktree we are about to name.
				session.Dirty = true
				pushErr = errors.Join(pushErr, err)
				reasons = append(reasons, "the branch could not be pushed from "+checkout.Worktree)
			}
		}
	}
	if session.Dirty && !in.Force {
		session = s.decide(session, domain.StateStopped, "")
		return session, domain.ErrPushRejected.WithDetail("%s", keptDetail(len(checkouts), pushErr != nil, reasons, kept)).
			WithCause(pushErr)
	}
	for _, checkout := range checkouts {
		if err := s.worktrees.Remove(ctx, session.RepositoryOf(checkout), checkout.Worktree, in.Force); err != nil {
			return session, err
		}
	}
	s.removeDir(session)
	return s.decide(session, domain.StateClosed, ""), nil
}

// keptDetail says why a close kept a session's worktrees and where they are.
// A session of one checkout says it the way it always has.
func keptDetail(count int, pushFailed bool, reasons, kept []string) string {
	if count == 1 {
		if pushFailed {
			return "the branch could not be pushed, so the worktree was kept at " + kept[0]
		}
		return "the worktree has uncommitted changes and was kept at " + kept[0]
	}
	return strings.Join(reasons, "; ") + ", so every worktree was kept: " + strings.Join(kept, ", ")
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
		// The first checkout is what says the session is still there, so with
		// it gone the session is over. Only what was deleted by hand is pruned:
		// for those only git's record is left, and a prune that fails leaves
		// nothing a person needs. A checkout still on disk may hold edits or
		// commits nobody pushed, and nothing here asked to push or to throw
		// them away, so it stays where it is, with the folder that holds it.
		kept := false
		for _, checkout := range session.Checkouts() {
			if s.worktrees.Exists(checkout.Worktree) {
				kept = true
				continue
			}
			_ = s.worktrees.Remove(ctx, session.RepositoryOf(checkout), checkout.Worktree, true)
		}
		if !kept {
			s.removeDir(session)
		}
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
