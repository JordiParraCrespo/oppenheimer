import type * as React from 'react';

/** One numbered step of linking by hand: a ringed number beside its line and what it offers. */
export function OwnerLinkStep({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-field text-[11px] font-medium text-fg-muted ring-1 ring-border-subtle"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[13px] leading-5 text-fg">{label}</span>
        {children}
      </div>
    </li>
  );
}
