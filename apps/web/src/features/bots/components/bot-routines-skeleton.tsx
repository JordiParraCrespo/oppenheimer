import { RoutineCard, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

function noop() {}

const ROWS = [
  { name: 'w-40', trigger: 'w-48', prompt: 'w-3/4' },
  { name: 'w-52', trigger: 'w-36', prompt: 'w-2/3' },
];

/**
 * The Routines tab while the bot and its routines load, laid out as the page
 * draws them: routine cards with their switch, Run now, Edit and Delete drawn
 * and out of reach, and a bar for each line the card draws (its
 * name, its when, its prompt, its last run), so nothing moves when the
 * routines land.
 */
export function BotRoutinesSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <LoadingStatus />
      <section inert aria-hidden className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <RoutineCard
            key={row.name}
            active
            name={<Skeleton shape="sm" className={`my-1 h-3.5 ${row.name}`} />}
            icon={<Skeleton shape="pill" className="size-3" />}
            trigger={<Skeleton shape="sm" className={`h-3 ${row.trigger}`} />}
            prompt={<Skeleton shape="sm" className={`my-1 h-3 ${row.prompt}`} />}
            last={<Skeleton shape="sm" className="inline-block h-2.5 w-24 align-middle" />}
            onActiveChange={noop}
            onRun={noop}
            onEdit={noop}
            onDelete={noop}
            labels={{
              active: t('bots.settings.routines.switch', { name: '' }),
              pause: t('bots.settings.routines.pause'),
              resume: t('bots.settings.routines.resume'),
              run: t('bots.settings.routines.run'),
              running: t('bots.settings.routines.running'),
              edit: t('bots.settings.routines.edit'),
              delete: t('bots.settings.routines.delete'),
              last: t('bots.settings.routines.last'),
              next: t('bots.settings.routines.next'),
            }}
          />
        ))}
      </section>
    </div>
  );
}
