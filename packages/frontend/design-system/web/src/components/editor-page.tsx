'use client';

import { useRender } from '@base-ui/react/use-render';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * EditorPage — the frame of a console page: the column that scrolls on its
 * own, and the measured body in it. The console's shell draws it around
 * every page (the web kit's `PageFrame`), so a screen renders its content and
 * nothing of the frame: the scroll, the measure and the gutter are said once,
 * here (`design/version1/Routines.dc.html`, `op-rpage` and `op-rp`). The
 * ground is not the frame's: it is whatever the frame sits on, the shell's
 * column in the console.
 *
 * `EditorPageBody` takes the measure as `size`, one per width in the design
 * export's frames:
 *
 * - `status` (420px) and `composer` (720px) are a column centred in the pane
 *   both ways: a session being prepared, New session's composer.
 * - `narrow` (760px), a form, a single card or an article; `wide` (920px), a
 *   page that holds a table or a briefing; `board` (1240px), Plan's columns.
 *   These open at the top.
 * - `fluid`, no measure, for a page as wide and as tall as the pane (a diff):
 *   the body fills the frame, so the page never scrolls and the screen owns
 *   its scrolling columns, inside the same gutter.
 *
 * The body owns the gutter. A child that has to reach the frame's edge opts in
 * with `data-bleed`, and the body cancels its gutter for it: the task board's
 * sideways scroller keeps its columns on the measure while a card scrolled
 * past passes under the gutter instead of starting in it. The child knows
 * neither the gutter's width nor that a page exists.
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
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}
      {...props}
    />
  );
}

type EditorPageSize = 'status' | 'composer' | 'narrow' | 'wide' | 'board' | 'fluid';

const EDITOR_PAGE_SIZE: Record<EditorPageSize, string> = {
  // `.op-provision__inner`, centred in the pane.
  status: 'my-auto max-w-105 py-8',
  // `.op-newsession`, centred in the pane.
  composer: 'my-auto max-w-180 py-12',
  // `op-rpage__body` opens 24px down; `op-rp__inner`, 28px.
  narrow: 'max-w-190 pt-6 pb-18',
  wide: 'max-w-230 pt-7 pb-18',
  board: 'max-w-310 pt-7 pb-18',
  fluid: 'min-h-0 flex-1 pt-6 pb-6',
};

/** The page's gutter, cancelled for a child that opts in to the frame's edge. */
const GUTTER =
  'px-4 sm:px-8 [&_[data-bleed]]:-mx-4 [&_[data-bleed]]:px-4 sm:[&_[data-bleed]]:-mx-8 sm:[&_[data-bleed]]:px-8';

/** The measured column inside the page, centred, with its gutter. */
function EditorPageBody({
  size = 'narrow',
  className,
  ...props
}: React.ComponentProps<'div'> & { size?: EditorPageSize }) {
  return (
    <div
      data-slot="editor-page-body"
      data-size={size}
      className={cn('mx-auto flex w-full flex-col gap-4', GUTTER, EDITOR_PAGE_SIZE[size], className)}
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
