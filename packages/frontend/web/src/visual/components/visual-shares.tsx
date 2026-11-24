import { ChartRow, cn, RingChart, StatBar } from '@oppenheimer/design-system-web';
import type { VisualBlock } from '@oppenheimer/shared/schemas/visual';
import { useTranslation } from 'react-i18next';
import { useRevealed } from '../hooks/use-revealed';
import { formatVisualNumber, keyed, seriesTone } from '../lib/visual-format';
import { VisualBlockTitle } from './visual-block-title';

type Ring = Extract<VisualBlock, { type: 'ring' }>;
type Ranking = Extract<VisualBlock, { type: 'ranking' }>;
type Progress = Extract<VisualBlock, { type: 'progress' }>;

const percent = (share: number) => `${Math.round(share)}%`;

/** Shares of a whole: the ring with the total in its middle, a row per segment beside it. */
export function VisualRing({ block }: { block: Ring }) {
  const { t } = useTranslation();
  const revealed = useRevealed();
  const total = block.segments.reduce((sum, s) => sum + s.value, 0);
  const segments = keyed(block.segments, (s) => s.label).map(({ item: s, key }, i) => ({
    key,
    label: s.label,
    // A ring drawn at zero first, so its arcs sweep round to their shares.
    value: revealed ? s.value : 0,
    tone: seriesTone(i),
  }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <div className="flex flex-col items-center gap-5 @md/visual:flex-row @md/visual:items-center">
        <RingChart
          size={132}
          className="[&_circle]:transition-[stroke-dasharray,stroke-dashoffset] [&_circle]:duration-700 [&_circle]:ease-out"
          segments={revealed ? segments : [{ key: 'empty', label: '', value: 1, tone: 'muted' }]}
          label={block.total ?? t('common.visual.total')}
          value={formatVisualNumber(total, {
            ...block.format,
            compact: block.format?.compact ?? total >= 10_000,
          })}
        />
        <div className="w-full min-w-0 flex-1">
          {keyed(block.segments, (s) => s.label).map(({ item: s, key }, i) => (
            <ChartRow
              key={key}
              tone={seriesTone(i)}
              label={s.label}
              value={formatVisualNumber(s.value, block.format)}
              share={total > 0 ? percent((s.value / total) * 100) : null}
              className="grid-cols-[minmax(0,1fr)_auto_44px] first:border-t-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ranked rows, largest first: a label, its value, and a bar for its share of the largest. */
export function VisualRanking({ block }: { block: Ranking }) {
  const revealed = useRevealed();
  const items = [...block.items].sort((a, b) => b.value - a.value);
  const top = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {keyed(items, (item) => item.label).map(({ item, key }, i) => (
          <li key={key} className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-2 text-[13px]">
              <span className="figures w-4 shrink-0 text-xs text-fg-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-fg">{item.label}</span>
              <span className="figures font-medium text-fg">
                {formatVisualNumber(item.value, block.format)}
              </span>
            </span>
            <StatBar
              track
              className="ml-6"
              segments={[{ share: revealed ? (item.value / top) * 100 : 0, tone: 'chart-1' }]}
            />
            {item.detail ? <span className="ml-6 text-xs text-fg-muted">{item.detail}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Each value against its target: the bar fills to its share, green once it is reached. */
export function VisualProgress({ block }: { block: Progress }) {
  const { t } = useTranslation();
  const revealed = useRevealed();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {keyed(block.items, (item) => item.label).map(({ item, key }) => {
          const target = item.target ?? 100;
          const share = Math.min(100, (item.value / target) * 100);
          const reached = item.value >= target;
          return (
            <li key={key} className="flex flex-col gap-1.5">
              <span className="flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-fg">{item.label}</span>
                <span className={cn('figures font-medium', reached ? 'text-success' : 'text-fg')}>
                  {item.target === undefined && !block.format
                    ? percent(share)
                    : formatVisualNumber(item.value, block.format)}
                </span>
                {item.target !== undefined ? (
                  <span className="figures text-xs text-fg-subtle">
                    {t('common.visual.progressOf', {
                      target: formatVisualNumber(target, block.format),
                    })}
                  </span>
                ) : null}
              </span>
              <StatBar
                track
                segments={[{ share: revealed ? share : 0, tone: reached ? 'success' : 'chart-1' }]}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
