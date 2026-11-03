package app

import (
	"strconv"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// WatchPull tells the control plane that a session's agent wants to be woken
// by a pull request's GitHub events (checks finishing, a review, a comment, a
// merge), or no longer does. The pull request is in one of the session's
// checkouts: repo names which (`owner/name`), or the first when it is empty.
// The control plane matches webhooks by GitHub's repository id, so a
// checkout with none (a session the CLI made) cannot be watched.
func (s *Service) WatchPull(id, repo string, number int, watch bool) (domain.PullWatch, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.PullWatch{}, err
	}
	if number < 1 {
		return domain.PullWatch{}, domain.ErrInvalidInput.WithDetail("a pull request's number is 1 or more, not %d", number)
	}
	checkouts := session.Checkouts()
	var checkout *domain.Checkout
	for i := range checkouts {
		if repo == "" || checkouts[i].Repo == repo {
			checkout = &checkouts[i]
			break
		}
	}
	if checkout == nil {
		if repo == "" {
			return domain.PullWatch{}, domain.ErrInvalidInput.WithDetail("this session has no repository checked out; a folder session cannot watch a pull request")
		}
		return domain.PullWatch{}, domain.ErrInvalidInput.WithDetail("this session has no checkout of %s", repo)
	}
	if checkout.GithubRepoID == 0 {
		return domain.PullWatch{}, domain.ErrInvalidInput.WithDetail("%s has no GitHub repository the control plane knows (a session made with the CLI)", checkout.Repo)
	}
	s.mu.Lock()
	watcher, ok := s.publisher.(PullWatcher)
	s.mu.Unlock()
	if !ok {
		return domain.PullWatch{}, domain.ErrNoLink.WithDetail("nothing can wake this session without one")
	}
	w := domain.PullWatch{GithubRepoID: strconv.FormatInt(checkout.GithubRepoID, 10), Number: number, Watch: watch}
	watcher.PullWatched(session.ID, w)
	return w, nil
}
