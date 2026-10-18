import type * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';

const groupClass = 'flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-card';

/**
 * SettingsGroup — one card per group of settings, one row per setting:
 * the label and a one-line hint on the left, the control on the right,
 * hairlines between; on a box too narrow for both, the control goes under
 * the label. `SettingsSaveRow` appears at the foot only when
 * something changed (Discard, Save changes), and reads "Saved" for a
 * moment after. A `tone="danger"` group holds the one destructive setting
 * (Delete account) with its red button.
 *
 * `SettingsForm` is the same card as a `<form>`, for a group whose rows are
 * edited and saved together: the rows stay its direct children, so the
 * hairlines fall between them, and the save row's Save changes submits it.
 */
function SettingsGroup({ className, ...props }: React.ComponentProps<'section'>) {
  return <section data-slot="settings-group" className={cn(groupClass, className)} {...props} />;
}

function SettingsForm({ className, ...props }: React.ComponentProps<'form'>) {
  return <form data-slot="settings-group" className={cn(groupClass, className)} {...props} />;
}

function SettingsRow({
  label,
  hint,
  className,
  children,
  control = 'auto',
  ...props
}: React.ComponentProps<'div'> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /**
   * `auto` sizes the control column to what it holds (a button, a value);
   * `field` gives it the system's field width, shared by the inputs in it,
   * so every text field in a settings card lines up.
   */
  control?: 'auto' | 'field';
}) {
  return (
    <div
      data-slot="settings-row"
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-subtle px-5 py-4 first:border-t-0', className)}
      {...props}
    >
      <div className="wrap-lead flex flex-col gap-0.5">
        <span className="text-operate font-medium text-fg">{label}</span>
        {hint ? <span className="text-[13px] text-fg-muted">{hint}</span> : null}
      </div>
      {children ? (
        <div
          data-slot="settings-row-control"
          className={cn(
            'flex min-w-0 max-w-full shrink-0 items-center gap-2 text-sm text-fg-muted',
            control === 'field' && 'w-70 max-w-full *:min-w-0 *:flex-1',
          )}
        >
          {children}
        </div>
      ) : null}
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

/**
 * SettingsListRow — one record in a settings card rather than one setting:
 * a revision, a learned fact, a connector, a thread between bots. `lead` is
 * what sits first (who made it, as a 22px pill: "You", "Release Bot");
 * then the text at 14px over a `meta` line in 12px subtle, where `kind`
 * is an 18px tag on the hover wash ("Preference", "Repo", "Key ending in
 * wzKr") that never wraps, and the meta wraps in the room it leaves. `actions` hold
 * what the row does (Revert, edit and delete icon buttons, a `Switch`), or a
 * word in their place ("Current"). `muted` is a record the bot can read but
 * not change (a fact shared from another bot). An edit in place passes the
 * field as `children` instead of the text.
 */
function SettingsListRow({
  lead,
  meta,
  kind,
  actions,
  muted = false,
  align = 'start',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  kind?: React.ReactNode;
  actions?: React.ReactNode;
  muted?: boolean;
  /** `center` for a one-line record with a control (a connector and its switch). */
  align?: 'start' | 'center';
}) {
  return (
    <div
      data-slot="settings-list-row"
      data-muted={muted || undefined}
      className={cn(
        'flex min-h-13 gap-3 border-t border-border-subtle py-3 pr-3 pl-5 first:border-t-0',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
      {...props}
    >
      {lead ? (
        <span className="inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-pill bg-hover-surface px-2 text-[12px] text-fg-muted">
          {lead}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('text-[14px] leading-[1.45] text-pretty', muted ? 'text-fg-muted' : 'text-fg')}>{children}</span>
        {meta || kind ? (
          <span className="flex items-start gap-2 text-[12px] text-fg-subtle">
            {kind ? (
              <span className="inline-flex h-4.5 shrink-0 items-center whitespace-nowrap rounded-xs bg-hover-surface px-1.5 text-fg-muted">
                {kind}
              </span>
            ) : null}
            {meta ? <span className="min-w-0 flex-1 leading-4.5">{meta}</span> : null}
          </span>
        ) : null}
      </span>
      {actions ? <span className="flex shrink-0 items-center gap-1 self-center text-[12.5px] text-fg-subtle">{actions}</span> : null}
    </div>
  );
}

/**
 * SettingsAddRow — the last row of a list card, where a record is added:
 * a borderless 32px field at 14px (mono for a URL) and Add, off until
 * `canAdd`. Enter adds too.
 */
function SettingsAddRow({
  value,
  onValueChange,
  onAdd,
  canAdd: canAddProp,
  placeholder,
  mono = false,
  addLabel = 'Add',
  'aria-label': ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  canAdd?: boolean;
  placeholder?: string;
  mono?: boolean;
  addLabel?: string;
  'aria-label': string;
  className?: string;
}) {
  const canAdd = canAddProp ?? value.trim() !== '';
  return (
    <div
      data-slot="settings-add-row"
      className={cn('flex items-center gap-2 border-t border-border-subtle py-3 pr-3 pl-5 first:border-t-0', className)}
    >
      <input
        type="text"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && canAdd) {
            event.preventDefault();
            onAdd();
          }
        }}
        className={cn(
          'h-8 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-fg outline-none placeholder:text-field-placeholder',
          mono && 'font-mono text-[13px]',
        )}
      />
      <Button variant="secondary" size="sm" disabled={!canAdd} onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}

export {
  SettingsAddRow,
  SettingsForm,
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  SettingsRow,
  SettingsSaveRow,
};
