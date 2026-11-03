import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** This chat's first row of figures, at the widths they run to. */
const FIGURES = [
  { key: 'active', width: 'w-20' },
  { key: 'turns', width: 'w-12' },
  { key: 'cache', width: 'w-16' },
];

/**
 * The usage card before it answers: its title and headings as they read,
 * a row of figures and the breakdown's four lines, the numbers as bars.
 */
export function BotUsageSkeleton() {
  const { t } = useTranslation();
  const row = 'flex items-center gap-2 border-b border-border-subtle py-1';
  const bar = (width: string) => (
    <span className="flex h-4 items-center">
      <Skeleton shape="sm" className={`h-2 ${width}`} />
    </span>
  );
  return (
    <div aria-busy className="flex flex-col gap-3 text-[12px]">
      <LoadingStatus />
      <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
      <section aria-hidden className="flex flex-col">
        <h4 className="pb-0.5 font-medium">{t('bots.chat.usage.thisChat')}</h4>
        <div className="grid grid-cols-3">
          {FIGURES.map(({ key, width }) => (
            <div key={key} className={`${row} pr-3`}>
              {bar(width)}
            </div>
          ))}
        </div>
      </section>
      <section aria-hidden className="flex flex-col">
        <h4 className="pb-0.5 font-medium">{t('bots.chat.usage.breakdown')}</h4>
        {[
          t('bots.chat.usage.input'),
          t('bots.chat.usage.output'),
          t('bots.chat.usage.cacheRead'),
          t('bots.chat.usage.cacheWrite'),
        ].map((label) => (
          <div key={label} className={`${row} justify-between text-fg-muted`}>
            <span>{label}</span>
            {bar('w-10')}
          </div>
        ))}
      </section>
    </div>
  );
}
