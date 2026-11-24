import { Marked, type MarkedToken, type Token, type Tokens } from 'marked';

/**
 * Markdown read the way the Codex desktop app reads a pull request's
 * description: GitHub's flavour lexed by `marked` into tokens that `Markdown`
 * turns into elements, so nothing in the source is ever put into the page as
 * markup.
 * What GitHub renders beyond Markdown is taught to the lexer, not rewritten
 * in the source: a `<details>` fold and an attribute-free inline tag are
 * tokens of their own, and an alert's `[!NOTE]` becomes its word. Any other
 * HTML, comments included, is an `html` token the renderer drops. TeX
 * between dollars is a `math` token: `$…$` in a line, `$$…$$` on lines of
 * its own.
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

/** TeX to typeset: `$…$` (or `$$…$$`) inside a line, `$$…$$` as a block of its own. */
export type MathToken = { type: 'math'; raw: string; text: string; display: boolean };

/** Every token the renderer is handed. */
export type MarkdownToken = MarkedToken | DetailsToken | BasicHtmlToken | MathToken;

const DETAILS_OPEN = /^ {0,3}<details(\s+open)?\s*>\s*<summary>([\s\S]*?)<\/summary>/i;
const DETAILS_TAG = /<(\/?)details\b[^>]*>/gi;
const BASIC_HTML = /^<(b|del|em|i|kbd|s|strong|sub|sup|u)>([\s\S]*?)<\/\1>/i;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i;

/**
 * Math in a line, by the rule most Markdown readers share so a price is never
 * TeX: the opening `$` is followed by something other than a space, the
 * closing one follows something other than a space and is not followed by a
 * digit. "$5 and $10" is two prices; "$x^2$" is math. `$$…$$` needs no
 * such care. A `\$` is a dollar in either.
 */
