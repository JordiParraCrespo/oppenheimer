'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';

/**
 * CodeBlock — a command or snippet a person copies: 12.5px SF Mono, wrapped,
 * with a small secondary "Copy" that reads "Copied" for a moment. On Add host
 * two sit side by side inside Cards: the install command and the prompt for
 * an AI agent. `title` is the card-style header; `note` is a muted line under
 * the code ("Paste into Claude Code or Codex already running on that machine.").
 *
 * `dim` marks a trailing span of the code as faint (the token in the agent
 * prompt) without changing what gets copied.
 *
 * `layout="panel"` is the Add host dialog's form: a tonal 10px panel at
 * 11.5px with a header band of its own — pill `tabs` on the left (Command,
 * Agent prompt) and one small ghost Copy on the right, a hairline under it,
 * then the code at a fixed height so switching tabs never moves the token
 * line under it. One block, two ways to read it, one Copy: the same block
 * opens from the composer's host chip and from Settings. Without `tabs` the
 * band holds Copy alone.
 *
 * `copyLabel` and `copiedLabel` default to English because the design system
 * carries no catalog. Any app that translates must pass its own — the defaults
 * are for the showcase, not for a product screen, where leaving them is how a
 * Spanish reader ends up with an English button.
 */
type CodeBlockTab = { value: string; label: React.ReactNode };

function CodeBlock({
  code,
  title,
  note,
  dim,
  layout = 'card',
  tabs,
  tab,
  onTabChange,
  maxLines,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  code: string;
  title?: React.ReactNode;
  note?: React.ReactNode;
  /** A trailing substring of `code` to render faint. */
  dim?: string;
  /** `card`: header row with a labelled Copy. `panel`: tonal panel with its own header band. */
  layout?: 'card' | 'panel';
  /** Panel only: the ways to read the block, as pill tabs in the band. The caller swaps `code`. */
  tabs?: CodeBlockTab[];
  tab?: string;
  onTabChange?: (value: string) => void;
  /**
   * Cap the visible code at roughly this many lines and scroll past it.
   *
   * Uncapped by default, because most snippets are a line or two. A block
   * whose length the caller does not control — anything the server composes —
   * passes this, or one long answer sets the height of every card beside it.
   * Nothing is hidden: the region scrolls, and Copy takes the whole text
   * either way.
   */
  maxLines?: number;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied: the text is still selectable.
    }
  }

  const head = dim && code.endsWith(dim) ? code.slice(0, -dim.length) : code;
  const tail = dim && code.endsWith(dim) ? dim : null;

  // Expressed in `em` against the block's own leading, so the cap tracks the
  // type scale instead of hard-coding a pixel height that drifts from it.
  // biome-ignore lint/style/useNamingConvention: a CSS custom property
  const capStyle = maxLines ? ({ '--code-max-lines': maxLines } as React.CSSProperties) : undefined;

  if (layout === 'panel') {
    return (
      <div
        data-slot="code-block"
        data-layout="panel"
        className={cn('min-w-0 overflow-hidden rounded-sm bg-hover-surface text-left', className)}
        {...props}
      >
        <div
          data-slot="code-block-band"
          className="flex items-center justify-between gap-2.5 border-b border-border-subtle p-1.5"
        >
          {tabs && tabs.length > 0 ? (
            <div role="tablist" aria-label="Format" className="flex gap-0.5">
              {tabs.map((option) => {
                const selected = option.value === tab;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    data-slot="code-block-tab"
                    onClick={() => onTabChange?.(option.value)}
                    className={cn(
                      'rounded-pill px-2.5 py-1 text-xs leading-tight transition-colors duration-fast ease-standard outline-none focus-visible:outline-2 focus-visible:outline-primary',
                      selected ? 'bg-card text-fg' : 'text-fg-muted hover:text-fg',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            aria-live="polite"
            className={cn('w-[86px] shrink-0 justify-center gap-1.5', copied && 'text-success hover:text-success')}
          >
            {copied ? <CheckIcon strokeWidth={2.2} /> : <CopyIcon />}
            {copied ? copiedLabel : copyLabel}
          </Button>
        </div>
        <pre
          // biome-ignore lint/style/noInlineStyles: the cap is a caller-supplied number
          style={capStyle}
          className={cn(
            'm-0 p-3 font-mono text-[11.5px] leading-[1.7] break-normal whitespace-pre-wrap text-fg [overflow-wrap:anywhere]',
            tabs ? 'h-24 overflow-y-auto' : 'min-h-[76px]',
            maxLines && 'max-h-[calc(var(--code-max-lines)*1.7em)] overflow-y-auto',
          )}
        >
          <code>
            {head}
            {tail ? <span className="text-fg-subtle">{tail}</span> : null}
          </code>
        </pre>
        {note ? <p className="px-3 pb-3 text-xs leading-snug text-fg-muted">{note}</p> : null}
      </div>
    );
  }

  return (
    <div
      data-slot="code-block"
      data-layout="card"
      className={cn('flex min-w-0 flex-col gap-3 text-left', className)}
      {...props}
    >
      {(title || copyLabel) && (
        <div className="flex items-center justify-between gap-3">
          {title ? <span className="text-sm font-medium text-fg">{title}</span> : <span />}
          <Button
            variant="secondary"
            size="sm"
            onClick={copy}
            aria-live="polite"
            className="-my-1"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? copiedLabel : copyLabel}
          </Button>
        </div>
      )}
      <pre
        // biome-ignore lint/style/noInlineStyles: the cap is a caller-supplied number
        style={capStyle}
        className={cn(
          'm-0 font-mono text-[12.5px] leading-[1.55] break-normal whitespace-pre-wrap text-fg [overflow-wrap:anywhere]',
          maxLines && 'max-h-[calc(var(--code-max-lines)*1.55em)] overflow-y-auto',
        )}
      >
        <code>
          {head}
          {tail ? <span className="text-fg-subtle">{tail}</span> : null}
        </code>
      </pre>
      {note ? <p className="text-xs leading-snug text-fg-muted">{note}</p> : null}
    </div>
  );
}

export { CodeBlock };
export type { CodeBlockTab };
