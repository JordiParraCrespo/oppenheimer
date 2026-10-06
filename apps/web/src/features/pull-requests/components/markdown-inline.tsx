import type { Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import { closingIndex, decodeEntities, imageSource, openedTag, safeHref } from '../lib/markdown';
import { MarkdownImage } from './markdown-image';

type BasicTag = 'b' | 'del' | 'em' | 'i' | 'kbd' | 's' | 'strong' | 'sub' | 'sup' | 'u';

/** One inline token as an element: emphasis, code, a link, an image, a break. */
function inlineToken(token: Token, key: string): ReactNode {
  switch (token.type) {
    case 'text':
      return 'tokens' in token && token.tokens ? (
        <span key={key}>{inlineTokens(token.tokens, key)}</span>
      ) : (
        decodeEntities(token.text)
      );
    case 'escape':
      return token.text;
    case 'strong':
      return <strong key={key}>{inlineTokens(token.tokens ?? [], key)}</strong>;
    case 'em':
      return <em key={key}>{inlineTokens(token.tokens ?? [], key)}</em>;
    case 'del':
      return <del key={key}>{inlineTokens(token.tokens ?? [], key)}</del>;
    case 'codespan':
      return <code key={key}>{decodeEntities(token.text)}</code>;
    case 'br':
      return <br key={key} />;
    case 'link': {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      const children = inlineTokens(link.tokens, key);
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" title={link.title ?? undefined}>
          {children}
        </a>
      ) : (
        <span key={key}>{children}</span>
      );
    }
    case 'image': {
      const image = token as Tokens.Image;
      return <MarkdownImage key={key} src={image.href} alt={decodeEntities(image.text)} />;
    }
    case 'html': {
      if (/^<br\s*\/?>$/i.test(token.raw.trim())) return <br key={key} />;
      const image = imageSource(token.raw);
      return image ? <MarkdownImage key={key} src={image.src} alt={image.alt} /> : null;
    }
    default:
      return null;
  }
}

/**
 * A run of inline tokens. A basic tag (`<b>`, `<kbd>`, `<sub>`…) wraps the
 * tokens up to its closing tag; any other HTML is dropped and what sits
 * between its tags reads as text.
 */
export function inlineTokens(tokens: Token[], prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const key = `${prefix}-${index}`;
    const tag = openedTag(token);
    const end = tag ? closingIndex(tokens, index + 1, tag) : null;
    if (tag && end !== null) {
      const Tag = tag as BasicTag;
      nodes.push(<Tag key={key}>{inlineTokens(tokens.slice(index + 1, end), key)}</Tag>);
      index = end;
      continue;
    }
    nodes.push(inlineToken(token, key));
  }
  return nodes;
}

/** A line of a description, its marks as elements. */
export function MarkdownInline({ tokens }: { tokens: Token[] }) {
  return <>{inlineTokens(tokens, 'inline')}</>;
}
