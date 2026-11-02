import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The figures' cells, a label and a number each, at the widths they run to. */
const FIGURES = ['w-10', 'w-12', 'w-16', 'w-12', 'w-20', 'w-14'];

/**
 * The usage card before it answers: its title as it reads, this chat's
 * figures on their lines with bars for the words and numbers, and the
 * breakdown's four lines as they read with their numbers as bars.
 */
export function BotUsageSkeleton() {
  const { t } = useTranslation();
  const bar = (width: string) => (
    <span className="flex h-4.5 items-center">
      <Skeleton shape="sm" className={`h-2.5 ${width}`} />
    </span>
  );
  const line = 'flex items-center justify-between gap-3 border-b border-border-subtle py-2';
  return (
    <div aria-busy className="flex flex-col gap-5">
      <LoadingStatus />
      <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
      <section aria-hidden className="flex flex-col">
        <h4 className="pb-1 font-medium">{t('bots.chat.usage.thisChat')}</h4>
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          {FIGURES.map((width, index) => (
            <div key={`${width}-${index}`} className={line}>
              {bar(width)}
              {bar('w-8')}
            </div>
          ))}
        </div>
      </section>
      <section aria-hidden className="flex flex-col">
        <h4 className="pb-1 font-medium">{t('bots.chat.usage.breakdown')}</h4>
        {[
          t('bots.chat.usage.input'),
          t('bots.chat.usage.output'),
          t('bots.chat.usage.cacheRead'),
          t('bots.chat.usage.cacheWrite'),
        ].map((label) => (
          <div key={label} className={`${line} text-[13px]`}>
            <span className="text-fg-muted">{label}</span>
            {bar('w-10')}
          </div>
        ))}
      </section>
    </div>
  );
}
