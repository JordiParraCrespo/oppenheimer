/**
 * An element's words as a reader sees them, one space between each run of
 * text, for specs that read a rendered transcript back as a text outline:
 * `textContent` alone glues a label to the meta beside it ("Read a.tsdone").
 * Shared test support only; a feature's own outline stays in its spec.
 */
export function words(element: Element | null | undefined): string {
  if (!element) return '';
  const runs: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const run = node.textContent?.trim();
    if (run) runs.push(run);
  }
  return runs.join(' ');
}
