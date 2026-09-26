import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsGroup — one card per group of settings, one row per setting:
 * the label and a one-line hint on the left, the control on the right,
 * hairlines between. `SettingsSaveRow` appears at the foot only when
 * something changed (Discard, Save changes), and reads "Saved" for a
 * moment after. A `tone="danger"` group holds the one destructive setting
 * (Delete account) with its red button.
 */
function SettingsGroup({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="settings-group"
      className={cn('flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-card', className)}
      {...props}
    />
  );
}

function SettingsRow({
  label,
  hint,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div
      data-slot="settings-row"
      className={cn('flex items-center gap-4 border-t border-border-subtle px-5 py-4 first:border-t-0', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        {hint ? <span className="text-[13px] text-fg-muted">{hint}</span> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2 text-sm text-fg-muted">{children}</div> : null}
    </div>
  );
}

function SettingsSaveRow({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="settings-save-row"
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3 text-[13px] text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

/** The 17px heading over a group ("Account"). */
function SettingsHeading({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="settings-heading"
      className={cn('m-0 px-1 text-[17px] font-semibold tracking-[-0.012em] text-fg', className)}
      {...props}
    />
  );
}

export { SettingsGroup, SettingsHeading, SettingsRow, SettingsSaveRow };