const INLINE_MATH = /^\$(?![\s$])((?:\\[\s\S]|[^\\$\n])+?)(?<!\s)\$(?![\d$])/;
const INLINE_DISPLAY_MATH = /^\$\$((?:\\[\s\S]|[^\\$])+?)\$\$/;
/** `$$` on a line of its own (or wrapping a line whole), closed the same way. */
const BLOCK_MATH = /^ {0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/;

/**
 * A fold at the start of `source`, its closing tag found by counting the
 * folds opened inside it, so a nested `<details>` stays inside its parent.
 */
function matchDetails(
  source: string,
): { raw: string; open: boolean; summary: string; body: string } | null {
  const head = DETAILS_OPEN.exec(source);
  if (!head) return null;
  let depth = 1;
  const tags = new RegExp(DETAILS_TAG.source, 'gi');
  tags.lastIndex = head[0].length;
  for (let tag = tags.exec(source); tag; tag = tags.exec(source)) {
    depth += tag[1] ? -1 : 1;
    if (depth > 0) continue;
    const end = tag.index + tag[0].length;
    const trailing = /^[ \t]*(?:\n+|$)/.exec(source.slice(end))?.[0] ?? '';
    return {
      raw: source.slice(0, end) + trailing,
      open: head[1] !== undefined,
      summary: head[2] ?? '',
      body: source.slice(head[0].length, tag.index),
    };
  }
  return null;
}

const markdown = new Marked({
  gfm: true,
  extensions: [
    {
      name: 'details',
      level: 'block',
      start: (source) => source.match(/<details/i)?.index,
      tokenizer(source) {
        const match = matchDetails(source);
        if (!match) return undefined;
        return {
          type: 'details',
          raw: match.raw,
          summary: match.summary
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
          open: match.open,
          tokens: this.lexer.blockTokens(match.body.trim(), []),
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
    {
      name: 'mathBlock',
      level: 'block',
      start: (source) => source.match(/^ {0,3}\$\$/m)?.index,
      tokenizer(source) {
        const match = BLOCK_MATH.exec(source);
        const text = match?.[1]?.trim();
        if (!match || !text) return undefined;
        return { type: 'math', raw: match[0], text, display: true };
      },
    },
    {
      name: 'math',
      level: 'inline',
      start: (source) => source.match(/(?<!\\)\$/)?.index,
      tokenizer(source) {
        const match = INLINE_DISPLAY_MATH.exec(source) ?? INLINE_MATH.exec(source);
        const text = match?.[1]?.trim();
        if (!match || !text) return undefined;
        return { type: 'math', raw: match[0], text, display: false };
      },
    },
  ],
});

/**
 * What a fenced block draws as: a `mermaid` fence is a diagram, a `math`
 * fence is TeX, anything else is code.
 */
export function fenceKind(token: Tokens.Code): 'diagram' | 'math' | 'code' {
  const name = token.lang?.trim().split(/\s+/)[0]?.toLowerCase();
  if (token.codeBlockStyle === 'indented') return 'code';
  return name === 'mermaid' ? 'diagram' : name === 'math' ? 'math' : 'code';
}

/**
 * Whether a fence has its closing line yet. A reply still being written
 * holds a fence open to the end of the source, and what is inside it can
 * still change; a block is drawn from it only once it is closed.
 */
export function fenceClosed(token: Tokens.Code): boolean {
  const open = /^ {0,3}(`{3,}|~{3,})/.exec(token.raw)?.[1];
  if (!open) return true;
  const mark = open[0] === '`' ? '`' : '~';
  return new RegExp(`\\n {0,3}${mark}{${open.length},}[ \\t]*\\n*$`).test(token.raw);
}

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

/** The source as the tokens `Markdown` renders. */
export function parseMarkdown(source: string): MarkdownToken[] {
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
    if (name.startsWith('#')) {
      const point = /^#x/i.test(name) ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      // An out-of-range reference stays as written rather than throwing in render.
      return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/**
 * Where a link or image goes, resolved against `base` the way GitHub resolves
 * a description's against its page (`#fragment`, `../blob/…`); only the web
 * and mail, never `javascript:`. Without a base a relative address goes
 * nowhere.
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

/** What one token draws as text, into `out`; each block between newlines. */
function drawnText(token: MarkdownToken, out: string[]): void {
  const inline = (tokens: Token[] | undefined) => {
    for (const child of tokens ?? []) drawnText(child as MarkdownToken, out);
  };
  const block = (tokens: Token[] | undefined) => {
    out.push('\n');
    inline(tokens);
    out.push('\n');
  };
  switch (token.type) {
    case 'text':
      if (token.tokens) inline(token.tokens);
      else out.push(decodeEntities(token.text));
      return;
    case 'escape':
      out.push(token.text);
      return;
    case 'codespan':
      out.push(decodeEntities(token.text));
      return;
    case 'math':
      if (token.display) out.push('\n', token.text, '\n');
      else out.push(token.text);
      return;
    case 'code':
      out.push('\n', token.text, '\n');
      return;
    case 'list':
      for (const item of token.items) block(item.tokens);
      return;
    case 'table':
      for (const cell of [...token.header, ...token.rows.flat()]) block(cell.tokens);
      return;
    case 'details':
      out.push('\n', token.summary, '\n');
      block(token.tokens);
      return;
    case 'paragraph':
    case 'heading':
    case 'blockquote':
      block(token.tokens);
      return;
    case 'strong':
    case 'em':
    case 'del':
    case 'link':
    case 'basicHtml':
      inline(token.tokens);
      return;
    default:
      // An image, a rule, a break, HTML: no words of their own.
      return;
  }
}

/**
 * The words `Markdown` draws for a source, its marks and link targets left
 * out, each block (a paragraph, a list item, a cell, a code block) between
 * newlines so a search never runs from one into the next: what a find
 * counts in a reply, to agree with what it finds on screen.
 */
export function markdownText(source: string): string {
  const out: string[] = [];
  for (const token of parseMarkdown(source)) drawnText(token, out);
  return out.join('');
}
