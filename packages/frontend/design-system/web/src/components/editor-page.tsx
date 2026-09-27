'use client';

import { useRender } from '@base-ui/react/use-render';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * EditorPage — the page over the main column: the automations overview, and
 * Settings' Add a host page (`design/version1/SessionsConsole.dc.html`,
 * `op-rp`; `Settings.dc.html`). New project, Project settings, the console's
 * Add a host and the automation editor are dialogs over the console since
 * the 2026-09-27 export. The frame and nothing in it: a canvas column that
 * scrolls on its own, the measured body centred in it — `wide` for a page
 * that holds a table — and the Back pill that sits above the page header.
 * `EditorPageTop` is a first row for a page that opens on view tabs and one
 * action. What a page puts in the body is the page's.
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

/** The measured column inside the page, centred; `wide` is the overview's, which holds a table. */
function EditorPageBody({
  wide,
  className,
  ...props
}: React.ComponentProps<'div'> & { wide?: boolean }) {
  return (
    <div
      data-slot="editor-page-body"
      data-wide={wide || undefined}
      className={cn(
        'mx-auto flex w-full flex-col px-8 pt-6 pb-18',
        wide ? 'max-w-230 gap-4' : 'max-w-190',
        className,
      )}
      {...props}
    />
  );
}

/** A page's first row: the view tabs on the left, its one action pushed right. */
function EditorPageTop({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="editor-page-top"
      className={cn('mb-1 flex items-center gap-3 [&>:last-child:not(:first-child)]:ml-auto', className)}
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

export { EditorPage, EditorPageBack, EditorPageBody, EditorPageTop };
