import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * OverviewPage — the automations pages' frame and nothing in it
 * (`design/version1/SessionsConsole.dc.html`, `op-rp`): a canvas column that
 * scrolls on its own, holding the measured body — wider than the editor's,
 * for a table — with its blocks spaced. `OverviewPageTop` is the first row:
 * the view tabs on the left, the page's one action on the right. What a page
 * puts in the body — a `PageHeader`, `RunHistory`, `RoutineTable`, `RunsList`,
 * `TemplateGrid` — is the page's.
 *
 * ```tsx
 * <OverviewPage>
 *   <OverviewPageBody>
 *     <OverviewPageTop>
 *       <PillTabs …>…</PillTabs>
 *       <Button size="sm" variant="secondary">New automation</Button>
 *     </OverviewPageTop>
 *     …
 *   </OverviewPageBody>
 * </OverviewPage>
 * ```
 */
function OverviewPage({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="overview-page"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas', className)}
      {...props}
    />
  );
}

/** The measured body: centred, its blocks spaced. */
function OverviewPageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="overview-page-body"
      className={cn('mx-auto flex w-full max-w-230 flex-col gap-4 px-8 pt-7 pb-18', className)}
      {...props}
    />
  );
}

/** The first row: the view tabs, then the page's one action pushed right. */
function OverviewPageTop({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="overview-page-top"
      className={cn('mb-1 flex items-center gap-3 [&>:last-child:not(:first-child)]:ml-auto', className)}
      {...props}
    />
  );
}

export { OverviewPage, OverviewPageBody, OverviewPageTop };
