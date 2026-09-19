import { randomInt } from 'node:crypto';

/**
 * A project's slug is a **directory name** on every host that holds the
 * project (`product/11-workspace-layout.md`), so the rules for deriving one are
 * a domain policy rather than a formatting detail: two runner versions must
 * never disagree about what directory a project lives in.
 *
 * Pure by construction — a string in, a string out — so the collision cases
 * below are unit-testable without a database.
 */

/** Lower-case kebab: what a directory name may contain, and nothing else. */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Long enough for any repository name worth reading, short enough that the
 * derived paths stay well inside the filesystem's own limits.
 */
export const PROJECT_SLUG_MAX_LENGTH = 60;

/** Characters the random suffix is drawn from, and how many of them it takes. */
const SUFFIX_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export const PROJECT_SLUG_SUFFIX_LENGTH = 4;

/** What an unnameable repository falls back to, so the slug is never empty. */
const FALLBACK_SLUG = 'project';

/**
 * Sanitise a GitHub repository name into a slug.
 *
 * Accepts either `repo` or `owner/repo` and uses the last segment: the owner is
 * deliberately dropped, because the directory sits inside a workspace that
 * already answers "whose". The consequence is that `acme/xrp-mobile` and
 * `other/xrp-mobile` derive the *same* slug — which is a collision the caller
 * resolves with {@link withSuffix}, not something to design away by encoding the
 * owner into every path.
 */
export function projectSlugFromRepositoryName(repositoryName: string): string {
  const lastSegment = repositoryName.split('/').pop() ?? '';
  const slug = lastSegment
    .toLowerCase()
    // Anything that is not a directory-safe character becomes a separator;
    // GitHub admits `.`, `_` and `-`, and only the last of those survives.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROJECT_SLUG_MAX_LENGTH)
    // Truncation can land on a separator, which would leave a trailing dash.
    .replace(/-+$/g, '');

  return slug || FALLBACK_SLUG;
}

/**
 * The same slug with a short random suffix, for when the plain one is already
 * held by a project with a different origin.
 *
 * Random rather than a counter: a counter needs to know what is taken, which is
 * a read whose answer is stale the moment two creates race. The caller inserts
 * and retries instead, so the suffix only has to make a second collision
 * improbable.
 */
export function withSuffix(slug: string): string {
  const room = PROJECT_SLUG_MAX_LENGTH - PROJECT_SLUG_SUFFIX_LENGTH - 1;
  const base = slug.slice(0, room).replace(/-+$/g, '') || FALLBACK_SLUG;
  return `${base}-${randomSuffix()}`;
}

function randomSuffix(): string {
  let suffix = '';
  for (let index = 0; index < PROJECT_SLUG_SUFFIX_LENGTH; index += 1) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return suffix;
}
