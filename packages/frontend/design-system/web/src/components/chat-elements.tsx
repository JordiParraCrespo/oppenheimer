'use client';

import { CheckIcon, CopyIcon, WrapTextIcon } from 'lucide-react';
import * as React from 'react';

import { useCopy } from '../hooks/use-copy';
import { useWideLines } from '../internal/use-wide-lines';
import { cn } from '../lib/utils';
import { IconButton } from './icon-button';
import { type JsonTreeAnnotate, JsonTree } from './json-tree';
import { SegmentedControl, SegmentedControlItem } from './segmented-control';

/**
 * The agent chat's smaller parts (AI Elements), for a bot's chat.
 *
 * - `ChatMarker`: a note between turns at 13px muted, its 14px glyph first
 *   and a mono figure after ("Context compacted 142k → 18k tokens",
 *   "Switched to GPT-5.2 Codex for the next turn"). A day boundary is a
 *   `TranscriptDivider`.
 * - `ChatSuggestions` + `ChatSuggestion`: next steps offered as 34px pills
 *   on a hairline, wrapping; one tap fills the composer.
 * - `ChatSources` + `ChatSource`: the pages a search found, numbered pills
 *   that open each page in a new tab.
 * - `ChatCodeBlock`: a fenced block in a reply, on the chat's grey wash at
 *   the 10px radius: the language in small mono over the code, Wrap and
 *   Copy at its end, then the code at 13.5px mono on 1.7, scrolling
 *   sideways until Wrap folds its long lines. Wrap is there only when a
 *   line is wider than the block.
 * - `ChatJsonBlock`: a fenced block that parses as JSON, the same block
 *   opening on the code as written, Raw / Tree on its band.
 */
