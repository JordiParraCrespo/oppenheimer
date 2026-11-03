package domain

// PullWatchedKind is the event kind a session's watch on a pull request (or
// its end) is logged as (`runner sessions watch-pr`,
// `product/next-steps/agent-tools.md` §3).
const PullWatchedKind = "pull.watched"

// PullWatch is one pull request a session's agent asked to be woken by, or
// stopped watching: its repository by GitHub's id, as the control plane
// matches a webhook, and its number.
type PullWatch struct {
	GithubRepoID string `json:"githubRepoId"`
	Number       int    `json:"number"`
	Watch        bool   `json:"watch"`
}
