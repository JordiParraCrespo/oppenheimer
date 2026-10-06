import { EditorPage, EditorPageBody, type EditorPageSize } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useScrollReset } from '../hooks/use-scroll-reset';

/**
 * The console's page: the design system's `EditorPage` at a measure, opened at
 * the top on every new page. `AppShell` draws it around every route whose
 * pane is a measure (`lib/pane.ts`), so no screen draws a frame of its own.
 *
 * It is exported for one case: a state of a `full` route that is not a route
 * of its own, a session still being prepared before its terminal exists. A
 * screen whose views are routes or search params names its measure on the
 * route instead.
 */
export function PageFrame({ size, children }: { size: EditorPageSize; children: ReactNode }) {
  const scroller = useScrollReset<HTMLDivElement>(size);
  return (
    <EditorPage ref={scroller}>
      <EditorPageBody size={size}>{children}</EditorPageBody>
    </EditorPage>
  );
}
