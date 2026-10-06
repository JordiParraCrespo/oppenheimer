import { EditorPage, EditorPageBody, type EditorPageSize } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useScrollReset } from '../hooks/use-scroll-reset';

/**
 * The console's page: the design system's `EditorPage` at a measure, opened at
 * the top on every new page. `AppShell` draws it around every route whose
 * pane is a measure (`lib/pane.ts`), so no screen draws a frame of its own.
 *
 * The one other place it is drawn is inside a `full` screen, under a bar the
 * screen keeps fixed or in a state of it that is a page: a pull request's
 * briefing under its toolbar, a session that is still being prepared. Those
 * ask for the same frame here rather than rebuild it.
 */
export function PageFrame({ size, children }: { size: EditorPageSize; children: ReactNode }) {
  const scroller = useScrollReset<HTMLDivElement>(size);
  return (
    <EditorPage ref={scroller}>
      <EditorPageBody size={size}>{children}</EditorPageBody>
    </EditorPage>
  );
}
