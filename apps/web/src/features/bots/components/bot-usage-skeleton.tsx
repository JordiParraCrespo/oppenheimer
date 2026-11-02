import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The card's three lines, at the widths they run to. */
const LINES = ['w-72', 'w-80', 'w-56'];

/** The usage card before it answers: its title as it reads, and a bar for each of its lines. */
export function BotUsageSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-1.5 text-[13px]">
      <LoadingStatus />
      <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
      {LINES.map((width) => (
        <span key={width} aria-hidden className="flex h-5 items-center">
          <Skeleton shape="sm" className={`h-2.5 ${width}`} />
        </span>
      ))}
    </div>
  );
}
