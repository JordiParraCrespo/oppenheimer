import type { ReactNode } from 'react';

/**
 * One of Share's settings on a line: its glyph on a quiet square, what it is
 * over what the current choice means, and the control that changes it at
 * the end.
 */
export function ShareSettingRow({
  icon,
  label,
  hint,
  control,
}: {
  icon: ReactNode;
  label: string;
  hint?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-hover-surface text-fg-muted [&_svg]:size-3.5"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[13px] text-fg">{label}</span>
        {hint ? <span className="truncate text-[12px] text-fg-subtle">{hint}</span> : null}
      </span>
      {control}
    </div>
  );
}
