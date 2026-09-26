'use client';

import { useRender } from '@base-ui/react/use-render';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * EditorPage — the page over the main column: New project, Add a host, the
 * automation editor (`design/version1/SessionsConsole.dc.html`, `op-rpage`).
 * The frame and nothing in it: a canvas column that scrolls on its own, a
 * 760px body centred in it with 24px over 32px of gutter and 72px of air
 * underneath, and the Back pill that sits above the page header. What a page
 * puts in the body — a `PageHeader`, then `RoutineSteps` — is the page's.
 *
 * `EditorPageBack` navigates, so it takes `render` for the router's link the
 * way `Link` does; on its own it is an anchor.
 *
 * ```tsx
 * <EditorPage>
 *   <EditorPageBody>
 *     <EditorPageBack render={<RouterLink to="/sessions" />}>Back</EditorPageBack>
 *     <PageHeader>…</PageHeader>
 *     <RoutineSteps>…</RoutineSteps>
 *   </EditorPageBody>
 * </EditorPage>
 * ```
 */
function EditorPage({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="editor-page"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas', className)}
      {...props}
    />
  );
}

/** The measured column inside the page: 760px, centred, the export's padding. */
function EditorPageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="editor-page-body"
      className={cn('mx-auto flex w-full max-w-190 flex-col px-8 pt-6 pb-18', className)}
      {...props}
    />
  );
}

/** The Back pill above the header: a chevron and a word, on the hover wash when pointed at. */
function EditorPageBack({
  className,
  children,
  render,
  ...props
}: useRender.ComponentProps<'a'>) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: {
      'data-slot': 'editor-page-back',
      className: cn(
        '-ml-2 mb-4.5 inline-flex h-7 items-center gap-0.5 self-start rounded-pill py-0 pr-2.5 pl-1 text-[13.5px] text-fg-muted no-underline transition-[background-color,color] duration-instant ease-standard hover:bg-hover-surface hover:text-fg hover:no-underline focus-visible:outline-2 focus-visible:outline-primary',
        className,
      ),
      children: (
        <>
          <ChevronLeftIcon className="size-[15px]" aria-hidden />
          {children}
        </>
      ),
      ...props,
    },
  });
}

export { EditorPage, EditorPageBack, EditorPageBody };
