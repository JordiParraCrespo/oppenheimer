import { Prose } from '@oppenheimer/design-system-web';
import type { Tokens } from 'marked';
import type { ReactNode } from 'react';
import {
  columnCaps,
  decodeEntities,
  imageSource,
  type MarkdownToken,
  parseDescription,
  safeHref,
} from '../lib/markdown';
import { MarkdownCode } from './markdown-code';
import { MarkdownImage } from './markdown-image';

type Heading = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function image(src: string, alt: string, base: string | undefined, key: string): ReactNode {
  const href = safeHref(src, base);
  return href ? <MarkdownImage key={key} href={href} alt={alt} /> : alt || null;
}

function listItem(item: Tokens.ListItem, base: string | undefined, key: string): ReactNode {
  const children = render(item.tokens as MarkdownToken[], base, key);
  if (!item.task) return <li key={key}>{children}</li>;
  return (
    <li key={key}>
      <input type="checkbox" checked={item.checked ?? false} disabled readOnly />
      <div>{children}</div>
    </li>
  );
}

function table(token: Tokens.Table, base: string | undefined, key: string): ReactNode {
  const caps = columnCaps(token);
  const cells = (row: Tokens.TableCell[], Cell: 'th' | 'td', rowKey: string) =>
    row.map((cell, column) => {
      const cellKey = `${rowKey}-${column}`;
      return (
        <Cell key={cellKey} align={cell.align ?? undefined} className={caps[column]}>
          {render(cell.tokens as MarkdownToken[], base, cellKey)}
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

function node(token: MarkdownToken, base: string | undefined, key: string): ReactNode {
  const children = () =>
    'tokens' in token && token.tokens ? render(token.tokens as MarkdownToken[], base, key) : null;
  switch (token.type) {
    case 'heading': {
      // The page's title is the pull request's; a description's `#` sits under it.
      const Tag = `h${Math.max(2, Math.min(6, token.depth))}` as Heading;
      return <Tag key={key}>{children()}</Tag>;
    }
    case 'paragraph':
      return <p key={key}>{children()}</p>;
    case 'text':
      return token.tokens ? children() : decodeEntities(token.text);
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
      const href = safeHref(token.href, base);
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" title={token.title ?? undefined}>
          {children()}
        </a>
      ) : (
        <span key={key}>{children()}</span>
      );
    }
    case 'image':
      return image(token.href, decodeEntities(token.text), base, key);
    case 'code':
      return <MarkdownCode key={key} code={token.text} language={token.lang} />;
    case 'blockquote':
      return <blockquote key={key}>{children()}</blockquote>;
    case 'list': {
      const items = token.items.map((item, index) => listItem(item, base, `${key}-${index}`));
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
      return table(token, base, key);
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
      return img ? image(img.src, img.alt, base, key) : null;
    }
    default:
      return null;
  }
}

/** One walk for every token, block or inline: each the element it reads as. */
function render(tokens: MarkdownToken[], base: string | undefined, prefix: string): ReactNode[] {
  return tokens.map((token, index) => node(token, base, `${prefix}-${index}`));
}

/**
 * A description as GitHub's author wrote it, in the design system's long-form
 * type, never as raw HTML. `base` is the pull request's page, which a
 * relative link or a `#fragment` resolves against.
 */
export function MarkdownBody({ source, base }: { source: string; base?: string }) {
  return <Prose className="max-w-none">{render(parseDescription(source), base, 'md')}</Prose>;
}
