import { IconButton, Skeleton } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** This chat's figures that every chat has, with the widths their values run to. */
const FIGURES = [
  { key: 'active', width: 'w-10' },
  { key: 'turns', width: 'w-5' },
  { key: 'cacheHit', width: 'w-7' },
  { key: 'tokens', width: 'w-9' },
] as const;

/** A figure's cell or a breakdown's line, as `BotUsageReport` rules them. */
const ROW = 'flex items-baseline gap-2 border-b border-border-subtle py-1';

/**
 * The usage card before it answers, as `BotUsageReport` draws it: its title
 * and Close, which needs nothing to work; this chat's figures labelled on the
 * report's own grid and the breakdown's four lines, the numbers as bars.
 */
export function BotUsageSkeleton({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const bar = (width: string) => (
    <span className="flex h-4 shrink-0 items-center self-center">
      <Skeleton shape="sm" className={`h-2 ${width}`} />
    </span>
  );
  return (
    <div aria-busy className="flex flex-col gap-3 text-[12px]">
      <LoadingStatus />
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
        <IconButton size="xs" shape="square" aria-label={t('common.close')} onClick={onClose}>
          <X aria-hidden />
        </IconButton>
      </div>
      <section aria-hidden className="flex flex-col">
        <h4 className="pb-0.5 font-medium">{t('bots.chat.usage.thisChat')}</h4>
        <div className="grid grid-cols-[repeat(3,auto)]">
          {FIGURES.map(({ key, width }) => (
            <div key={key} className={`${ROW} min-w-0 pr-3 text-fg-muted`}>
              <span className="truncate">{t(`bots.chat.usage.${key}`)}</span>
              {bar(width)}
            </div>
          ))}
        </div>
      </section>
      <section aria-hidden className="flex flex-col">
        <div className="flex items-baseline justify-between gap-3 pb-0.5">
          <h4 className="font-medium">{t('bots.chat.usage.breakdown')}</h4>
          {bar('w-20')}
        </div>
        {[
          t('bots.chat.usage.input'),
          t('bots.chat.usage.output'),
          t('bots.chat.usage.cacheRead'),
          t('bots.chat.usage.cacheWrite'),
        ].map((label) => (
          <div key={label} className={`${ROW} justify-between text-fg-muted`}>
            <span>{label}</span>
            {bar('w-10')}
          </div>
        ))}
      </section>
    </div>
  );
}
