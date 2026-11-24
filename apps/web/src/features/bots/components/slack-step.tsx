import type * as React from 'react';

/** One numbered step: a ringed number beside its line, a hint under it, and what it offers. */
export function SlackStep({
  n,
  label,
  hint,
  children,
}: {
  n: number;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-field text-micro font-medium text-fg-muted ring-1 ring-border-subtle"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg">{label}</span>
          {hint ? <span className="text-xs leading-4.5 text-fg-muted">{hint}</span> : null}
        </div>
        {children}
      </div>
    </li>
  );
}
