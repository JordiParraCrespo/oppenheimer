import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Callout — a note in the flow, not a card: a flat tonal fill on a 14px
 * radius, no hairline, 13px text, a glyph in front. It never outweighs the
 * form it sits above and never carries a button; if an action is needed, the
 * action lives in the form. `neutral` is the default and carries no hue,
 * because most notes are explanations, not state. The four tinted tones take
 * a status hue at 11–14% behind full-opacity ink, and only when something
 * actually is in that state.
 *
 * ```tsx
 * <Callout tone="warning">This host has been unreachable for 6 minutes. Sessions on it are paused.</Callout>
 * ```
 */
type CalloutTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<CalloutTone, { box: string; icon: string; text: string; glyph: React.ReactNode }> = {
  neutral: { box: 'bg-hover-surface', icon: 'text-fg-subtle', text: 'text-fg-muted', glyph: <InfoIcon /> },
  info: { box: 'bg-info-surface', icon: 'text-info', text: 'text-fg', glyph: <InfoIcon /> },
  success: { box: 'bg-success-surface', icon: 'text-success', text: 'text-fg', glyph: <CircleCheckIcon /> },
  warning: { box: 'bg-warning-surface', icon: 'text-warning', text: 'text-fg', glyph: <TriangleAlertIcon /> },
  danger: { box: 'bg-danger-surface', icon: 'text-danger', text: 'text-fg', glyph: <CircleXIcon /> },
};

function Callout({
  tone = 'neutral',
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  tone?: CalloutTone;
  /** Replaces the tone's glyph; `null` renders none. */
  icon?: React.ReactNode | null;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'note'}
      data-slot="callout"
      data-tone={tone}
      className={cn('flex gap-[9px] rounded-md px-[13px] py-[11px]', t.box, className)}
      {...props}
    >
      {icon === null ? null : (
        <span className={cn('mt-px flex shrink-0 [&_svg:not([class*=size-])]:size-[15px]', t.icon)} aria-hidden>
          {icon ?? t.glyph}
        </span>
      )}
      <p className={cn('m-0 text-[13px] leading-[1.45] text-pretty', t.text)}>{children}</p>
    </div>
  );
}

export { Callout };
export type { CalloutTone };