function ChatMarker({
  icon,
  meta,
  className,
  children,
}: {
  icon?: React.ReactNode;
  /** A figure after the words, in mono ("142k → 18k tokens"). */
  meta?: React.ReactNode;
  className?: string;
  /** The note; a name in it (a model) takes full ink in a `strong`. */
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="chat-marker"
      className={cn(
        'flex items-center gap-2 text-[13px] text-fg-muted [&_strong]:font-normal [&_strong]:text-fg [&>svg]:size-3.5 [&>svg]:shrink-0',
        className,
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
      {meta ? <span className="figures font-mono text-[12px] text-fg-subtle">{meta}</span> : null}
    </div>
  );
}

function ChatSuggestions({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="chat-suggestions" className={cn('flex flex-wrap gap-2', className)} {...props} />;
}

function ChatSuggestion({ className, ...props }: Omit<React.ComponentProps<'button'>, 'type'>) {
  return (
    <button
      type="button"
      data-slot="chat-suggestion"
      className={cn(
        'inline-flex h-8.5 items-center gap-1.5 rounded-pill border border-border px-3.5 text-[13.5px] text-fg outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

function ChatSources({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="chat-sources" className={cn('flex flex-wrap gap-1.5', className)} {...props} />;
}

/**
 * One page a search found, as a pill: its number in mono, then its words
 * (the page's title or its domain), opening in a new tab.
 */
function ChatSource({
  index,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'a'>, 'target' | 'rel'> & { index: number }) {
  return (
    <a
      data-slot="chat-source"
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex h-6.5 max-w-80 items-center gap-1.5 rounded-pill bg-card px-2.5 text-[12.5px] text-fg no-underline outline-none transition-colors duration-instant hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <span className="figures shrink-0 font-mono text-[11px] text-fg-subtle">{index}</span>
      <span className="min-w-0 truncate">{children}</span>
    </a>
  );
}

type ChatCodeBlockLabels = { copy: string; copied: string; wrap: string; unwrap: string };

const CODE_LABELS: ChatCodeBlockLabels = { copy: 'Copy code', copied: 'Copied', wrap: 'Wrap lines', unwrap: 'Unwrap lines' };

/**
 * The band over a block: its language in small mono, the views it offers,
 * then Wrap (when the block offers it) and Copy at the end.
 */
function CodeBlockBand({
  code,
  language,
  labels,
  views,
  wrapped,
  onWrap,
}: {
  code: string;
  language: string | undefined;
  labels: Partial<ChatCodeBlockLabels> | undefined;
  views?: React.ReactNode;
  wrapped?: boolean;
  onWrap?: () => void;
}) {
  const label = { ...CODE_LABELS, ...labels };
  const { copied, copy } = useCopy(code);
  const wrapLabel = wrapped ? label.unwrap : label.wrap;
  return (
    <div className="flex items-center gap-0.5 pt-1.5 pr-1.5 pl-4">
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg-muted">{language || 'text'}</span>
      {views}
      {onWrap ? (
        <IconButton
          size="sm"
          aria-label={wrapLabel}
          aria-pressed={wrapped}
          title={wrapLabel}
          onClick={onWrap}
          className="text-fg-subtle aria-pressed:text-fg"
        >
          <WrapTextIcon />
        </IconButton>
      ) : null}
      <IconButton
        size="sm"
        aria-label={copied ? label.copied : label.copy}
        title={copied ? label.copied : label.copy}
        onClick={copy}
        className="text-fg-subtle"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </IconButton>
    </div>
  );
}

/** The code, scrolling sideways, or folding its long lines when `wrapped`. */
function PlainCode({
  code,
  wrapped,
  boxRef,
  children,
}: {
  code: string;
  wrapped?: boolean;
  /** The scrolling box, for a caller that measures its lines. */
  boxRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <div ref={boxRef} className="overflow-x-auto px-4 pt-1 pb-3.5 font-mono text-[13.5px] leading-[1.7]">
      <pre className={cn('m-0 font-mono text-fg', wrapped && 'break-normal whitespace-pre-wrap [overflow-wrap:anywhere]')}>
        <code>{children ?? code}</code>
      </pre>
    </div>
  );
}

function ChatCodeBlock({
  code,
  language,
  labels,
  className,
  children,
}: {
  /** The code as written: what Copy copies. */
  code: string;
  /** The fence's language, over the code; "text" when it names none. */
  language?: string;
  labels?: Partial<ChatCodeBlockLabels>;
  className?: string;
  /** The code drawn (highlighted spans); the text itself when left out. */
  children?: React.ReactNode;
}) {
  const [wrapped, setWrapped] = React.useState(false);
  const { ref, wide } = useWideLines<HTMLDivElement>(wrapped, code);
  return (
    <div data-slot="chat-code-block" className={cn('my-0.5 overflow-hidden rounded-sm bg-chat-wash', className)}>
      <CodeBlockBand
        code={code}
        language={language}
        labels={labels}
        wrapped={wrapped}
        onWrap={wide ? () => setWrapped(!wrapped) : undefined}
      />
      <PlainCode code={code} wrapped={wrapped} boxRef={ref}>
        {children}
      </PlainCode>
    </div>
  );
}

type ChatJsonBlockLabels = ChatCodeBlockLabels & { tree: string; raw: string };

/**
 * A fenced block that holds JSON, on the same wash as `ChatCodeBlock`: it
 * opens on the code as written and switches to a `JsonTree` of `value`
 * (Raw / Tree on its band). Copy always copies the code as written.
 */
function ChatJsonBlock({
  code,
  value,
  language,
  labels,
  annotate,
  moreLabel,
  className,
  children,
}: {
  /** The code as written: what Copy copies and what Raw shows. */
  code: string;
  /** The code parsed. */
  value: unknown;
  language?: string;
  labels?: Partial<ChatJsonBlockLabels>;
  /** A note after a leaf of the tree (`JsonTree`'s). */
  annotate?: JsonTreeAnnotate;
  /** The tree's button for the members past a level's first 200 (`JsonTree`'s). */
  moreLabel?: (count: number) => string;
  className?: string;
  /** The code drawn for Raw (highlighted spans); the text itself when left out. */
  children?: React.ReactNode;
}) {
  const label = { tree: 'Tree', raw: 'Raw', ...labels };
  const [view, setView] = React.useState<'tree' | 'raw'>('raw');
  return (
    <div data-slot="chat-json-block" className={cn('my-0.5 overflow-hidden rounded-sm bg-chat-wash', className)}>
      <CodeBlockBand
        code={code}
        language={language || 'json'}
        labels={labels}
        views={
          <SegmentedControl value={view} onValueChange={(next) => setView(next as 'tree' | 'raw')}>
            <SegmentedControlItem value="raw">{label.raw}</SegmentedControlItem>
            <SegmentedControlItem value="tree">{label.tree}</SegmentedControlItem>
          </SegmentedControl>
        }
      />
      {view === 'raw' ? (
        <PlainCode code={code}>{children}</PlainCode>
      ) : (
        <div className="overflow-x-auto px-3 pt-1 pb-3.5">
          <JsonTree value={value} annotate={annotate} moreLabel={moreLabel} />
        </div>
      )}
    </div>
  );
}

export { ChatCodeBlock, ChatJsonBlock, ChatMarker, ChatSource, ChatSources, ChatSuggestion, ChatSuggestions };
export type { ChatCodeBlockLabels, ChatJsonBlockLabels };
