import { Prose } from '@oppenheimer/design-system-web';
import { parseDescription } from '../lib/markdown';
import { MarkdownBlocks } from './markdown-blocks';

/** A description as GitHub's author wrote it, in the design system's long-form type, never as raw HTML. */
export function MarkdownBody({ source, title }: { source: string; title?: string }) {
  return (
    <Prose className="mx-auto">
      {title ? <h1>{title}</h1> : null}
      <MarkdownBlocks tokens={parseDescription(source)} />
    </Prose>
  );
}
