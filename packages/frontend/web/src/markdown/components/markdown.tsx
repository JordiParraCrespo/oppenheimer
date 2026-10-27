import type { Tokens } from 'marked';
import { Fragment, type ReactNode } from 'react';
import {
  columnCaps,
  decodeEntities,
  imageSource,
  type MarkdownToken,
  parseMarkdown,
  safeHref,
} from '../lib/markdown';
import { MarkdownCode } from './markdown-code';
import { MarkdownImage } from './markdown-image';

type Heading = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/**
 * What every node is rendered with: the page relative links resolve
 * against, and the write head for text still being written, which goes
 * after the last words (`tail`, the innermost block that ends the source).
 * `line` reads the source as one line of words (`MarkdownLine`).
 */
type Context = {
  base: string | undefined;
  tail: MarkdownToken | null;
  caret: ReactNode;
  code: ((block: MarkdownCodeBlock) => ReactNode) | undefined;
  line: boolean;
};

/** A fenced block, for a caller that draws its own (`code`). */
export interface MarkdownCodeBlock {
  code: string;
  /** The fence's language, when it names one. */
  language: string | undefined;
}

/**
 * The block whose words end the source: the last paragraph, heading or
 * line of a list item, looked for inside the last list or quote. `null` when
 * the source ends on something with no running text (code, a table, a rule):
 * the write head then goes after it.
 */
function tailOf(tokens: readonly MarkdownToken[]): MarkdownToken | null {
  const last = [...tokens].reverse().find((token) => token.type !== 'space');
  if (!last) return null;
  switch (last.type) {
    case 'paragraph':
    case 'heading':
    case 'text':
      return last;
    case 'list':
      return tailOf((last.items.at(-1)?.tokens ?? []) as MarkdownToken[]);
    case 'blockquote':
      return tailOf(last.tokens as MarkdownToken[]);
    default:
      return null;
  }
}

function image(src: string, alt: string, ctx: Context, key: string): ReactNode {
  const href = safeHref(src, ctx.base);
  return href ? <MarkdownImage key={key} href={href} alt={alt} /> : alt || null;
}

function listItem(item: Tokens.ListItem, ctx: Context, key: string): ReactNode {
  const children = render(item.tokens as MarkdownToken[], ctx, key);
  if (!item.task) return <li key={key}>{children}</li>;
  return (
    <li key={key}>
      <input type="checkbox" checked={item.checked ?? false} disabled readOnly />
      <div>{children}</div>
    </li>
  );
}

