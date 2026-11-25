/**
 * A message's preview as one line of plain words: the Markdown a bot writes
 * (`**`, backticks, links, headings, list marks) read rather than shown, and
 * its line breaks folded, since a row holds two lines at most.
 */
export function previewLine(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/^\s{0,3}(#{1,6}|[-+>]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
