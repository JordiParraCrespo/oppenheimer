import { cn, StatDelta } from '@oppenheimer/design-system-web';
import { ArrowDownRight, ArrowUpRight } from '@oppenheimer/design-system-web/icons';
import type { VisualBlock, VisualNumberFormat } from '@oppenheimer/shared/schemas/visual';
import { useCountUp } from '../hooks/use-revealed';
import { formatVisualDelta, formatVisualNumber, keyed } from '../lib/visual-format';

type Metrics = Extract<VisualBlock, { type: 'metrics' }>;
type Metric = Metrics['items'][number];

/** A figure that counts up to its value the first time it is shown. */
function CountedFigure({ value, format }: { value: number; format?: VisualNumberFormat }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden>{formatVisualNumber(shown, format)}</span>
      <span className="sr-only">{formatVisualNumber(value, format)}</span>
    </>
  );
}

function MetricTile({ item, format }: { item: Metric; format?: VisualNumberFormat }) {
  const rising = (item.delta ?? 0) > 0;
  const good =
    item.delta === undefined || item.delta === 0 ? null : rising === (item.good !== 'down');
  const Arrow = rising ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      data-slot="visual-metric"
      className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-hover-surface/60 px-3.5 py-3 transition-colors duration-fast hover:bg-hover-surface"
    >
      <span className="truncate text-xs text-fg-muted">{item.label}</span>
      <span className="figures truncate text-[22px] leading-[1.1] font-medium tracking-[-0.015em] text-fg">
        {typeof item.value === 'number' ? (
          <CountedFigure value={item.value} format={format} />
        ) : (
          item.value
        )}
      </span>
      {item.delta !== undefined || item.hint ? (
        <StatDelta
          tone={good === null ? 'flat' : good ? 'good' : 'bad'}
          value={
            item.delta !== undefined ? (
              <span className="inline-flex items-center gap-0.5">
                {item.delta !== 0 ? <Arrow aria-hidden className="size-3" /> : null}
                {formatVisualDelta(item.delta, format)}
              </span>
            ) : null
          }
        >
          {item.hint ? <span className="truncate">{item.hint}</span> : null}
        </StatDelta>
      ) : null}
    </div>
  );
}

/** Up to eight headline figures as tiles: two across on a phone, up to four on a wide card. */
export function VisualMetrics({ block }: { block: Metrics }) {
  const count = block.items.length;
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2',
        count >= 3 && '@md/visual:grid-cols-3',
        (count === 4 || count >= 7) && '@xl/visual:grid-cols-4',
        count === 1 && 'grid-cols-1',
      )}
    >
      {keyed(block.items, (item) => item.label).map(({ item, key }) => (
        <MetricTile key={key} item={item} format={block.format} />
      ))}
    </div>
  );
}
