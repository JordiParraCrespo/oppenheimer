import type { ReactNode } from 'react';
import { decodeEntities, type MarkdownToken, parseMarkdown } from '../lib/markdown';

function node(token: MarkdownToken, key: string): ReactNode {
  const children = () =>
    'tokens' in token && token.tokens ? render(token.tokens as MarkdownToken[], key) : null;
  switch (token.type) {
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
    case 'image':
      return decodeEntities(token.text);
    case 'code':
      return <code key={key}>{token.text}</code>;
    case 'list':
      return token.items.map((item, index) =>
        render(item.tokens as MarkdownToken[], `${key}-${index}`),
      );
    case 'table':
    case 'hr':
    case 'html':
    case 'br':
    case 'space':
      return null;
    // A heading, a paragraph, a quote, a fold and a link read as their words.
    default:
      return children();
  }
}

function render(tokens: MarkdownToken[], prefix: string): ReactNode[] {
  return tokens.map((token, index) => node(token, `${prefix}-${index}`));
}

/**
 * The start of something written in markdown (a bot's last message) on one
 * line, the way a chat list previews it: bold, italics, struck text and code
 * spans as themselves and every other mark dropped, a link as its words (the
 * line usually sits inside a link of its own), never the syntax. It draws
 * inline elements alone: the caller sets the line's type and truncation. A
 * mark the source leaves open (a preview cut inside a bold) stays as written.
 */
export function MarkdownLine({ source }: { source: string }) {
  return <>{render(parseMarkdown(source.replace(/\s+/g, ' ').trim()), 'line')}</>;
}