function table(token: Tokens.Table, ctx: Context, key: string): ReactNode {
  const caps = columnCaps(token);
  const cells = (row: Tokens.TableCell[], Cell: 'th' | 'td', rowKey: string) =>
    row.map((cell, column) => {
      const cellKey = `${rowKey}-${column}`;
      return (
        <Cell key={cellKey} align={cell.align ?? undefined} className={caps[column]}>
          {render(cell.tokens as MarkdownToken[], ctx, cellKey)}
        </Cell>
      );
    });
  return (
    <div key={key} className="overflow-x-auto">
      <table>
        <thead>
          <tr>{cells(token.header, 'th', `${key}-head`)}</tr>
        </thead>
        <tbody>
          {token.rows.map((row, index) => {
            const rowKey = `${key}-${index}`;
            return <tr key={rowKey}>{cells(row, 'td', rowKey)}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A token on one line, where that differs from the page: a block is its
 * words, a link its text (the line sits inside a link of its own), and what
 * has no words is dropped. `undefined` leaves the token to `node`.
 */
function lineNode(token: MarkdownToken, ctx: Context, key: string): ReactNode | undefined {
  switch (token.type) {
    case 'heading':
    case 'paragraph':
    case 'blockquote':
    case 'details':
    case 'link':
      return render(token.tokens as MarkdownToken[], ctx, key);
    case 'list':
      return token.items.map((item, index) =>
        render(item.tokens as MarkdownToken[], ctx, `${key}-${index}`),
      );
    case 'image':
      return decodeEntities(token.text);
    case 'code':
      return <code key={key}>{token.text}</code>;
    case 'table':
    case 'hr':
    case 'html':
    case 'br':
      return null;
    default:
      return undefined;
  }
}

function node(token: MarkdownToken, ctx: Context, key: string): ReactNode {
  if (ctx.line) {
    const flat = lineNode(token, ctx, key);
    if (flat !== undefined) return flat;
  }
  const children = () =>
    'tokens' in token && token.tokens ? render(token.tokens as MarkdownToken[], ctx, key) : null;
  const caret = token === ctx.tail ? ctx.caret : null;
  switch (token.type) {
    case 'heading': {
      // The screen's own title is its only `h1`; a `#` in the source sits under it.
      const Tag = `h${Math.max(2, Math.min(6, token.depth))}` as Heading;
      return (
        <Tag key={key}>
          {children()}
          {caret}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={key}>
          {children()}
          {caret}
        </p>
      );
    case 'text': {
      const text = token.tokens ? children() : decodeEntities(token.text);
      return caret ? [text, <Fragment key={`${key}-caret`}>{caret}</Fragment>] : text;
    }
    case 'escape':
      return token.text;
    case 'strong':
      return <strong key={key}>{children()}</strong>;
    case 'em':
      return <em key={key}>{children()}</em>;
    case 'del':
      return <del key={key}>{children()}</del>;
    case 'basicHtml': {
      const Tag = token.tag;
      return <Tag key={key}>{children()}</Tag>;
    }
    case 'codespan':
      return <code key={key}>{decodeEntities(token.text)}</code>;
    case 'br':
      return <br key={key} />;
    case 'link': {
      const href = safeHref(token.href, ctx.base);
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" title={token.title ?? undefined}>
          {children()}
        </a>
      ) : (
        <span key={key}>{children()}</span>
      );
    }
    case 'image':
      return image(token.href, decodeEntities(token.text), ctx, key);
    case 'code':
      return ctx.code ? (
        <Fragment key={key}>
          {ctx.code({ code: token.text, language: token.lang || undefined })}
        </Fragment>
      ) : (
        <MarkdownCode key={key} code={token.text} language={token.lang} />
      );
    case 'blockquote':
      return <blockquote key={key}>{children()}</blockquote>;
    case 'list': {
      const items = token.items.map((item, index) => listItem(item, ctx, `${key}-${index}`));
      const tasks = token.items.some((item) => item.task) || undefined;
      const start = token.start === '' || token.start === 1 ? undefined : Number(token.start);
      return token.ordered ? (
        <ol key={key} start={start} data-task-list={tasks}>
          {items}
        </ol>
      ) : (
        <ul key={key} data-task-list={tasks}>
          {items}
        </ul>
      );
    }
    case 'table':
      return table(token, ctx, key);
    case 'hr':
      return <hr key={key} />;
    case 'details':
      return (
        <details key={key} open={token.open}>
          <summary>{token.summary}</summary>
          {children()}
        </details>
      );
    case 'html': {
      // GitHub's own HTML is dropped, but for a line break and an uploaded image.
      if (/^<br\s*\/?>$/i.test(token.raw.trim())) return <br key={key} />;
      const img = imageSource(token.raw);
      return img ? image(img.src, img.alt, ctx, key) : null;
    }
    default:
      return null;
  }
}

/** One walk for every token, block or inline: each the element it reads as. */
function render(tokens: MarkdownToken[], ctx: Context, prefix: string): ReactNode[] {
  return tokens.map((token, index) => node(token, ctx, `${prefix}-${index}`));
}

/**
 * Markdown someone else wrote (a pull request's description, a bot's reply)
 * as elements, never as raw HTML: GitHub's flavour, tables, task lists and
 * folds included, fenced code coloured with a copy button, links opening in
 * a new tab, and only web and mail addresses kept. `base` is the page a
 * relative link or a `#fragment` resolves against; without it such a link is
 * its text. It draws the elements alone: the caller sets them in the type
 * that styles them (`Prose`, `ChatReply`). `caret` puts a write head after
 * the last words of text still being written; a half-written source (an
 * open fence, a table's first row) renders as far as it goes.
 */
export function Markdown({
  source,
  base,
  caret,
  code,
}: {
  source: string;
  base?: string;
  /** A write head (`StreamingCaret`) after the last words, for text still being written. */
  caret?: ReactNode;
  /** Draws a fenced block (a chat's `ChatCode`); left out, the block is plain with a copy button. */
  code?: (block: MarkdownCodeBlock) => ReactNode;
}) {
  const tokens = parseMarkdown(source);
  const tail = caret ? tailOf(tokens) : null;
  return (
    <>
      {render(tokens, { base, tail, caret, code, line: false }, 'md')}
      {caret && !tail ? caret : null}
    </>
  );
}

/**
 * The start of something written in markdown (a bot's last message) on one
 * line, the way a chat list previews it: `Markdown`'s bold, italics, struck
 * text and code spans, a link as its words, a block as its words and what
 * has no words dropped, never the syntax. It draws inline elements alone:
 * the caller sets the line's type and truncation. A mark the source leaves
 * open (a preview cut inside a bold) stays as written.
 */
export function MarkdownLine({ source }: { source: string }) {
  const tokens = parseMarkdown(source.replace(/\s+/g, ' ').trim());
  const ctx = { base: undefined, tail: null, caret: null, code: undefined, line: true };
  return <>{render(tokens, ctx, 'line')}</>;
}
