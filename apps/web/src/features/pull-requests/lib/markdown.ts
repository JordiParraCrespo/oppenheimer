import { Marked, type MarkedToken, type Token, type Tokens } from 'marked';

/**
 * A pull request's description, read the way the Codex desktop app reads it:
 * GitHub's Markdown lexed by `marked` into tokens that `MarkdownBody` turns
 * into elements, so nothing from GitHub is ever put into the page as markup.
 * What GitHub renders beyond Markdown is taught to the lexer, not rewritten
 * in the source: a `<details>` fold and an attribute-free inline tag are
 * tokens of their own, and an alert's `[!NOTE]` becomes its word. Any other
 * HTML, comments included, is an `html` token the renderer drops.
 */

/** A `<details>` fold: its summary as text, its body as blocks. */
export type DetailsToken = {
  type: 'details';
  raw: string;
  summary: string;
  open: boolean;
  tokens: Token[];
};

/** The inline tags GitHub's authors use that come through as themselves. */
export type BasicTag = 'b' | 'del' | 'em' | 'i' | 'kbd' | 's' | 'strong' | 'sub' | 'sup' | 'u';

/** `<kbd>⌘</kbd>`: an attribute-free basic tag around inline tokens. */
export type BasicHtmlToken = { type: 'basicHtml'; raw: string; tag: BasicTag; tokens: Token[] };

/** Every token the renderer is handed. */
export type MarkdownToken = MarkedToken | DetailsToken | BasicHtmlToken;

const DETAILS =
  /^ {0,3}<details(\s+open)?\s*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>[ \t]*(?:\n+|$)/i;
const BASIC_HTML = /^<(b|del|em|i|kbd|s|strong|sub|sup|u)>([\s\S]*?)<\/\1>/i;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i;

const markdown = new Marked({
  gfm: true,
  extensions: [
    {
      name: 'details',
      level: 'block',
      start: (source) => source.match(/<details/i)?.index,
      tokenizer(source) {
        const match = DETAILS.exec(source);
        if (!match) return undefined;
        return {
          type: 'details',
          raw: match[0],
          summary: (match[2] ?? '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
          open: match[1] !== undefined,
          tokens: this.lexer.blockTokens((match[3] ?? '').trim(), []),
        };
      },
    },
    {
      name: 'basicHtml',
      level: 'inline',
      start: (source) => source.match(/<(?:b|del|em|i|kbd|s|strong|sub|sup|u)>/i)?.index,
      tokenizer(source) {
        const match = BASIC_HTML.exec(source);
        if (!match) return undefined;
        return {
          type: 'basicHtml',
          raw: match[0],
          tag: (match[1] ?? 'b').toLowerCase(),
          tokens: this.lexer.inlineTokens(match[2] ?? ''),
        };
      },
    },
  ],
});

/** `> [!WARNING]` opens with its word, as `> **Warning**`, the way GitHub shows it. */
function nameAlert(token: Token): void {
  if (token.type !== 'blockquote') return;
  const paragraph = (token as Tokens.Blockquote).tokens[0];
  if (paragraph?.type !== 'paragraph') return;
  const inline = (paragraph as Tokens.Paragraph).tokens;
  const first = inline[0];
  const alert = first?.type === 'text' ? ALERT.exec((first as Tokens.Text).text) : null;
  if (!first || !alert) return;
  const kind = alert[1] ?? '';
  const word = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  const rest = (first as Tokens.Text).text.slice(alert[0].length);
  inline.splice(
    0,
    1,
    { type: 'strong', raw: word, text: word, tokens: [{ type: 'text', raw: word, text: word }] },
    { type: 'text', raw: ` ${rest}`, text: rest ? ` ${rest}` : '' },
  );
}

/** The description as the tokens `MarkdownBody` renders. */
export function parseDescription(source: string): MarkdownToken[] {
  const tokens = markdown.lexer(source.replace(/\r\n/g, '\n'));
  markdown.walkTokens(tokens, nameAlert);
  return tokens as MarkdownToken[];
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
    if (/^#x/i.test(name)) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/**
 * Where a link or image in the description goes, resolved against the pull
 * request's page the way GitHub resolves it (`#fragment`, `../blob/…`); only
 * the web and mail, never `javascript:`.
 */
export function safeHref(href: string, base: string | undefined): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** What a run of tokens reads as, without its marks. */
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

/** The description's first paragraph as plain text: what a briefing leads with. */
export function leadOf(source: string): string | null {
  const lead = parseDescription(source).find((token) => token.type === 'paragraph');
  const text = lead ? plainText(lead.tokens).replace(/\s+/g, ' ').trim() : '';
  return text || null;
}

/**
 * Each column's cap from its longest cell, header included, on the Codex
 * app's steps: up to 40 characters, 100, 160, and beyond.
 */
export function columnCaps(table: Tokens.Table): string[] {
  return table.header.map((header, column) => {
    let longest = plainText(header.tokens).length;
    for (const row of table.rows) {
      if (longest > 160) break;
      longest = Math.max(longest, plainText(row[column]?.tokens).length);
    }
    return longest <= 40
      ? 'max-w-40'
      : longest <= 100
        ? 'max-w-53'
        : longest <= 160
          ? 'max-w-80'
          : 'max-w-120';
  });
}

/** An image's address in an `<img src="…">` GitHub writes for an upload. */
export function imageSource(html: string): { src: string; alt: string } | null {
  if (!/^\s*<img\s/i.test(html)) return null;
  const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  if (!src) return null;
  const alt = /\salt\s*=\s*["']([^"']*)["']/i.exec(html)?.[1] ?? '';
  return { src: decodeEntities(src), alt: decodeEntities(alt) };
}
