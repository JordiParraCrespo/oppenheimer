import { ArrowLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Link } from './link';

/**
 * StepHeader — the opening of every onboarding step: an eyebrow row with a
 * Back link, a 12px hairline and the mono counter ("2 OF 4"), then the 38px
 * display title and the muted 15px lead. Three screens render it identically
 * (CreateWorkspace, ConnectGitHub, AddHost); Ready reuses the title and lead
 * with no eyebrow row.
 *
 * `back` is a `Link`, because it navigates: pass `href` or a router `render`.
 *
 * ```tsx
 * <StepHeader step={2} total={4} back={{ href: '/sign-in' }} title="Name your workspace">
 *   A workspace holds your hosts, repositories and run history.
 * </StepHeader>
 * ```
 */
function StepHeader({
  step,
  total,
  back,
  backLabel = 'Back',
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
  step?: number;
  total?: number;
  /** Props for the Back `Link`; omit for no back link. */
  back?: React.ComponentProps<typeof Link>;
  backLabel?: string;
  title: React.ReactNode;
}) {
  const counter = step !== undefined && total !== undefined;
  return (
    <header data-slot="step-header" className={cn('flex flex-col', className)} {...props}>
      {back || counter ? (
        <div data-slot="step-header-eyebrow" className="flex items-center gap-3.5">
          {back ? (
            <Link
              muted
              {...back}
              className={cn(
                'eyebrow flex items-center gap-1.5 text-fg-muted no-underline hover:text-fg hover:no-underline',
                back.className,
              )}
            >
              <ArrowLeftIcon className="size-3.5" />
              {backLabel}
            </Link>
          ) : null}
          {back && counter ? <span aria-hidden className="h-3 w-px bg-border-subtle" /> : null}
          {counter ? (
            <span className="eyebrow text-fg-subtle">
              {step} of {total}
            </span>
          ) : null}
        </div>
      ) : null}
      <h1
        data-slot="step-header-title"
        className={cn(
          'font-display text-[38px] leading-[1.1] font-semibold tracking-[-0.024em] text-fg',
          (back || counter) && 'mt-2.5',
        )}
      >
        {title}
      </h1>
      {children ? (
        <p
          data-slot="step-header-lead"
          className="mt-2.5 text-[15px] leading-normal text-pretty text-fg-muted"
        >
          {children}
        </p>
      ) : null}
    </header>
  );
}

export { StepHeader };
