/**
 * A project's slug is a **directory name** on every host that holds the project
 * (`product/11-workspace-layout.md`), so deriving one is a domain rule rather
 * than a formatting detail: two runner versions must never disagree about which
 * directory a project lives in.
 *
 * Every candidate is **derived from the repository**, in a fixed order, so the
 * directory can always be read back from the repository it came from:
 *
 * 1. `<repo>` — the repository's own name, sanitised;
 * 2. `<owner>--<repo>` — the collision rule `11` already wrote, for when the
 *    plain name is held by a project with a different origin;
 * 3. `<owner>--<repo>-<githubRepoId>` — GitHub's id is unique by construction,
 *    so the list cannot run out.
 *
 * Nothing here is random. A random suffix would make the path unguessable from
 * the repository and would need a retry loop with a failure case of its own.
 *
 * Pure by construction — strings in, strings out.
 */

/** Lower-case kebab, with `--` admitted because rule 2 uses it as a separator. */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-{1,2}[a-z0-9]+)*$/;

/**
 * Long enough for any repository name worth reading, short enough that the
 * derived paths stay well inside the filesystem's own limits.
 */
export const PROJECT_SLUG_MAX_LENGTH = 60;

/** What an unnameable repository falls back to, so a slug is never empty. */
const FALLBACK_SLUG = 'project';

/** The repository a project's directory name is derived from. */
export interface ProjectSlugSource {
  /** GitHub's owner login — the `acme` of `acme/xrp-mobile`. */
  owner: string;
  /** The repository name on its own, without the owner. */
  name: string;
  /** GitHub's numeric repository id, as the driver exchanges it. */
  githubRepoId: string;
}

/** Sanitise one segment: lower-case, directory-safe, no leading or trailing dash. */
function sanitise(segment: string): string {
  return (
    segment
      .toLowerCase()
      // GitHub admits `.`, `_` and `-` in a name; only the last is a directory
      // name, so everything else folds into a separator.
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/** Cut a slug to the length limit without leaving it ending in a separator. */
function bounded(slug: string): string {
  return slug.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/g, '') || FALLBACK_SLUG;
}

/**
 * The slug a repository gets when nothing is in the way: its own name.
 */
export function projectSlugFromRepositoryName(name: string): string {
  return bounded(sanitise(name));
}

/**
 * The directory names to try for a repository, in order, each derived from it.
 *
 * Deduplicated, so a repository whose owner and name sanitise to the same thing
 * does not offer the same candidate twice.
 */
export function projectSlugCandidates(source: ProjectSlugSource): string[] {
  const name = projectSlugFromRepositoryName(source.name);
  const owner = sanitise(source.owner) || FALLBACK_SLUG;
  const qualified = bounded(`${owner}--${name}`);
  // The id goes on last and must survive the length cut, so the qualified part
  // is what gets shortened, never the id.
  const id = sanitise(source.githubRepoId) || '0';
  const room = PROJECT_SLUG_MAX_LENGTH - id.length - 1;
  const unique = `${qualified.slice(0, room).replace(/-+$/g, '') || FALLBACK_SLUG}-${id}`;

  return [...new Set([name, qualified, unique])];
}
