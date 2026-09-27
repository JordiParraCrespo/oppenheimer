/**
 * The two names a checkout takes on disk and in git, both derived and both
 * unique-constrained (`product/11-workspace-layout.md`,
 * `product/versions/mvp/03-control-plane.md`).
 *
 * ```
 * checkout  workspaces/<organization.slug>/sessions/<session.slug>/<directoryName>
 * branch    oppenheimer/<session.slug>
 * ```
 *
 * No project in either: a project is metadata, so a session listed under another
 * project names the same directory and the same branch
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Nothing here asks the filesystem anything. Both names are functions of rows the
 * control plane already holds, so two runner versions cannot disagree about them
 * and a path is never an identity — identity is the UUID, and the path is a
 * derived attribute.
 */

/** The prefix every branch this product creates lives under. */
const BRANCH_NAMESPACE = 'oppenheimer';

/**
 * The working branch: always the session's own, created from each checkout's
 * base and never the base itself.
 *
 * `uq (organizationId, slug)` on the session makes it collision-free inside a
 * workspace, and the slug's random tail makes it so across workspaces sharing a
 * repository. Two sessions can never want the same branch, which needs no
 * pre-flight check against GitHub and has no race — and git refuses a worktree
 * on a branch another worktree already holds, so two sessions "on main" would
 * fail at the second.
 *
 * A session created before this rule keeps the branch its checkouts recorded
 * (`oppenheimer/<project>/<session>`); nothing re-derives a branch that exists.
 */
export function sessionBranchName(sessionSlug: string): string {
  return `${BRANCH_NAMESPACE}/${sessionSlug}`;
}

/**
 * A checkout's directory inside the session: the repository's own name, or
 * `<owner>--<repo>` when another checkout of this session already holds that
 * name, then `<owner>--<repo>-<githubRepoId>`.
 *
 * Deterministic, like the project's own candidates: every one is derived from the
 * repository, so the directory can always be read back to what created it, and
 * the list cannot be exhausted because the last candidate carries GitHub's id. A
 * name is never reused inside a session — `uq (sessionId, directoryName)` is the
 * tombstone — because the coding agents key their conversation state by working
 * directory, so a new checkout landing on a retired name would inherit a
 * stranger's history.
 */
export function checkoutDirectoryCandidates(repositoryFullName: string, githubRepoId: string) {
  const [owner, repo] = splitFullName(repositoryFullName);
  return [repo, `${owner}--${repo}`, `${owner}--${repo}-${githubRepoId}`];
}

/**
 * Pick the first candidate no name in `taken` holds. `taken` is every directory
 * name the session has ever used, including retired ones.
 *
 * `null` when all three are taken, and the caller refuses. **It never reissues the
 * last one.** A session that added, retired and re-added the same repository through
 * all three names would otherwise land on a retired directory, which is exactly the
 * inherited-conversation bug the tombstone exists to prevent — and the caller
 * refusing is a sentence somebody can read, where a silent reuse is a stranger's
 * history in a fresh agent.
 */
export function checkoutDirectoryName(
  repositoryFullName: string,
  githubRepoId: string,
  taken: Iterable<string>,
): string | null {
  const used = new Set(taken);
  const candidates = checkoutDirectoryCandidates(repositoryFullName, githubRepoId);
  return candidates.find((candidate) => !used.has(candidate)) ?? null;
}

/** `owner/repo` as GitHub spells it, tolerant of a name with no owner in it. */
export function splitFullName(repositoryFullName: string): [owner: string, repo: string] {
  const slash = repositoryFullName.lastIndexOf('/');
  if (slash <= 0) return ['', repositoryFullName];
  return [repositoryFullName.slice(0, slash), repositoryFullName.slice(slash + 1)];
}
