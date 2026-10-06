/**
 * The few Markdown blocks a pull request's description uses, read without a
 * renderer and without HTML: headings, paragraphs, lists and fenced code. What
 * it does not know reads as a paragraph, so nothing someone wrote is lost, and
 * nothing from GitHub is ever put into the page as markup.
 */
export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string };

/** A run of text, split on `inline code`. */
export type InlinePart = { code: boolean; text: string };

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (list) blocks.push({ kind: 'list', ...list });
    paragraph = [];
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trimStart().startsWith('```')) {
      flush();
      const code: string[] = [];
      for (
        index += 1;
        index < lines.length && !(lines[index] ?? '').trimStart().startsWith('```');
        index += 1
      ) {
        code.push(lines[index] ?? '');
      }
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(3, (heading[1] ?? '#').length) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, text: (heading[2] ?? '').trim() });
      continue;
    }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      if (paragraph.length) flush();
      const ordered = item[2] !== undefined;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((item[3] ?? '').trim());
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

export function inlineParts(text: string): InlinePart[] {
  return text
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? { code: true, text: part.slice(1, -1) }
        : { code: false, text: part },
    );
}

/** The description's first paragraph: what a briefing leads with. */
export function leadOf(source: string): string | null {
  return parseMarkdown(source).find((block) => block.kind === 'paragraph')?.text ?? null;
}
