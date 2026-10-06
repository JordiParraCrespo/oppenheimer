import type { Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import { type DetailsToken, decodeEntities, imageSource } from '../lib/markdown';
import { MarkdownCode } from './markdown-code';
import { MarkdownImage } from './markdown-image';
import { inlineTokens } from './markdown-inline';
import { MarkdownTable } from './markdown-table';

type Heading = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function listItem(item: Tokens.ListItem, key: string): ReactNode {
  if (!item.task) {
    return (
      <li key={key}>
        <MarkdownBlocks tokens={item.tokens} />
      </li>
    );
  }
  return (
    <li key={key}>
      <input type="checkbox" checked={item.checked ?? false} disabled readOnly />
      <div>
        <MarkdownBlocks tokens={item.tokens} />
      </div>
    </li>
  );
}

function block(token: Token, key: string): ReactNode {
  switch (token.type) {
    case 'heading': {
      // The page's title is the pull request's; a description's `#` sits under it.
      const Tag = `h${Math.max(2, Math.min(6, token.depth))}` as Heading;
      return <Tag key={key}>{inlineTokens(token.tokens ?? [], key)}</Tag>;
    }
    case 'paragraph':
      return <p key={key}>{inlineTokens(token.tokens ?? [], key)}</p>;
    case 'text':
      return 'tokens' in token && token.tokens
        ? inlineTokens(token.tokens, key)
        : decodeEntities(token.text);
    case 'code':
      return <MarkdownCode key={key} code={token.text} language={token.lang} />;
    case 'blockquote':
      return (
        <blockquote key={key}>
          <MarkdownBlocks tokens={token.tokens ?? []} />
        </blockquote>
      );
    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item, index) => listItem(item, `${key}-${index}`));
      const tasks = list.items.some((item) => item.task) || undefined;
      return list.ordered ? (
        <ol
          key={key}
          start={list.start === '' || list.start === 1 ? undefined : Number(list.start)}
          data-task-list={tasks}
        >
          {items}
        </ol>
      ) : (
        <ul key={key} data-task-list={tasks}>
          {items}
        </ul>
      );
    }
    case 'table':
      return <MarkdownTable key={key} table={token as Tokens.Table} />;
    case 'hr':
      return <hr key={key} />;
    case 'html': {
      if (/^<br\s*\/?>$/i.test(token.raw.trim())) return <br key={key} />;
      const image = imageSource(token.raw);
      return image ? (
        <p key={key}>
          <MarkdownImage src={image.src} alt={image.alt} />
        </p>
      ) : null;
    }
    case 'githubDetails': {
      const details = token as DetailsToken;
      return (
        <details key={key} open={details.open}>
          <summary>{details.summary}</summary>
          <MarkdownBlocks tokens={details.tokens} />
        </details>
      );
    }
    default:
      return null;
  }
}

/** A description's blocks, each the element it reads as; HTML GitHub would render is dropped. */
export function MarkdownBlocks({ tokens }: { tokens: Token[] }) {
  return <>{tokens.map((token, index) => block(token, `${token.type}-${index}`))}</>;
}
