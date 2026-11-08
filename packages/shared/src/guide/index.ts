import type { GuidePage } from './guide-page.js';
import { GUIDE_PAGES } from './guide-pages.gen.js';

export type { GuidePage } from './guide-page.js';
export { GUIDE_PAGES } from './guide-pages.gen.js';

/** Where the docs site serves a page: `<site>/guide/<id>`. */
export const GUIDE_ROUTE = 'guide';

/**
 * A page by its id, forgiving what a reader copies from a link: `./hosts.md`,
 * `guide/hosts`, `Hosts`. Undefined when no page has that id.
 */
export function findGuidePage(reference: string): GuidePage | undefined {
  const id = reference
    .trim()
    .toLowerCase()
    .replace(/^\.?\//, '')
    .replace(new RegExp(`^${GUIDE_ROUTE}/`), '')
    .replace(/\.mdx?$/, '')
    .replace(/\/$/, '');
  return GUIDE_PAGES.find((page) => page.id === id);
}
