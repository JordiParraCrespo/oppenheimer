import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The figures' lines, each a label and a number at the widths they run to. */
const FIGURES = ['w-12', 'w-16', 'w-14', 'w-20'];

/**
 * The usage card before it answers: "This chat" as it reads, its four
 * figures on their lines with the numbers as bars, then one model's
 * breakdown, the four lines of a model, its name a bar.
 */
export function BotUsageSkeleton() {
  const { t } = useTranslation();
  const line = (key: string, width: string) => (
    <div
      key={key}
      className="flex items-center justify-between gap-3 border-b border-border-subtle py-2"
    >
      <span className="flex h-4.5 items-center">
        <Skeleton shape="sm" className={`h-2.5 ${width}`} />
      </span>
      <span className="flex h-4.5 items-center">
        <Skeleton shape="sm" className="h-2.5 w-10" />
      </span>
    </div>
  );
  return (
    <div aria-busy className="flex flex-col gap-6">
      <LoadingStatus />
      <section aria-hidden className="flex flex-col gap-2">
        <h3 className="font-medium">{t('bots.chat.usage.thisChat')}</h3>
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
          {FIGURES.map((width, index) => line(`figure-${index}`, width))}
        </div>
      </section>
      <section aria-hidden className="flex flex-col">
        <div className="flex items-center justify-between gap-3 pb-1">
          <h3 className="font-medium">{t('bots.chat.usage.breakdown')}</h3>
          <Skeleton shape="sm" className="h-2.5 w-20" />
        </div>
        {[
          t('bots.chat.usage.input'),
          t('bots.chat.usage.output'),
          t('bots.chat.usage.cacheRead'),
          t('bots.chat.usage.cacheWrite'),
        ].map((label) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-border-subtle py-2 text-[13px]"
          >
            <span className="text-fg-muted">{label}</span>
            <span className="flex h-4.5 items-center">
              <Skeleton shape="sm" className="h-2.5 w-10" />
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
