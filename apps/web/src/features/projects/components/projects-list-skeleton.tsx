import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** Three projects, a name over its repositories, at the widths they run to. */
const ROWS = [
  { name: 'w-40', meta: 'w-56' },
  { name: 'w-32', meta: 'w-44' },
  { name: 'w-48', meta: 'w-36' },
];

/**
 * The projects before they answer: the list's card with three rows on the
 * row's own frame (the name, the repositories line, settings as bars).
 */
export function ProjectsListSkeleton() {
  return (
    <section aria-busy>
      <LoadingStatus />
      <SettingsGroup aria-hidden>
        {ROWS.map(({ name, meta }) => (
          <SettingsListRow
            key={name}
            align="center"
            meta={
              <span className="flex h-4.5 items-center">
                <Skeleton shape="sm" className={`h-2.5 ${meta}`} />
              </span>
            }
            actions={<Skeleton shape="pill" className="size-8" />}
          >
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className={`h-3 ${name}`} />
            </span>
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </section>
  );
}
