import { Prose } from '@oppenheimer/design-system-web';
import { parseMarkdown } from '../lib/markdown';
import { InlineText } from './inline-text';

/** A description as GitHub's author wrote it, in the design system's long-form type, never as raw HTML. */
export function MarkdownBody({ source, title }: { source: string; title?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <Prose className="mx-auto">
      {title ? <h1>{title}</h1> : null}
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === 'heading') {
          // The page's title is the pull request's; a description's own headings sit under it.
          const Heading = block.level === 3 ? 'h3' : 'h2';
          return <Heading key={key}>{block.text}</Heading>;
        }
        if (block.kind === 'code') {
          return (
            <pre key={key}>
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.kind === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond their place
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={key}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </Prose>
  );
}
