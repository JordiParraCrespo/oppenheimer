/**
 * The two names a checkout takes on disk and in git, both derived and both
 * unique-constrained (`product/11-workspace-layout.md`,
 * `product/versions/mvp/03-control-plane.md`).
 *
 * ```
 * checkout  workspaces/<organization.slug>/projects/<project.slug>/sessions/<session.slug>/<directoryName>
 * branch    oppenheimer/<project.slug>/<session.slug>
 * ```
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
 * Both segments are unique-constrained — `uq (organizationId, slug)` on the
 * project and `uq (projectId, slug)` on the session — so a branch name is
 * self-identifying and collision-free by construction. Two sessions can never
 * want the same branch of the same repository, which needs no pre-flight check
 * against GitHub and has no race. It also sidesteps the hard git rule behind the
 * decision: git refuses to add a worktree on a branch another worktree already
 * has checked out, so two sessions "on main" would fail at the second.
 */
export function sessionBranchName(projectSlug: string, sessionSlug: string): string {
  return `${BRANCH_NAMESPACE}/${projectSlug}/${sessionSlug}`;
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
 */
export function checkoutDirectoryName(
  repositoryFullName: string,
  githubRepoId: string,
  taken: Iterable<string>,
): string {
  const used = new Set(taken);
  const candidates = checkoutDirectoryCandidates(repositoryFullName, githubRepoId);
  return candidates.find((candidate) => !used.has(candidate)) ?? candidates[candidates.length - 1];
}

/** `owner/repo` as GitHub spells it, tolerant of a name with no owner in it. */
export function splitFullName(repositoryFullName: string): [owner: string, repo: string] {
  const slash = repositoryFullName.lastIndexOf('/');
  if (slash <= 0) return ['', repositoryFullName];
  return [repositoryFullName.slice(0, slash), repositoryFullName.slice(slash + 1)];
}
