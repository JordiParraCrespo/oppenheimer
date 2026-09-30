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
 * project names the same directory and branch
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). Both are functions of
 * rows the control plane holds, never of the filesystem, so two runner versions
 * cannot disagree and a path is never an identity (the UUID is).
 */

const BRANCH_NAMESPACE = 'oppenheimer';

/**
 * The working branch: always the session's own, created from each checkout's base,
 * never the base itself (git refuses a worktree on a branch another worktree holds,
 * so two sessions "on main" would fail at the second).
 *
 * `uq (organizationId, slug)` makes it collision-free inside a workspace and the
 * slug's random tail across workspaces sharing a repository: no pre-flight check
 * against GitHub, no race. A session created before this rule keeps the branch its
 * checkouts recorded (`oppenheimer/<project>/<session>`); nothing re-derives it.
 */
export function sessionBranchName(sessionSlug: string): string {
  return `${BRANCH_NAMESPACE}/${sessionSlug}`;
}

/**
 * A checkout's directory inside the session: the repository's own name, or
 * `<owner>--<repo>` when another checkout of this session already holds that name,
 * then `<owner>--<repo>-<githubRepoId>`.
 *
 * Every candidate derives from the repository, so a directory can always be read
 * back to what created it. A name is never reused inside a session
 * (`uq (sessionId, directoryName)` is the tombstone): the coding agents key
 * conversation state by working directory, so a checkout on a retired name would
 * inherit a stranger's history.
 */
export function checkoutDirectoryCandidates(repositoryFullName: string, githubRepoId: string) {
  const [owner, repo] = splitFullName(repositoryFullName);
  return [repo, `${owner}--${repo}`, `${owner}--${repo}-${githubRepoId}`];
}

/**
 * The first candidate no name in `taken` holds; `taken` is every directory name the
 * session has ever used, retired ones included.
 *
 * `null` when all three are taken, and the caller refuses. **It never reissues the
 * last one**: that would land a thrice re-added repository on a retired directory,
 * the inherited-conversation bug the tombstone prevents.
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
