'use client';

import { useRender } from '@base-ui/react/use-render';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * EditorPage — the frame of a console page: the canvas column that scrolls on
 * its own, and the measured body centred in it. The console's shell draws it
 * around every route whose pane is a page (`pane` in the web kit's
 * `shell/lib/pane.ts`), so a screen renders its content and nothing of the
 * frame: the ground, the scroll, the measure and the gutter are said once,
 * here (`design/version1/Routines.dc.html`, `op-rpage` and `op-rp`).
 *
 * The ground is `canvas-recessed`, the export's grey `--canvas`, the same
 * under every console page and under Settings: the run history, the tables
 * and the selected view tab are white on it, which is all the lift they
 * need. Dark lifts the card instead, where the two grounds are one.
 *
 * `EditorPageBody` takes the measure as `size`: `narrow` (760px) for a form
 * or a single card, `wide` (920px) for a page that holds a table, `board`
 * (1240px) for Plan's columns. It publishes its gutter as `--page-gutter`, so
 * a child that has to bleed to the frame's edge — the task board's sideways
 * scroller — cancels it without knowing how wide it is.
 *
 * `EditorPageTop` is a first row for a page that opens on view tabs and one
 * action. `EditorPageBack` navigates, so it takes `render` for the router's
 * link the way `Link` does; on its own it is an anchor. Settings' Add a host
 * page uses it too.
 *
 * ```tsx
 * <EditorPage>
 *   <EditorPageBody size="wide">
 *     <EditorPageBack render={<RouterLink to="/automations" />}>Back</EditorPageBack>
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
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas-recessed', className)}
      {...props}
    />
  );
}

type EditorPageSize = 'narrow' | 'wide' | 'board';

const EDITOR_PAGE_SIZE: Record<EditorPageSize, string> = {
  // `op-rpage__body` opens 24px down; `op-rp__inner`, 28px.
  narrow: 'max-w-190 pt-6',
  wide: 'max-w-230 pt-7',
  board: 'max-w-310 pt-7',
};

/** The measured column inside the page, centred, with the gutter its children can bleed through. */
function EditorPageBody({
  size = 'narrow',
  className,
  ...props
}: React.ComponentProps<'div'> & { size?: EditorPageSize }) {
  return (
    <div
      data-slot="editor-page-body"
      data-size={size}
      className={cn(
        'mx-auto flex w-full flex-1 flex-col gap-4 px-(--page-gutter) pb-18 [--page-gutter:1rem] sm:[--page-gutter:2rem]',
        EDITOR_PAGE_SIZE[size],
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

export type { EditorPageSize };
export { EditorPage, EditorPageBack, EditorPageBody, EditorPageTop };
