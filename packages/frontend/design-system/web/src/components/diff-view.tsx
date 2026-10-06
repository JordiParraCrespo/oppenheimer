'use client';

import type { DiffLineAnnotation } from '@pierre/diffs';
import { PatchDiff } from '@pierre/diffs/react';
import { BotIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, MessageSquareIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { CommentField } from '../internal/comment-field';
import { cn } from '../lib/utils';
import { Button } from './button';
import { DiffStat } from './diff-stat';
import { FileIcon } from './file-icon';
import { IconButton } from './icon-button';

/**
 * The diff of a pull request, one file at a time, on @pierre/diffs (the
 * library DiffsHub runs on): Shiki's highlighting, unified or split, long
 * lines wrapped, hunks with their `@@` line, unchanged runs folded behind a
 * count, and comments in the gaps between lines.
 *
 * - `DiffFile`: one file — the sticky `DiffFileHeader` over its `DiffView`,
 *   and nothing under the header while it is collapsed.
 * - `DiffFileHeader`: the 44px bar: the fold chevron, the file's type mark,
 *   the path with its folder muted, how many comments it carries, its
 *   `DiffStat`, and Viewed, a toggle the reader ticks off file by file.
 * - `DiffView`: the lines. `patch` is the file's unified diff, as git and
 *   GitHub hand it over. A comment is an annotation on one side of one line
 *   (`{ side: 'additions', lineNumber: 87 }`) that `renderAnnotation` draws,
 *   usually as a `DiffComment` or a `DiffCommentDraft`; hovering a line's
 *   number offers the blue + that `onCommentLine` answers.
 * - `DiffComment` / `DiffCommentDraft`: a comment in the gap, the review
 *   agent's (the bot glyph) or a person's (their avatar), and the field for
 *   a new one.
 *
 * The colours are the system's: the code on the card, additions and
 * deletions as a wash of the success and danger hues with a 3px bar, the
 * gutter numbers subtle. `colorScheme` is the app's resolved theme (the
 * kit's `useTheme().resolvedTheme`), so the code follows the app's switch,
 * not the OS.
 */

type DiffLayout = 'unified' | 'split';

/** A comment's place: one side of one line, with what the caller draws there. The library's own type. */
type DiffAnnotation<T> = DiffLineAnnotation<T>;

/** The library's custom properties, pointed at the tokens. */
const DIFF_TOKENS = {
  '--diffs-font-family': 'var(--font-mono)',
  '--diffs-header-font-family': 'var(--font-sans)',
  '--diffs-font-size': '12.5px',
  '--diffs-line-height': '20px',
  '--diffs-bg-context-override': 'var(--card)',
  '--diffs-bg-buffer-override': 'var(--card)',
  '--diffs-bg-separator-override': 'var(--hover-surface)',
  // The hues lines mix toward; the library sets how far for each theme.
  '--diffs-bg-addition-override': 'var(--success)',
  '--diffs-bg-deletion-override': 'var(--danger)',
  '--diffs-addition-color-override': 'var(--success)',
  '--diffs-deletion-color-override': 'var(--danger)',
  '--diffs-fg-number-override': 'var(--fg-subtle)',
  '--diffs-bg-hover-override': 'var(--hover-surface)',
  '--diffs-bg-selection-override': 'var(--selected-surface)',
  '--diffs-annotation-bg': 'var(--card)',
} as React.CSSProperties;

function DiffView<T>({
  patch,
  layout = 'unified',
  colorScheme,
  annotations,
  renderAnnotation,
  onCommentLine,
  className,
}: {
  /** One file's unified diff (`diff --git …` or just its `@@` hunks). */
  patch: string;
  layout?: DiffLayout;
  /** The app's resolved theme, from its theme owner, so the code's colours match it from the first paint. */
  colorScheme: 'light' | 'dark';
  annotations?: DiffAnnotation<T>[];
  renderAnnotation?: (annotation: DiffAnnotation<T>) => React.ReactNode;
  /** The + on a hovered line: the line (or range) to start a comment on. */
  onCommentLine?: (line: { side: 'additions' | 'deletions'; lineNumber: number; endLineNumber: number }) => void;
  className?: string;
}) {
  return (
    <div data-slot="diff-view" data-layout={layout} className={cn('min-w-0 bg-card', className)}>
      <PatchDiff<T>
        patch={patch}
        style={DIFF_TOKENS}
        lineAnnotations={annotations}
        renderAnnotation={renderAnnotation}
        disableWorkerPool
        options={{
          diffStyle: layout,
          theme: { light: 'pierre-light', dark: 'pierre-dark' },
          themeType: colorScheme,
          disableFileHeader: true,
          overflow: 'wrap',
          diffIndicators: 'classic',
          lineDiffType: 'word',
          hunkSeparators: 'line-info',
          // Split view leaves the missing side blank, as the frames do, not hatched.
          unsafeCSS: '[data-content-buffer]{background-image:none}',
          enableGutterUtility: Boolean(onCommentLine),
          onGutterUtilityClick: onCommentLine
            ? (range) =>
                onCommentLine({
                  side: range.side ?? 'additions',
                  lineNumber: Math.min(range.start, range.end),
                  endLineNumber: Math.max(range.start, range.end),
                })
            : undefined,
        }}
      />
    </div>
  );
}

function DiffFile({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="diff-file"
      className={cn('flex flex-col border-b border-border-subtle bg-card [overflow:clip]', className)}
      {...props}
    />
  );
}

function DiffFileHeader({
  path,
  additions,
  deletions,
  comments,
  tag,
  collapsed = false,
  onCollapsedChange,
  viewed = false,
  onViewedChange,
  labels = {},
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  path: string;
  additions: number;
  deletions: number;
  /** Comments on this file, mine and the agent's. */
  comments?: number;
  /** A word for the file's kind of change ("New", "Renamed"). */
  tag?: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  viewed?: boolean;
  onViewedChange?: (viewed: boolean) => void;
  labels?: { collapse?: string; expand?: string; viewed?: string; comments?: (n: number) => string };
}) {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  return (
    <div
      data-slot="diff-file-header"
      data-collapsed={collapsed || undefined}
      className={cn(
        'sticky top-0 z-2 flex min-h-11 items-center gap-2 border-b border-border-subtle bg-card pr-3 pl-2.5 data-collapsed:border-transparent',
        className,
      )}
      {...props}
    >
      <IconButton
        size="sm"
        aria-label={collapsed ? (labels.expand ?? 'Expand file') : (labels.collapse ?? 'Collapse file')}
        aria-expanded={!collapsed}
        onClick={() => onCollapsedChange?.(!collapsed)}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
      </IconButton>
      <FileIcon path={path} className="size-[15px]" />
      <button
        type="button"
        onClick={() => onCollapsedChange?.(!collapsed)}
        className="min-w-0 flex-1 truncate text-left font-mono text-xs text-fg outline-none focus-visible:underline"
        title={path}
      >
        <span className="text-fg-muted">{dir}</span>
        {name}
      </button>
      {tag ? (
        <span className="inline-flex h-5 shrink-0 items-center rounded-pill bg-hover-surface px-2 text-micro text-fg-muted">
          {tag}
        </span>
      ) : null}
      {comments ? (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-fg-muted"
          title={labels.comments?.(comments) ?? `${comments} comments`}
        >
          <MessageSquareIcon className="size-3" aria-hidden />
          <span className="figures">{comments}</span>
        </span>
      ) : null}
      <DiffStat additions={additions} deletions={deletions} />
      <button
        type="button"
        aria-pressed={viewed}
        onClick={() => onViewedChange?.(!viewed)}
        className="group/viewed flex h-7 shrink-0 items-center gap-[7px] rounded-pill px-2.5 text-xs text-fg-muted outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className="flex size-[15px] items-center justify-center rounded-xs border-[1.5px] border-border-strong text-background group-aria-pressed/viewed:border-success group-aria-pressed/viewed:bg-success"
        >
          {viewed ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
        </span>
        {labels.viewed ?? 'Viewed'}
      </button>
    </div>
  );
}

/**
 * A comment between two lines: who wrote it (the bot glyph for the review
 * agent, an avatar for a person), where it stands ("Pending, posts with your
 * review"), its one action, and the text. On the hover wash, 640px at most,
 * indented to the code.
 */
function DiffComment({
  author,
  avatar,
  bot = false,
  status,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  author: React.ReactNode;
  /** A person's `Avatar`; the review agent takes the bot glyph instead. */
  avatar?: React.ReactNode;
  bot?: boolean;
  status?: React.ReactNode;
  /** Discard, Resolve: a ghost `Button`. */
  action?: React.ReactNode;
}) {
  return (
    <div data-slot="diff-comment" className={cn('px-4 py-2 font-sans', className)} {...props}>
      <div className="flex max-w-160 flex-col gap-1.5 rounded-md bg-hover-surface px-3.5 py-3">
        <div className="flex items-center gap-2 text-xs">
          {bot ? <BotIcon className="size-[13px] shrink-0 text-fg-muted" aria-hidden /> : avatar}
          <span className="font-medium text-fg">{author}</span>
          {status ? (
            <>
              <span aria-hidden className="text-fg-subtle">
                ·
              </span>
              <span className="min-w-0 truncate text-fg-muted">{status}</span>
            </>
          ) : null}
          <span className="flex-1" />
          {action}
        </div>
        <div className="text-[13.5px] leading-normal text-pretty whitespace-pre-wrap text-fg">{children}</div>
      </div>
    </div>
  );
}

/**
 * Writing a comment on a line: the person's avatar, the field (three lines,
 * the focus ring), and its actions — add to the pending review (the
 * primary path, ⌘⏎), post it alone, or cancel.
 */
function DiffCommentDraft({
  value,
  onValueChange,
  onAddToReview,
  onAddSingle,
  onCancel,
  avatar,
  labels = {},
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onAddToReview: () => void;
  onAddSingle?: () => void;
  onCancel: () => void;
  avatar?: React.ReactNode;
  labels?: { placeholder?: string; addToReview?: string; addSingle?: string; hint?: string; cancel?: string };
  className?: string;
}) {
  const empty = value.trim() === '';
  return (
    <div data-slot="diff-comment-draft" className={cn('bg-card px-4 py-2.5 font-sans', className)}>
      <div className="flex max-w-160 items-start gap-2.5">
        {avatar ? <span className="mt-1.5 shrink-0">{avatar}</span> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <CommentField
            rows={3}
            value={value}
            onValueChange={onValueChange}
            placeholder={labels.placeholder ?? 'Leave a comment'}
            // biome-ignore lint/a11y/noAutofocus: the field opens because the reader asked to comment.
            autoFocus
            onSubmit={onAddToReview}
            onCancel={onCancel}
            canSubmit={!empty}
            className="min-h-19 bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={empty} onClick={onAddToReview}>
              {labels.addToReview ?? 'Add to review'}
            </Button>
            {onAddSingle ? (
              <Button variant="ghost" size="sm" disabled={empty} onClick={onAddSingle}>
                {labels.addSingle ?? 'Add single comment'}
              </Button>
            ) : null}
            <span className="flex-1" />
            <span className="text-xs text-fg-subtle">{labels.hint ?? '⌘⏎ adds to review'}</span>
            <IconButton size="sm" aria-label={labels.cancel ?? 'Cancel'} onClick={onCancel}>
              <XIcon />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A comment as a way into the diff, in a list away from it (Pending
 * comments on the briefing): the file's mark and `path:line` in the link
 * blue, mono, over the comment's text. The whole tile is the button.
 */
function DiffCommentLink({
  path,
  line,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { path: string; line?: number }) {
  return (
    <button
      type="button"
      data-slot="diff-comment-link"
      className={cn(
        'flex w-full flex-col items-start gap-1.5 rounded-md bg-hover-surface px-3.5 py-3 text-left outline-none transition-colors duration-instant ease-standard hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span className="flex max-w-full min-w-0 items-center gap-1.5">
        <FileIcon path={path} className="size-3.5" />
        <span className="figures truncate text-micro text-link">
          {path}
          {line !== undefined ? `:${line}` : ''}
        </span>
      </span>
      <span className="line-clamp-2 text-[13px] leading-[1.45] text-pretty text-fg">{children}</span>
    </button>
  );
}

export { DiffComment, DiffCommentDraft, DiffCommentLink, DiffFile, DiffFileHeader, DiffView };
export type { DiffAnnotation, DiffLayout };
