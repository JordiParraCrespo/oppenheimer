import { Chip, Skeleton } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * A `ChoiceRow` before its choices answer: the label written in the left
 * column at the field height, the choices that need no data written as
 * unpicked pills (`written`), and a pill bar for each one the read answers.
 * It owns the task form's row frame, the 96px label column and its gap, so a
 * row whose answer is not a choice (Sessions, Due) passes its bars as
 * `children` instead of copying the grid; `align` centres a one-line row.
 */
export function ChoiceRowSkeleton({
  label,
  written = [],
  widths = [],
  align = 'start',
  children,
}: {
  label: string;
  written?: readonly string[];
  widths?: readonly string[];
  align?: 'start' | 'center';
  children?: ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-[96px_1fr] gap-3 ${align === 'center' ? 'items-center' : 'items-start'}`}
    >
      <span className="flex h-(--control-h-md) items-center text-sm text-fg-muted">{label}</span>
      <div aria-hidden className="flex flex-wrap items-center gap-1.5">
        {children}
        {written.map((choice) => (
          <Chip key={choice} variant="solid" size="md">
            {choice}
          </Chip>
        ))}
        {widths.map((width, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: a pill's place is its identity.
            key={index}
            shape="pill"
            className={`h-(--control-h-md) ${width}`}
          />
        ))}
      </div>
    </div>
  );
}
