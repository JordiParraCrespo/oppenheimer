import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  cn,
  StatBar,
} from '@oppenheimer/design-system-web';
import { ArrowUpRight, Check } from '@oppenheimer/design-system-web/icons';
import type { VisualBlock, VisualTone } from '@oppenheimer/shared/schemas/visual';
import { useTranslation } from 'react-i18next';
import { useRevealed } from '../hooks/use-revealed';
import { keyed } from '../lib/visual-format';
import { VisualBlockTitle } from './visual-block-title';

type Checklist = Extract<VisualBlock, { type: 'checklist' }>;
type RecordBlock = Extract<VisualBlock, { type: 'record' }>;
type Callout = Extract<VisualBlock, { type: 'callout' }>;
type Links = Extract<VisualBlock, { type: 'links' }>;

/** Items done and to do, with how many are done and a bar for it over the list. */
export function VisualChecklist({ block }: { block: Checklist }) {
  const { t } = useTranslation();
  const revealed = useRevealed();
  const done = block.items.filter((item) => item.done).length;
  const total = block.items.length;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <VisualBlockTitle>{block.title}</VisualBlockTitle>
        <span className={cn('figures text-xs', done === total ? 'text-success' : 'text-fg-muted')}>
          {t('common.visual.checklistDone', { done, total })}
        </span>
      </div>
      <StatBar
        track
        segments={[
          {
            share: revealed ? (done / total) * 100 : 0,
            tone: done === total ? 'success' : 'chart-1',
          },
        ]}
      />
      <ul className="m-0 flex list-none flex-col p-0">
        {keyed(block.items, (item) => item.text).map(({ item, key }, i) => (
          <li
            key={key}
            className="flex items-start gap-2.5 border-t border-border-subtle py-2 first:border-t-0 motion-safe:animate-appear-fast"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <span
              aria-hidden
              className={cn(
                'mt-px flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                item.done ? 'border-success bg-success text-background' : 'border-border-default',
              )}
            >
              {item.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  'text-[13px]',
                  item.done ? 'text-fg-muted line-through decoration-fg-subtle/60' : 'text-fg',
                )}
              >
                <span className="sr-only">{item.done ? '✓ ' : '○ '}</span>
                {item.text}
              </span>
              {item.note ? <span className="text-xs text-fg-subtle">{item.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_BADGE: Record<VisualTone, 'neutral' | 'active' | 'paused' | 'ended' | 'draft'> = {
  neutral: 'neutral',
  info: 'draft',
  success: 'active',
  warning: 'paused',
  danger: 'ended',
};

/** One thing's fields as a two-column sheet, its status as a pill beside the title. */
export function VisualRecord({ block }: { block: RecordBlock }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {block.title || block.status ? (
        <div className="flex items-center justify-between gap-3">
          <VisualBlockTitle>{block.title}</VisualBlockTitle>
          {block.status ? (
            <Badge variant={STATUS_BADGE[block.status.tone ?? 'neutral']}>
              {block.status.label}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <dl className="m-0 flex flex-col text-[13px]">
        {keyed(block.fields, (field) => field.label).map(({ item: field, key }) => (
          <div
            key={key}
            className="grid grid-cols-[minmax(6rem,32%)_minmax(0,1fr)] gap-x-4 border-t border-border-subtle py-2 first:border-t-0"
          >
            <dt className="text-fg-muted">{field.label}</dt>
            <dd className="m-0 break-words text-fg">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A note in the visual, in the tone the agent names; neutral by default. */
export function VisualCallout({ block }: { block: Callout }) {
  return (
    <Alert tone={block.tone ?? 'neutral'}>
      {block.title ? <AlertTitle>{block.title}</AlertTitle> : null}
      <AlertDescription>{block.text}</AlertDescription>
    </Alert>
  );
}

/** Links as rows: the label, where it goes, and what it is, each opening in a new tab. */
export function VisualLinks({ block }: { block: Links }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {keyed(block.items, (item) => item.url).map(({ item, key }) => {
          let host = item.url;
          try {
            host = new URL(item.url).host.replace(/^www\./, '');
          } catch {
            // The schema checked it; a URL the browser still refuses shows as written.
          }
          return (
            <li key={key}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group/link -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 no-underline transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium text-fg">{item.label}</span>
                  {item.description ? (
                    <span className="text-xs text-fg-muted">{item.description}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-fg-subtle">
                  {host}
                  <ArrowUpRight
                    aria-hidden
                    className="size-3 transition-transform duration-fast group-hover/link:-translate-y-px group-hover/link:translate-x-px"
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
