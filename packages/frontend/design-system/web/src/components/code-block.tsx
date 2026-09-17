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
 */
function CodeBlock({
  code,
  title,
  note,
  dim,
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

  return (
    <div
      data-slot="code-block"
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
      <pre className="m-0 font-mono text-[12.5px] leading-[1.55] break-words whitespace-pre-wrap text-fg">
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
