/**
 * A view narrowed to projects by slug in its address, comma-separated:
 * `?project=web,billing`, `unassigned` for the workspace's Unassigned
 * project. A slug is lower-case kebab, so a comma never sits inside one.
 * Plan's board, Milestones and the calendar read it the same way, so a link
 * narrows each alike.
 */
export const UNASSIGNED_SLUG = 'unassigned';

/** The slugs `?project=` lists, each once, in the order they were picked. */
export function projectSlugsOf(param: string | undefined): string[] {
  return [
    ...new Set(
      (param ?? '')
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ];
}

/** `?project=` for a set of slugs; none is no key, so the view is All projects. */
export function projectParamOf(slugs: readonly string[]): string | undefined {
  return slugs.length ? slugs.join(',') : undefined;
}

/**
 * The ids of the projects a set of slugs names, `undefined` for no slugs (All
 * projects). A slug no project has names nothing, so a stale link narrows to
 * the projects that still exist, and to an empty set, which shows nothing,
 * when none does: it never widens to All projects.
 */
export function projectIdsOfSlugs(
  slugs: readonly string[],
  projects: readonly { id: string; slug: string; isUnassigned: boolean }[],
): string[] | undefined {
  if (slugs.length === 0) return undefined;
  return projects
    .filter((row) => slugs.includes(row.isUnassigned ? UNASSIGNED_SLUG : row.slug))
    .map((row) => row.id);
}
