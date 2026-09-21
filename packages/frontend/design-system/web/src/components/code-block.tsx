'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { IconButton } from './icon-button';

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
 * 11.5px, no header, and an icon-only copy in the corner that flips to a green
 * check for a moment. Same copy logic, second layout.
 *
 * `copyLabel` and `copiedLabel` default to English because the design system
 * carries no catalog. Any app that translates must pass its own — the defaults
 * are for the showcase, not for a product screen, where leaving them is how a
 * Spanish reader ends up with an English button.
 */
function CodeBlock({
  code,
  title,
  note,
  dim,
  layout = 'card',
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
  /** `card`: header row with a labelled Copy. `panel`: tonal panel, corner icon copy. */
  layout?: 'card' | 'panel';
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
        className={cn('relative min-w-0 rounded-sm bg-hover-surface text-left', className)}
        {...props}
      >
        <IconButton
          aria-label={copied ? copiedLabel : copyLabel}
          aria-live="polite"
          size="sm"
          onClick={copy}
          className={cn('absolute top-1.5 right-1.5', copied && 'text-success hover:text-success')}
        >
          {copied ? <CheckIcon strokeWidth={2.2} /> : <CopyIcon />}
        </IconButton>
        <pre
          // biome-ignore lint/style/noInlineStyles: the cap is a caller-supplied number
          style={capStyle}
          className={cn(
            'm-0 min-h-[76px] py-3 pr-10 pl-3 font-mono text-[11.5px] leading-[1.7] break-normal whitespace-pre-wrap text-fg [overflow-wrap:anywhere]',
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
