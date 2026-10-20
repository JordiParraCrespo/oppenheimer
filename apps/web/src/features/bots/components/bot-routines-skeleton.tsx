import { RoutineCard, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

const ROWS = [
  { name: 'w-40', trigger: 'w-48', prompt: 'w-3/4' },
  { name: 'w-52', trigger: 'w-36', prompt: 'w-2/3' },
];

/**
 * The Routines tab while its list loads: routine cards with a bar for each
 * line the card draws (its name, its when, its prompt, its last and next
 * run), so nothing moves when the routines land.
 */
export function BotRoutinesSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-3">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      {ROWS.map((row) => (
        <RoutineCard
          key={row.name}
          active
          name={<Skeleton shape="sm" className={`my-1 h-3.5 ${row.name}`} />}
          trigger={<Skeleton shape="sm" className={`h-3 ${row.trigger}`} />}
          prompt={<Skeleton shape="sm" className={`my-1 h-3 ${row.prompt}`} />}
          last={<Skeleton shape="sm" className="h-2.5 w-24" />}
        />
      ))}
    </section>
  );
}
