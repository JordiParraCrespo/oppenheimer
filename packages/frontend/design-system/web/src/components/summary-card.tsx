import type * as React from 'react';

import { cn } from '../lib/utils';
import { Card } from './card';

/**
 * SummaryCard — facts a person checks before moving on: the Ready screen's
 * workspace, code and host. A Card of rows, hairlines between them, each a
 * muted 13px label on the left and a mono value on the right, baseline
 * aligned. Values are mono because they are things — an address, a host name,
 * a count — not prose.
 *
 * ```tsx
 * <SummaryCard>
 *   <SummaryRow label="Workspace">oppenheimer.dev/versio</SummaryRow>
 *   <SummaryRow label="Host">mac-studio · macOS 15</SummaryRow>
 * </SummaryCard>
 * ```
 */
function SummaryCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      data-slot="summary-card"
      className={cn('divide-y divide-border-subtle', className)}
      {...props}
    />
  );
}

function SummaryRow({
  label,
  mono = true,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  label: React.ReactNode;
  /** Off for a value that is a sentence rather than a thing. */
  mono?: boolean;
}) {
  return (
    <div
      data-slot="summary-row"
      className={cn('flex items-baseline justify-between gap-4 px-[18px] py-3.5', className)}
      {...props}
    >
      <span className="shrink-0 text-[13px] text-fg-muted">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-[13px] text-fg', mono && 'figures')}>
        {children}
      </span>
    </div>
  );
}

export { SummaryCard, SummaryRow };
