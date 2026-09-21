import { cn } from '@oppenheimer/design-system-web';
import type * as React from 'react';

/**
 * A 180px label column beside a capped control column — the shape a settings
 * row takes in a form.
 *
 * What stood here was the whole settings vocabulary, ported from the starter's
 * CRM design: a head, a card, rows, row media, row controls, a card foot. The
 * console has no settings screen to build from them (the version-1 artboards
 * draw none, and the drawer `05-screens.md` describes is a later slice), and
 * every one of those shapes went out with the screens that used them. This is
 * the one the auth forms and the showcase still render.
 */
export function FieldRow({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="section-field" className={cn('flex items-start gap-6 p-[18px]', className)}>
      <div className="w-[180px] flex-none pt-2.5">
        <div className="text-base font-medium text-ink-900">{label}</div>
        {hint ? <div className="mt-[3px] text-xs leading-[1.45] text-ink-400">{hint}</div> : null}
      </div>
      <div className="min-w-0 max-w-[400px] flex-1">{children}</div>
    </div>
  );
}
