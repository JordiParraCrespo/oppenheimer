/**
 * A project's slug: its stable handle, derived from the name a person gave it,
 * once, at creation, and never again.
 *
 * A project is metadata; nothing on a host is named after it
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). The slug is kept
 * lower-case kebab so it can sit in a URL, unique in its workspace for ever
 * (archiving keeps it), and derived deterministically:
 *
 * 1. `<name>` sanitised;
 * 2. `<name>-<first 8 hex of the project's UUID>` — the id is minted before the
 *    insert, so the fallback is derived from the row itself and cannot collide
 *    in practice.
 *
 * Pure by construction — strings in, strings out.
 */

/** Lower-case kebab. */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Long enough for any name worth reading. */
export const PROJECT_SLUG_MAX_LENGTH = 60;

/** What an unnameable name falls back to, so a slug is never empty. */
const FALLBACK_SLUG = 'project';

/** Sanitise: lower-case, URL-safe, no leading, trailing or doubled dash. */
function sanitise(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Cut a slug to the length limit without leaving it ending in a separator. */
function bounded(slug: string): string {
  return slug.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/g, '') || FALLBACK_SLUG;
}

/** The slug a name gets when nothing is in the way. */
export function projectSlugFromName(name: string): string {
  return bounded(sanitise(name));
}

/** The slugs to try for a new project, in order, each derived from the project itself. */
export function projectSlugCandidates(name: string, projectId: string): string[] {
  const base = projectSlugFromName(name);
  const suffix = projectId.replace(/-/g, '').slice(0, 8).toLowerCase() || '0';
  const room = PROJECT_SLUG_MAX_LENGTH - suffix.length - 1;
  const unique = `${base.slice(0, room).replace(/-+$/g, '') || FALLBACK_SLUG}-${suffix}`;
  return [...new Set([base, unique])];
}
