'use client';

import { LoaderIcon, MicIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * The chat composer's extras (Chat Components, Composer; Bots' foot row).
 *
 * - `VoiceRecorderBar`: while dictating, the composer's foot gives way to
 *   the recorder: a waveform growing in from the right over a dashed
 *   midline, the elapsed time in mono, cancel and the blue stop. Before the
 *   microphone answers it says so; after, "Transcribing…".
 * - `DictationButton`: the mic, a 30px square, on the danger surface while
 *   it records. Every field that takes dictation shows this one.
 * - `DictationFrame`: a plain multi-line field that takes dictation: the
 *   field with the mic in its bottom-right corner (the field keeps room for
 *   it on the right), and the recorder under it while dictating.
 * - `ComposerContextMeter`: how full the model's context is, a 28px pill in
 *   mono with a 28×4 bar and the share; a click compacts the thread.
 * - `ComposerMenu`: what opens above the composer while typing `/` or `@`,
 *   or from the + button: groups under 11px eyebrows, 32px rows of a glyph,
 *   the name, a line and a trailing mono hint (the command, a shortcut).
 */
function VoiceRecorderBar({
  state = 'recording',
  levels = [],
  elapsed,
  onCancel,
  onStop,
  labels,
  className,
}: {
  state?: 'waiting' | 'recording' | 'transcribing';
  /** The last levels, 0–1, oldest first; drawn from the right. */
  levels?: readonly number[];
  /** "0:07". */
  elapsed?: React.ReactNode;
  onCancel?: () => void;
  onStop?: () => void;
  labels?: { waiting?: string; transcribing?: string; cancel?: string; stop?: string };
  className?: string;
}) {
  if (state !== 'recording') {
    return (
      <div
        data-slot="voice-recorder-bar"
        data-state={state}
        role="status"
        className={cn('flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card py-2 pr-2 pl-3.5 text-[13px] text-fg-muted', className)}
      >
        <span className="flex flex-1 items-center gap-1.5">
          <LoaderIcon aria-hidden className="size-3.5 motion-safe:animate-spin" />
          {state === 'waiting' ? (labels?.waiting ?? 'Waiting for microphone…') : null}
        </span>
        {state === 'transcribing' ? (
          <span className="font-mono text-[12px]">{labels?.transcribing ?? 'Transcribing…'}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div
      data-slot="voice-recorder-bar"
      data-state="recording"
      className={cn('flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card py-2 pr-2 pl-3.5', className)}
    >
      <div aria-hidden className="relative flex h-7 min-w-0 flex-1 items-center overflow-hidden">
        <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="relative ml-auto flex h-full items-center gap-0.5">
          {levels.map((level, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a level's place is its time.
              key={i}
              className="w-0.5 rounded-[1px] bg-fg"
              // biome-ignore lint/style/noInlineStyles: the bar's height is the level.
              style={{ height: `${Math.max(8, Math.round(level * 100))}%` }}
            />
          ))}
        </div>
      </div>
      {elapsed ? <span className="figures font-mono text-[12.5px] text-fg-muted">{elapsed}</span> : null}
      <button
        type="button"
        aria-label={labels?.cancel ?? 'Cancel voice recording'}
        onClick={onCancel}
        className="flex size-7 items-center justify-center rounded-pill bg-hover-surface text-fg outline-none transition-colors duration-fast hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={labels?.stop ?? 'Stop voice recording'}
        onClick={onStop}
        className="flex size-7 items-center justify-center rounded-pill bg-primary text-primary-foreground outline-none transition-colors duration-fast hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span aria-hidden className="size-2 rounded-[2px] bg-current" />
      </button>
    </div>
  );
}

function DictationButton({
  recording = false,
  onClick,
  labels,
  className,
}: {
  recording?: boolean;
  onClick: () => void;
  labels?: { dictate?: string; stop?: string };
  className?: string;
}) {
  return (
    <IconButton
      data-slot="dictation-button"
      aria-label={recording ? (labels?.stop ?? 'Stop recording') : (labels?.dictate ?? 'Dictate')}
      aria-pressed={recording}
      size="sm"
      shape="square"
      onClick={onClick}
      className={cn(
        'size-[30px]',
        recording && 'bg-danger-surface text-danger hover:bg-danger-surface hover:text-danger',
        className,
      )}
    >
      <MicIcon className="size-[15px]" />
    </IconButton>
  );
}

function DictationFrame({
  mic,
  recorder,
  children,
  className,
}: {
  /** The `DictationButton`; absent, the field is drawn as it is. */
  mic?: React.ReactNode;
  /** While dictating, the `VoiceRecorderBar` (and anything said about it), under the field. */
  recorder?: React.ReactNode;
  /** The field: a `Textarea`, or a component that draws one. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="dictation-frame" className={cn('flex flex-col gap-2', className)}>
      {/* The mic stands clear of the field's resize grip, in the bottom-right corner. */}
      <div className={cn('relative', mic && '[&_textarea]:pr-13')}>
        {children}
        {mic ? <div className="absolute right-4 bottom-1.5">{mic}</div> : null}
      </div>
      {recorder}
    </div>
  );
}

function ComposerContextMeter({
  value,
  onCompact,
  label,
  className,
}: {
  /** How full the context is, 0–100. */
  value: number;
  onCompact?: () => void;
  /** The title and accessible name ("23% of context used. Click to compact."). */
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const name = label ?? `${pct}% of context used${onCompact ? '. Click to compact.' : ''}`;
  return (
    <button
      type="button"
      data-slot="composer-context-meter"
      aria-label={name}
      title={name}
      disabled={!onCompact}
      onClick={onCompact}
      className={cn(
        'figures inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill px-2 font-mono text-[11.5px] text-fg-subtle outline-none transition-colors duration-fast enabled:hover:bg-hover-surface enabled:hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
        className,
      )}
    >
      <span aria-hidden className="h-1 w-7 overflow-hidden rounded-pill bg-hover-surface">
        <span
          className="block h-full bg-fg-muted transition-[width] duration-slow ease-standard"
          // biome-ignore lint/style/noInlineStyles: the fill is the share.
          style={{ width: `${pct}%` }}
        />
      </span>
      {pct}%
    </button>
  );
}

function ComposerMenu({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-menu"
      role="listbox"
      className={cn('flex flex-col rounded-md border border-border-subtle bg-card p-1 shadow-popover', className)}
      {...props}
    />
  );
}

function ComposerMenuGroup({
  label,
  className,
  children,
}: {
  label?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a listbox's group is a role, not an element.
    <div role="group" data-slot="composer-menu-group" className={cn('flex flex-col', className)}>
      {label ? (
        <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-fg-subtle uppercase first:pt-1.5">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ComposerMenuItem({
  icon,
  description,
  hint,
  mono = false,
  highlighted = false,
  disabled = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'role'> & {
  icon?: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing, mono: the command ("/plan"), a shortcut, a check. */
  hint?: React.ReactNode;
  /** The name in mono: a file. */
  mono?: boolean;
  /** The keyboard's place in the list. */
  highlighted?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      role="option"
      aria-selected={highlighted}
      aria-disabled={disabled || undefined}
      data-slot="composer-menu-item"
      data-highlighted={highlighted || undefined}
      className={cn(
        'flex h-8 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] text-fg hover:bg-hover-surface data-highlighted:bg-hover-surface aria-disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-fg-muted [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className={cn('shrink-0', mono ? 'font-mono text-[12.5px]' : 'font-medium', !description && 'flex-1 truncate')}>
        {children}
      </span>
      {description ? <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-muted">{description}</span> : null}
      {hint ? <span className="flex shrink-0 font-mono text-[11.5px] text-fg-subtle [&_svg]:size-3.5">{hint}</span> : null}
    </div>
  );
}

export {
  ComposerContextMeter,
  ComposerMenu,
  ComposerMenuGroup,
  ComposerMenuItem,
  DictationButton,
  DictationFrame,
  VoiceRecorderBar,
};
