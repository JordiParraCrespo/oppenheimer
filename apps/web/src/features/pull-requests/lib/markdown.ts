import { Marked, type Token, type TokenizerExtension, type Tokens } from 'marked';

/**
 * A pull request's description, read the way the Codex desktop app reads it:
 * GitHub's Markdown lexed by `marked` into tokens that `MarkdownBody` turns
 * into elements one by one, so nothing from GitHub is ever put into the page
 * as markup. Before lexing, the description is brought from what GitHub
 * renders to what Markdown says (`prepareDescription`): comments go,
 * `<details>` becomes a fold, and an alert's `[!NOTE]` becomes its word.
 */

/** A `<details>` fold, from the `github-details` block `prepareDescription` writes. */
export type DetailsToken = {
  type: 'githubDetails';
  raw: string;
  summary: string;
  open: boolean;
  tokens: Token[];
};

/** How wide a table's column reads, from its longest cell: what `Prose` caps it at. */
export type ColumnSize = 'sm' | 'md' | 'lg' | 'xl';

/** The inline tags GitHub's authors use that come through as themselves; any other tag is dropped. */
const BASIC_HTML_TAGS = new Set(['b', 'del', 'em', 'i', 'kbd', 's', 'strong', 'sub', 'sup', 'u']);

const FENCE = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g;
const FENCE_SLOT = /@@FENCED_CODE_BLOCK_(\d+)@@/g;
const COMMENT = /<!--[\s\S]*?-->/g;
const ALERT = /(^|\n)(>[ \t]*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([ \t]*(?=\n|$))/gi;
const DETAILS = /<details(\s+open)?>([\s\S]*?)<\/details>/gi;
const SUMMARY = /^\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*)$/i;
const HTML_LIST = /<(?:ol|ul|li|p)(?:\s[^>]*)?>/i;
const TAG = /<[^>]+>/g;
const DETAILS_BLOCK = /^:::github-details(\{[^\n]*\})\n([\s\S]*?)\n:::(?:\n|$)/;

const githubDetails: TokenizerExtension = {
  name: 'githubDetails',
  level: 'block',
  tokenizer(source) {
    const match = DETAILS_BLOCK.exec(source);
    if (!match) return undefined;
    const { summary, open } = JSON.parse(match[1] ?? '{}') as { summary: string; open: boolean };
    return {
      type: 'githubDetails',
      raw: match[0],
      summary,
      open,
      tokens: this.lexer.blockTokens(match[2] ?? '', []),
    };
  },
};

const markdown = new Marked({ gfm: true, extensions: [githubDetails] });

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** A fold's body written as HTML lists and paragraphs, as Markdown lines. */
function structuredText(html: string): string {
  return html
    .replace(/<li(?:\s[^>]*)?>/gi, '\n- ')
    .replace(/<\/?(?:ol|ul|p)(?:\s[^>]*)?>/gi, '\n')
    .replace(TAG, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n+/g, '\n\n')
    .trim();
}

/**
 * GitHub's description as Markdown: comments (the template's hints) removed,
 * `> [!WARNING]` as `> **Warning**`, and each `<details>` as a fold block the
 * lexer reads. Fenced code is set aside first, so none of it touches code.
 */
function prepareDescription(source: string): string {
  const fences: string[] = [];
  const prose = source.replace(/\r\n/g, '\n').replace(FENCE, (fence) => {
    fences.push(fence);
    return `@@FENCED_CODE_BLOCK_${fences.length - 1}@@`;
  });
  const prepared = prose
    .replace(COMMENT, '')
    .replace(ALERT, (_, start, quote, kind) => `${start}${quote}**${capitalised(kind)}**`)
    .replace(DETAILS, (whole, open: string | undefined, inner: string) => {
      const parts = SUMMARY.exec(inner);
      if (!parts) return whole;
      const summary = (parts[1] ?? '').replace(TAG, ' ').replace(/\s+/g, ' ').trim();
      if (!summary) return whole;
      const body = parts[2] ?? '';
      const text = HTML_LIST.test(body) ? structuredText(body) : body.trim();
      const attributes = JSON.stringify({ summary, open: open !== undefined });
      return `\n\n:::github-details${attributes}\n${text}\n:::\n\n`;
    })
    .replace(/\n{3,}/g, '\n\n');
  return prepared.replace(FENCE_SLOT, (slot, index) => fences[Number(index)] ?? slot);
}

/** The description as the blocks `MarkdownBody` renders. */
export function parseDescription(source: string): Token[] {
  return markdown.lexer(prepareDescription(source));
}

/** The description's first paragraph, as its inline tokens: what a briefing leads with. */
export function leadOf(source: string): Token[] | null {
  const lead = parseDescription(source).find(
    (token): token is Tokens.Paragraph => token.type === 'paragraph',
  );
  return lead?.tokens ?? null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** A text token's characters: `marked` leaves `&amp;` and `&#39;` as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/** A link or image target worth following: the web or mail, never `javascript:`. */
export function safeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** What a run of inline tokens reads as, without its marks. */
function plainText(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) =>
      'tokens' in token && Array.isArray(token.tokens)
        ? plainText(token.tokens)
        : 'text' in token && typeof token.text === 'string'
          ? decodeEntities(token.text)
          : '',
    )
    .join('');
}

/**
 * Each column's size from the longest cell in it, header included: up to 40
 * characters is `sm`, 100 `md`, 160 `lg`, beyond that `xl`.
 */
export function columnSizes(table: Tokens.Table): ColumnSize[] {
  return table.header.map((header, column) => {
    let longest = plainText(header.tokens).length;
    for (const row of table.rows) {
      if (longest > 160) break;
      longest = Math.max(longest, plainText(row[column]?.tokens).length);
    }
    return longest <= 40 ? 'sm' : longest <= 100 ? 'md' : longest <= 160 ? 'lg' : 'xl';
  });
}

/** The tag an inline `html` token opens, when it is one of the basic ones with no attributes. */
export function openedTag(token: Token): string | null {
  if (token.type !== 'html') return null;
  const tag = /^<([a-z]+)>$/i.exec(token.raw.trim())?.[1]?.toLowerCase();
  return tag && BASIC_HTML_TAGS.has(tag) ? tag : null;
}

/** Where the tag opened at `from - 1` closes among `tokens`, nesting counted; null when it never does. */
export function closingIndex(tokens: Token[], from: number, tag: string): number | null {
  let depth = 0;
  for (let index = from; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (openedTag(token) === tag) depth += 1;
    else if (token.type === 'html' && token.raw.trim().toLowerCase() === `</${tag}>`) {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return null;
}

/** An image's address in an inline `<img src="…">`, when the tag is one. */
export function imageSource(html: string): { src: string; alt: string } | null {
  if (!/^\s*<img\s/i.test(html)) return null;
  const src = /\ssrc\s*=\s*"([^"]+)"/i.exec(html)?.[1] ?? /\ssrc\s*=\s*'([^']+)'/i.exec(html)?.[1];
  if (!src) return null;
  const alt = /\salt\s*=\s*"([^"]*)"/i.exec(html)?.[1] ?? '';
  return { src: decodeEntities(src), alt: decodeEntities(alt) };
}
