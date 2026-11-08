import { findGuidePage, GUIDE_PAGES, GUIDE_ROUTE, type GuidePage } from '@oppenheimer/shared/guide';

/** A page's address on the docs site, when the deployment says where the site is. */
function pageAddress(page: GuidePage, docsUrl: string | null): string | null {
  return docsUrl ? `${docsUrl.replace(/\/+$/, '')}/${GUIDE_ROUTE}/${page.id}` : null;
}

/**
 * What `read_oppenheimer_docs` answers with no page: every page by id, title
 * and what it covers, so the bot picks the ones a question needs rather than
 * reading the whole guide.
 */
export function guideIndexText(docsUrl: string | null): string {
  const lines = GUIDE_PAGES.map((page) => `- \`${page.id}\`: ${page.title}. ${page.description}`);
  const site = docsUrl ? ` It is published at ${docsUrl.replace(/\/+$/, '')}/${GUIDE_ROUTE}.` : '';
  return `Oppenheimer's guide, ${GUIDE_PAGES.length} pages.${site} Read a page with \`read_oppenheimer_docs\` and its id.

${lines.join('\n')}`;
}

/**
 * One page, whole: its title, its address on the docs site when there is
 * one, then its Markdown. A page the guide has no id for answers the index,
 * so the bot can pick again in the same call's answer instead of guessing.
 */
export function guidePageText(reference: string, docsUrl: string | null): string {
  const page = findGuidePage(reference);
  if (!page) {
    return `The guide has no page "${reference}".\n\n${guideIndexText(docsUrl)}`;
  }
  const address = pageAddress(page, docsUrl);
  const head = address ? `# ${page.title}\n\nOn the docs site: ${address}` : `# ${page.title}`;
  return `${head}\n\n${page.body}`;
}
