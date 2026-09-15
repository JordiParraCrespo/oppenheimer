import { cn } from '@oppenheimer/design-system-web';

/**
 * The heading block every workspace page opens with: 24px title, a line of
 * secondary copy, and an optional action parked on the right.
 */
export function PageHead({
  title,
  sub,
  action,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-60 flex-[1_1_320px]">
        <h1 className="mb-1.5 font-sans text-2xl font-medium text-ink-900">{title}</h1>
        {sub && <p className="text-base text-pretty text-ink-600">{sub}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
