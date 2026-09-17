/**
 * The slug the API would derive anyway, shown so the reader is not surprised
 * by it. Kept in step with `createOrganizationSchema`'s pattern: lowercase,
 * digits and hyphens, at least two characters.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
